# Plano: Streak por dia-civil em UTC
Data: 2026-05-08
Branch: fix/streak-civil-day

## Contexto

`progressionService.updateStreak` em `src/services/progression.service.ts` calcula `diffInDays` com:

```ts
const diffInDays = Math.floor((now.getTime() - lastLog.getTime()) / (1000 * 60 * 60 * 24));
```

Isto usa a diferença em milissegundos entre dois timestamps arbitrários. Dois treinos em dias diferentes mas com menos de 24h de diferença (ex: 23h e 8h do dia seguinte) resultam em `diffInDays === 0` — o streak não incrementa como deveria.

O model `User` em `prisma/schema.prisma` não tem campo `timezone`. Usaremos UTC como referência (melhor que horas brutas).

## Objectivo

Calcular `diffInDays` comparando o **início do dia UTC** de `now` com o **início do dia UTC** de `lastLog`. Assim:
- 23h de segunda → 8h de terça: `diffInDays === 1` ✓ streak incrementa
- 0h de segunda → 23h59 de segunda: `diffInDays === 0` ✓ já treinou hoje
- 0h de segunda → 8h de quarta: `diffInDays === 2` ✓ streak quebrado

## Passos de Implementação

### Passo 1 — Substituir cálculo de `diffInDays` no `updateStreak`

**Ficheiro:** `src/services/progression.service.ts`

Adicionar função pura auxiliar privada `toDayStart` à classe, antes do método `updateStreak` (ou como função de módulo fora da classe):

```ts
/** Trunca uma Date para o início do dia em UTC (YYYY-MM-DDT00:00:00.000Z) */
private static toDayStart(d: Date): Date {
  return new Date(d.toISOString().split("T")[0] + "T00:00:00.000Z");
}
```

No método `updateStreak`, substituir o cálculo actual:

```ts
// ANTES:
const diffInDays = Math.floor((now.getTime() - lastLog.getTime()) / (1000 * 60 * 60 * 24));

// DEPOIS:
const todayStart = ProgressionService.toDayStart(now);
const lastLogStart = ProgressionService.toDayStart(lastLog);
const diffInDays = Math.round((todayStart.getTime() - lastLogStart.getTime()) / (1000 * 60 * 60 * 24));
```

> `Math.round` em vez de `Math.floor` porque após truncar para meia-noite UTC, a diferença é sempre um múltiplo exacto de 86400000 ms — `round` é mais robusto a eventuais imprecisões de float.

**Verificação:** `npx tsc --noEmit` sem erros. Lógica de negócio testável manualmente com exemplos:
- `lastLog = 23:00` dia D, `now = 08:00` dia D+1 → `diffInDays === 1` → streak ++
- `lastLog = 08:00` dia D, `now = 23:59` dia D → `diffInDays === 0` → streak inalterado
- `lastLog = 23:00` dia D, `now = 08:00` dia D+2 → `diffInDays === 2` → streak reset a 1

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] Lógica verificada manualmente com os 3 exemplos acima

## Fora de Escopo

- Adicionar campo `timezone` ao model `User` e ao Prisma (melhoria futura)
- Uso de `Intl.DateTimeFormat` para fuso local do utilizador (depende de campo timezone)
- Qualquer outra mudança no `progressionService`

## Package Manager

npm — `package-lock.json` na raiz. Sem novas dependências.
