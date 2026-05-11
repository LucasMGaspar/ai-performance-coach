# Plano: Quick Wins — Bug Fix + Rate Limiting + Scripts
Data: 2026-05-11
Branch: fix/quick-wins-rate-limit-history-scripts

## Contexto

Três melhorias independentes sem mudança de schema:

1. **Bug**: `getLastNWorkouts` não filtra o treino da sessão actual. Com o padrão async de `setImmediate`, o treino é salvo no DB antes de `analyzeWorkout` correr — o coach recebe o treino actual como entry[0] do histórico e pode compará-lo consigo mesmo.

2. **Segurança**: o webhook não tem rate limiting por phone. Um utilizador (ou bot) pode mandar 100+ mensagens seguidas e gerar 100+ chamadas a Claude/DB.

3. **Housekeeping**: 6 scripts ad-hoc (`delete-daniel.ts`, `delete-users.ts`, `query-check.ts`, `query-diet.ts`, `test-anthropic.ts`, `test-onboarding.ts`) estão na raiz do projecto misturados com ficheiros de configuração.

## Objectivo

- Coach compara o treino actual com sessões **anteriores** (não consigo mesmo)
- Webhook rejeita silenciosamente >20 mensagens/60s do mesmo phone
- Raiz do projecto fica limpa — scripts ad-hoc em `scripts/`

---

## Passos de Implementação

### Passo 1 — Adicionar `beforeDate` a `getLastNWorkouts`

**Ficheiro:** `src/services/rag.service.ts`

**O que muda:** adicionar parâmetro opcional `beforeDate?: Date` ao método `getLastNWorkouts`. Quando presente, adicionar `date: { lt: beforeDate }` ao `where` da query Prisma.

```ts
async getLastNWorkouts(
  userId: string,
  exerciseId: string,
  n: number,
  beforeDate?: Date
): Promise<WorkoutLog[]> {
  const logs = await prisma.workoutLog.findMany({
    where: {
      userId,
      exerciseId,
      ...(beforeDate ? { date: { lt: beforeDate } } : {}),
    },
    orderBy: { date: "desc" },
    take: n,
    select: { /* mesmos campos actuais */ },
  });
  return logs as WorkoutLog[];
}
```

**Verificação:** `npx tsc --noEmit` sem erros. Chamada sem `beforeDate` continua a funcionar igual.

---

### Passo 2 — Passar `analysisStartedAt` ao `executeTool` no coach

**Ficheiro:** `src/agents/coach.agent.ts`

**O que muda:**

1. No início de `analyzeWorkout`, capturar o timestamp antes do loop:
```ts
const analysisStartedAt = new Date();
```

2. Alterar assinatura de `executeTool` para receber um contexto:
```ts
private async executeTool(
  userId: string,
  toolName: string,
  input: Record<string, unknown>,
  ctx: { analysisStartedAt: Date }
): Promise<unknown>
```

3. No `case "get_exercise_history"` de `executeTool`, passar `ctx.analysisStartedAt` como `beforeDate`:
```ts
case "get_exercise_history": {
  const { exerciseId, n } = input as { exerciseId: string; n: number };
  return ragService.getLastNWorkouts(userId, exerciseId, Math.min(n, 10), ctx.analysisStartedAt);
}
```

4. No `case "detect_plateau"` de `executeTool`, passar igualmente:
```ts
const logs = await ragService.getLastNWorkouts(userId, exerciseId, 5, ctx.analysisStartedAt);
```

5. Actualizar todas as chamadas a `this.executeTool(...)` dentro do loop de `analyzeWorkout` para passar `{ analysisStartedAt }`:
```ts
const result = await this.executeTool(userId, block.name, block.input as Record<string, unknown>, { analysisStartedAt });
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 3 — Rate limiting no `redis.service.ts`

**Ficheiro:** `src/services/redis.service.ts`

**O que muda:** adicionar método `checkRateLimit` à classe `RedisService` usando o cliente Redis existente (sem instalar novo pacote). Padrão fixed-window com `INCR` + `EXPIRE`:

```ts
async checkRateLimit(
  phone: string,
  max: number = 20,
  windowSec: number = 60
): Promise<boolean> {
  const window = Math.floor(Date.now() / (windowSec * 1000));
  const key = `ratelimit:${phone}:${window}`;
  const count = await this.redis.incr(key);
  if (count === 1) {
    await this.redis.expire(key, windowSec);
  }
  return count <= max;
}
```

Retorna `true` se dentro do limite, `false` se excedeu.

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 4 — Aplicar rate limiting no webhook

**Ficheiro:** `src/routes/webhook.ts`

**O que muda:** após extrair `phone` e antes do bloco de idempotência, adicionar verificação de rate limit:

```ts
// Rate limiting: máximo 20 mensagens por 60 segundos por phone
const withinLimit = await redisService.checkRateLimit(phone);
if (!withinLimit) {
  return reply.status(200).send({ ok: true });
}
```

Posição exacta: após a linha `const phone = (body?.sender?.id ?? "").replace(...)` e antes da linha `if (await redisService.isMessageProcessed(idempotencyKey))`.

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 5 — Mover scripts ad-hoc para `scripts/`

**O que muda:**
1. Criar directório `scripts/` na raiz (se não existir)
2. Mover os seguintes ficheiros da raiz para `scripts/`:
   - `delete-daniel.ts` → `scripts/delete-daniel.ts`
   - `delete-users.ts` → `scripts/delete-users.ts`
   - `query-check.ts` → `scripts/query-check.ts`
   - `query-diet.ts` → `scripts/query-diet.ts`
   - `test-anthropic.ts` → `scripts/test-anthropic.ts`
   - `test-onboarding.ts` → `scripts/test-onboarding.ts`
3. Manter na raiz: `prisma.config.ts`, `vitest.config.ts`

**Verificação:** `ls scripts/` mostra 6 ficheiros. `ls *.ts` na raiz mostra apenas `prisma.config.ts` e `vitest.config.ts`.

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] `npm run test` — 22/22 PASS
- [ ] Inspecção: `getLastNWorkouts` com `beforeDate` filtra correctamente
- [ ] Inspecção: `checkRateLimit` adicionado ao `redis.service.ts`
- [ ] Inspecção: rate limit aplicado no webhook antes do idempotency check
- [ ] Inspecção: `scripts/` contém 6 ficheiros, raiz limpa

## Fora de Escopo

- Sliding window rate limiting (fixed-window é suficiente para este caso)
- Alertas para o admin quando um phone é bloqueado por rate limit
- Testes unitários para `checkRateLimit`
- `@ts-ignore` cleanup (requer `prisma generate` no pipeline — tarefa separada)
- Remover `server.log` commitado (tarefa de limpeza separada)

## Package Manager

npm — `package-lock.json` na raiz. Nenhuma dependência nova neste plano.
