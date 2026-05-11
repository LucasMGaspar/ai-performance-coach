# Report: Edição de Refeições no Dashboard
Data: 2026-05-11
Plano: docs/plans/2026-05-11-diet-edit-dashboard-plan.md
Branch: feat/diet-edit-dashboard

## Resumo da Execução

Cards de refeição na aba `/dieta` passaram de read-only para editáveis inline. Botão de lápis em cada card abre formulário expandido com campos editáveis. Ao guardar, Server Action actualiza `ScheduledMeal` na DB e revalida a página.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Server Action updateScheduledMeal | OK | Adicionada a actions.ts |
| 2. MealCard Client Component | OK | View + edit mode inline |
| 3. Actualizar dieta/page.tsx | OK | Usa MealCard, secção extras inalterada |

## Verificação

- lint: N/A
- build: **PASS** (após limpar cache .next)
- types: PASS
- tests: N/A

## Ficheiros Modificados

- `web/lib/actions.ts` — `updateScheduledMeal` adicionado
- `web/app/dashboard/[userId]/dieta/MealCard.tsx` — NOVO: Client Component com edição inline
- `web/app/dashboard/[userId]/dieta/page.tsx` — usa MealCard no map de refeições

## Próximos Passos

- Feature pendente: extra food logging no WhatsApp
