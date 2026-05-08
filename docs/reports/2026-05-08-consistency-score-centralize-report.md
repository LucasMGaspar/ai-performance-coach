# Report: Centralizar consistencyScore
Data: 2026-05-08
Plano: docs/plans/2026-05-08-consistency-score-centralize-plan.md
Branch: fix/consistency-score-centralize

## Resumo da Execução

Removido o recálculo local de `consistencyScore` em `web/lib/data.ts`. O frontend passa a usar directamente o campo persistido pelo backend (`progressionService.updateConsistencyScore`). Eliminadas 2 queries extras ao banco (recentDiet, recentWorkout) que só serviam este cálculo.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Remover recálculo local e queries extra | OK | -27 linhas, 0 novas |

## Verificação

- lint: N/A
- build: PASS
- types: PASS
- tests: N/A

## Ficheiros Modificados

- `web/lib/data.ts` — removido bloco CÁLCULO DE CONSISTÊNCIA REAL-TIME + override no return

## Próximos Passos

Todos os P0 do relatório Opus concluídos. Próxima sequência: P1 — tool use no parser, observabilidade (Langfuse), logger estruturado.
