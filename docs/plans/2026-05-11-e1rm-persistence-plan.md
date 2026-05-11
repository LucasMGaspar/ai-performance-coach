# Plano: E1RM Persistido por Exercício
Data: 2026-05-11
Branch: feat/e1rm-persistence

## Contexto

O coach calcula E1RM via tool `compute_e1rm` (Epley: `weight * (1 + reps/30)`) on-the-fly para o treino actual, mas nunca persiste esse valor. A tabela `ExercisePR` já guarda o melhor PR por exercício (`weightKg`, `reps`), mas não o E1RM derivado.

Sem E1RM histórico persistido, o coach não consegue:
- Mostrar evolução de força ao longo do tempo (ex: "E1RM subiu de 95kg para 107kg em 4 semanas")
- Expressar cargas como % do máximo estimado (ex: "80kg = 75% do teu E1RM")

## Objectivo

- `ExercisePR.e1rmKg` guarda o E1RM Epley no momento do PR
- `progressionService.updatePR` calcula e persiste E1RM em cada PR novo
- `rag.service.ts` expõe `getE1RMHistory(userId, exerciseId, n)` para histórico de PRs + E1RM
- Coach tem nova tool `get_e1rm_history` e system prompt actualizado para falar em %1RM

## Schema Change

### Aplicar com `npx prisma db push`

Este projecto não usa migrations files — usa `prisma db push` directamente. Após editar o schema:

```bash
npx prisma db push
npx prisma generate
```

`prisma db push` adiciona a coluna `e1rm_kg` como nullable — safe para registos existentes (ficam com NULL, o coach trata NULL como "sem histórico").

---

## Passos de Implementação

### Passo 1 — Adicionar `e1rmKg` ao schema Prisma

**Ficheiro:** `prisma/schema.prisma`

**O que muda:** adicionar campo `e1rmKg Float?` ao model `ExercisePR`, antes do fecho `}`:

```prisma
model ExercisePR {
  id         String   @id @default(cuid())
  userId     String
  exerciseId String
  weightKg   Float
  reps       Int
  e1rmKg     Float?   // E1RM Epley calculado no momento do PR
  date       DateTime @default(now())

  user     User            @relation(fields: [userId], references: [id])
  exercise ExerciseCatalog @relation(fields: [exerciseId], references: [id])

  @@unique([userId, exerciseId])
  @@map("exercise_prs")
}
```

**Verificação:** `npx prisma db push` sem erros. `npx prisma generate` para regenerar o cliente.

---

### Passo 2 — Calcular e persistir E1RM em `updatePR`

**Ficheiro:** `src/services/progression.service.ts`

**O que muda:** no método `updatePR`, antes do upsert, calcular E1RM e incluí-lo nos dados:

```ts
const e1rmKg = +(weightKg * (1 + reps / 30)).toFixed(1);
```

Adicionar `e1rmKg` ao `update` e `create` do upsert:
```ts
await prisma.exercisePR.upsert({
  where: { userId_exerciseId: { userId, exerciseId } },
  update: { weightKg, reps, e1rmKg, date: new Date() },
  create: { userId, exerciseId, weightKg, reps, e1rmKg, date: new Date() },
});
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 3 — Adicionar `getE1RMHistory` ao `rag.service.ts`

**Ficheiro:** `src/services/rag.service.ts`

**O que muda:** adicionar interface local `ExercisePRRecord` e método `getE1RMHistory`:

```ts
interface ExercisePRRecord {
  id: string;
  weightKg: number;
  reps: number;
  e1rmKg: number | null;
  date: Date;
}
```

```ts
async getE1RMHistory(
  userId: string,
  exerciseId: string,
  n: number
): Promise<ExercisePRRecord[]> {
  // ExercisePR tem apenas 1 registo por (userId, exerciseId) — o mais recente
  // Para histórico de E1RM precisamos dos últimos N WorkoutLog ordenados e calculamos E1RM de cada um
  const logs = await prisma.workoutLog.findMany({
    where: { userId, exerciseId },
    orderBy: { date: "desc" },
    take: n,
    select: { id: true, weightKg: true, reps: true, date: true },
  });
  return logs.map((l: { id: string; weightKg: number; reps: number; date: Date }) => ({
    id: l.id,
    weightKg: l.weightKg,
    reps: l.reps,
    e1rmKg: +(l.weightKg * (1 + l.reps / 30)).toFixed(1),
    date: l.date,
  }));
}
```

**Nota:** como `ExercisePR` tem apenas 1 linha por exercício (o PR actual), o histórico de E1RM ao longo do tempo vem dos `WorkoutLog` — calculamos E1RM para cada sessão. O `ExercisePR.e1rmKg` guarda apenas o E1RM do melhor PR.

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 4 — Adicionar tool `get_e1rm_history` ao coach

**Ficheiro:** `src/agents/coach.agent.ts`

**O que muda:**

1. Adicionar tool à constante `COACH_TOOLS` (após `compute_e1rm`):
```ts
{
  name: "get_e1rm_history",
  description: "Get E1RM history for an exercise (last N sessions). Use this to show strength progression over time and express current load as % of estimated max.",
  input_schema: {
    type: "object" as const,
    properties: {
      exerciseId: { type: "string", description: "Exercise ID" },
      n: { type: "number", description: "Number of sessions (max 10)" },
    },
    required: ["exerciseId", "n"],
  },
},
```

2. Adicionar case ao `executeTool`:
```ts
case "get_e1rm_history": {
  const { exerciseId, n } = input as { exerciseId: string; n: number };
  return ragService.getE1RMHistory(userId, exerciseId, Math.min(n, 10));
}
```

3. Actualizar `COACH_SYSTEM_PROMPT` — substituir o passo 2 do raciocínio:
```
2. Use get_e1rm_history para ver a evolução do E1RM estimado ao longo das sessões. Expresse a carga actual como % do E1RM recente (ex: "80kg = 75% do teu E1RM de 107kg"). Se não houver histórico, use compute_e1rm para calcular o E1RM desta sessão.
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

## Verificação Final

- [ ] `npx prisma db push` aplica a coluna `e1rm_kg` sem erros
- [ ] `npx prisma generate` regenera o cliente sem erros
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] `npm run test` — 22/22 PASS (testes existentes não afectados)
- [ ] Inspecção: `ExercisePR` no schema tem `e1rmKg Float?`
- [ ] Inspecção: `updatePR` calcula e inclui `e1rmKg` no upsert
- [ ] Inspecção: `getE1RMHistory` existe no `rag.service.ts`
- [ ] Inspecção: tool `get_e1rm_history` existe no `COACH_TOOLS`

## Fora de Escopo

- Backfill de E1RM para PRs existentes (NULL é tratado pelo coach como "sem histórico")
- E1RM no WorkoutLog (só calculamos on-the-fly em `getE1RMHistory`)
- Dashboard visualização de E1RM (frontend change — próxima iteração)
- Múltiplos modelos de E1RM (Brzycki, Lombardi) — Epley é suficiente

## Package Manager

npm — `package-lock.json` na raiz.

## Comando de Schema Push

```bash
npx prisma db push
npx prisma generate
```

**Atenção:** correr em dev e depois em prod (Supabase). A coluna é nullable — safe para dados existentes.
