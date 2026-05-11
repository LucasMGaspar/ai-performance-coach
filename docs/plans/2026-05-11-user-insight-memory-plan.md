# Plano: UserInsight — Memória de Longo Prazo do Coach
Data: 2026-05-11
Branch: feat/user-insight-memory

## Contexto

O coach actual responde com base apenas no treino actual + histórico recente consultado via tools na mesma sessão. Não há persistência de padrões detectados entre conversas — o coach "esquece" tudo ao final de cada interacção.

Exemplo do que falta:
- Semana passada o utilizador mencionou dor no ombro. O coach não sabe disso hoje.
- Há 3 semanas o coach detectou plateau no supino. Voltou a detectar hoje. Deveria reforçar a mensagem, não repetir o diagnóstico como se fosse novo.
- A proteína está cronicamente 30g abaixo da meta às terças. Padrão detectado mas esquecido.

## Objectivo

- Tabela `UserInsight` persiste padrões detectados pelo coach (1 por tipo por utilizador no estado activo)
- Tool `get_user_insights` carrega insights activos no início de cada análise
- Tool `save_insight` permite ao coach escrever novos padrões ou confirmar existentes
- Coach passa a ter contexto acumulado entre sessões — feedback progressivo, não repetitivo

---

## Schema

### Tabela `UserInsight`

```prisma
model UserInsight {
  id        String   @id @default(cuid())
  userId    String
  type      String   // "plateau" | "nutrition_deficit" | "sleep_fatigue" | "pr_trend" | "recovery_concern"
  content   String   // Frase legível para o coach (ex: "Supino em plateau há 3 semanas")
  evidence  String?  // JSON string com dados de suporte (opcional)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id])

  @@index([userId, type, active])
  @@map("user_insights")
}
```

Adicionar relação ao model `User`:
```prisma
insights       UserInsight[]
```

### Tipos válidos de insight

| type | Quando criar |
|---|---|
| `plateau` | 3+ sessões sem progressão de carga/volume no mesmo exercício |
| `nutrition_deficit` | Proteína média 7d abaixo de 80% da meta |
| `sleep_fatigue` | Média de sono <6 nos últimos 3 check-ins + RPE crescente |
| `pr_trend` | E1RM subiu >10% em 2 semanas |
| `recovery_concern` | RPE médio >8.5 nas últimas 3 sessões |

---

## Passos de Implementação

### Passo 1 — Adicionar `UserInsight` ao schema Prisma

**Ficheiro:** `prisma/schema.prisma`

**O que muda:**
1. Adicionar model `UserInsight` (ver schema acima)
2. Adicionar `insights UserInsight[]` ao model `User`

**Verificação:** `npx prisma generate` sem erros. (NÃO correr `prisma db push` — requer acesso manual à DB de produção.)

---

### Passo 2 — Adicionar métodos ao `rag.service.ts`

**Ficheiro:** `src/services/rag.service.ts`

**O que muda:** adicionar interface `UserInsightRecord` e dois métodos à classe `RagService`.

Interface (antes da classe, após as outras interfaces):
```ts
interface UserInsightRecord {
  id: string;
  type: string;
  content: string;
  evidence: string | null;
  createdAt: Date;
}
```

Método `getActiveInsights`:
```ts
async getActiveInsights(userId: string): Promise<UserInsightRecord[]> {
  const records = await prisma.userInsight.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, content: true, evidence: true, createdAt: true },
  });
  return records as UserInsightRecord[];
}
```

Método `upsertInsight` (upsert por userId+type — evita duplicados do mesmo tipo activo):
```ts
async upsertInsight(
  userId: string,
  type: string,
  content: string,
  evidence?: string
): Promise<void> {
  // Desactivar insight anterior do mesmo tipo (se existir)
  await prisma.userInsight.updateMany({
    where: { userId, type, active: true },
    data: { active: false },
  });
  // Criar novo insight activo
  // @ts-ignore
  await prisma.userInsight.create({
    data: { userId, type, content, evidence: evidence ?? null, active: true },
  });
}
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 3 — Adicionar tools `get_user_insights` e `save_insight` ao coach

**Ficheiro:** `src/agents/coach.agent.ts`

**O que muda:**

1. Adicionar duas tools à constante `COACH_TOOLS` (no início, antes de `get_exercise_history`):

```ts
{
  name: "get_user_insights",
  description: "Get active insights and patterns detected in previous sessions for this user. Call this FIRST to have context from past analyses.",
  input_schema: {
    type: "object" as const,
    properties: {},
    required: [],
  },
},
{
  name: "save_insight",
  description: "Save a new pattern or insight detected during analysis. Only save when you detect a meaningful pattern (plateau, chronic deficit, sleep correlation, etc). Updates existing insight of same type.",
  input_schema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        enum: ["plateau", "nutrition_deficit", "sleep_fatigue", "pr_trend", "recovery_concern"],
        description: "Category of the insight",
      },
      content: {
        type: "string",
        description: "Human-readable description of the pattern (in Portuguese)",
      },
      evidence: {
        type: "string",
        description: "Optional JSON string with supporting data",
      },
    },
    required: ["type", "content"],
  },
},
```

2. Adicionar os dois cases ao `executeTool`:

```ts
case "get_user_insights": {
  return ragService.getActiveInsights(userId);
}
case "save_insight": {
  const { type, content, evidence } = input as {
    type: string;
    content: string;
    evidence?: string;
  };
  await ragService.upsertInsight(userId, type, content, evidence);
  return { saved: true };
}
```

3. Actualizar `COACH_SYSTEM_PROMPT` — adicionar instruções de memória:

Substituir o sistema de raciocínio por:
```
Processo de raciocínio:
1. SEMPRE começa por get_user_insights para carregar o contexto de sessões anteriores
2. Consulte o histórico do exercício (get_exercise_history) para ver progressão
3. Use get_e1rm_history para ver evolução do E1RM. Expresse a carga actual como % do E1RM mais recente (ex: "80kg = 75% do teu E1RM de 107kg"). Se não houver histórico, use compute_e1rm
4. Verifique plateau (detect_plateau) se houver histórico suficiente
5. Se RPE alto ou volume baixo, verifique bem-estar recente (get_checkin_history, 3 dias)
6. Se detectares um padrão relevante (plateau, deficit crónico, correlação sono/RPE), chama save_insight

Output:
- 1-3 frases naturais, tom de coach directo
- 1 insight accionável específico
- Se há insights anteriores relevantes, referencia-os ("como notei na semana passada...")
- Formato WhatsApp: sem markdown, máximo 4 linhas, use emojis com moderação
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

## Verificação Final

- [ ] `npx prisma generate` sem erros (schema com UserInsight)
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] `npm run test` — 22/22 PASS
- [ ] Inspecção: `UserInsight` no schema com index `[userId, type, active]`
- [ ] Inspecção: `getActiveInsights` e `upsertInsight` em `rag.service.ts`
- [ ] Inspecção: tools `get_user_insights` e `save_insight` no início de `COACH_TOOLS`
- [ ] Inspecção: system prompt começa com "SEMPRE começa por get_user_insights"

## Fora de Escopo

- UI de insights no dashboard
- Expiração automática de insights (TTL)
- Insights para outros agentes (dieta, onboarding)
- Deactivar insights manualmente pelo utilizador

## Comando de Schema Push (correr manualmente contra a DB)

```bash
npx prisma db push
npx prisma generate
```

## Package Manager

npm — `package-lock.json` na raiz.
