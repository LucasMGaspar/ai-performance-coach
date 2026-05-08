# Plano: Centralizar consistencyScore — usar valor persistido pelo backend
Data: 2026-05-08
Branch: fix/consistency-score-centralize

## Contexto

Em `web/lib/data.ts`, função `getUserDashboard`:

- **Linhas 146–168**: duas queries adicionais ao banco (`recentDiet`, `recentWorkout`) seguidas de um recálculo local do score (fórmula igual à do backend).
- **Linha 175**: `user: { ...user, consistencyScore: calculatedScore }` — sobrepõe o campo persistido pelo backend com o valor recalculado localmente.

O campo `consistencyScore Int @default(0)` já existe no model `User` e é persistido pelo `progressionService.updateConsistencyScore` após cada treino/dieta/check-in. O `prisma.user.findUniqueOrThrow` na linha 14 já o traz.

Usar o valor recalculado localmente garante divergência quando as duas fórmulas divergem (ex: timezone, precisão de float, janela de 7 dias).

## Objectivo

- Frontend lê `user.consistencyScore` directamente do banco.
- Remover as duas queries extra (`recentDiet`, `recentWorkout`) — executadas só para este cálculo.
- Remover o bloco de recálculo local (linhas 144–168).
- Remover o override na linha 175.

## Passos de Implementação

### Passo 1 — Remover queries e recálculo local em `web/lib/data.ts`

**Ficheiro:** `web/lib/data.ts`

**O que remover:**

1. O bloco inteiro "CÁLCULO DE CONSISTÊNCIA REAL-TIME" (linhas 144–168):
```ts
// --- CÁLCULO DE CONSISTÊNCIA REAL-TIME ---
const sevenDaysAgo = new Date(Date.now() - 7 * msPerDay);
const recentDiet = await prisma.dietLog.findMany({ ... });
const recentWorkout = await prisma.workoutLog.findMany({ ... });

const dietMap = new Map<string, number>();
recentDiet.forEach(...);
const workoutSetRecent = new Set(...);

let dietPoints = 0;
const target = user.targetCalories || 2000;
dietMap.forEach(...);

const dietScore = ...;
const workoutScore = ...;
const calculatedScore = Math.round(dietScore + workoutScore);
```

2. Na linha 175, substituir:
```ts
user: { ...user, consistencyScore: calculatedScore },
```
Por:
```ts
user,
```

**Verificação:** `npx tsc --noEmit` na raiz (o tsconfig inclui web/) sem erros. A variável `calculatedScore` deixa de existir — não deve haver referências a ela fora do bloco removido.

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros (raiz)
- [ ] `npm run build` passa (raiz — compila backend TypeScript)
- [ ] Confirmar que não há outras referências a `calculatedScore` em `web/lib/data.ts` após a remoção

## Fora de Escopo

- Alterar a fórmula do `updateConsistencyScore` no backend
- Sincronizar a lógica de timezone entre backend e frontend
- Qualquer outra mudança em `web/lib/data.ts`

## Package Manager

npm — `package-lock.json` na raiz e em `web/`. Sem novas dependências.
