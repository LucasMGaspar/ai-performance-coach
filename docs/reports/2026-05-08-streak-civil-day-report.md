# Report: Streak por dia-civil UTC
Data: 2026-05-08
Plano: docs/plans/2026-05-08-streak-civil-day-plan.md
Branch: fix/streak-civil-day

## Resumo da Execução

Corrigido o cálculo de `diffInDays` em `progressionService.updateStreak`. Agora usa dias-civis UTC em vez de diferença de milissegundos entre timestamps, eliminando o bug onde treinos com menos de 24h de diferença mas em dias diferentes não incrementavam o streak.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Streak por dia-civil UTC | OK | `toDayStart` + `Math.round` sobre dias normalizados |

## Verificação

- lint: N/A
- build: PASS
- types: PASS
- tests: N/A

## Ficheiros Modificados

- `src/services/progression.service.ts` — método estático `toDayStart` + substituição do cálculo `diffInDays`

## Próximos Passos

Próximo item da sequência P0: centralizar `consistencyScore` — eliminar divergência entre backend e frontend.
