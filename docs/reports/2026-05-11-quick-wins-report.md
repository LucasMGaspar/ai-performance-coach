# Report: Quick Wins — Rate Limit, History Filter, Scripts
Data: 2026-05-11
Plano: docs/plans/2026-05-11-quick-wins-plan.md
Branch: fix/quick-wins-rate-limit-history-scripts

## Resumo da Execução

Três melhorias sem mudança de schema: bug fix no filtro de histórico do coach, rate limiting por phone no webhook, e limpeza de scripts ad-hoc da raiz.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. beforeDate em getLastNWorkouts | OK | rag.service.ts — parâmetro opcional, spread condicional |
| 2. analysisStartedAt no executeTool | OK | coach.agent.ts — ctx passado ao executeTool |
| 3. checkRateLimit no redis.service | OK | Fixed-window INCR+EXPIRE, 20 msg/60s |
| 4. Rate limit no webhook | OK | Inserido após guard !text&&!isAudio, antes de idempotência |
| 5. Scripts movidos para scripts/ | OK | git mv preserva histórico, 6 ficheiros |

## Verificação

- lint: N/A
- build: PASS
- types: PASS
- tests: **22/22 PASS**

## Ficheiros Modificados

- `src/services/rag.service.ts` — beforeDate opcional em getLastNWorkouts
- `src/agents/coach.agent.ts` — ctx com analysisStartedAt no executeTool
- `src/services/redis.service.ts` — método checkRateLimit adicionado
- `src/routes/webhook.ts` — rate limiting aplicado antes de idempotência
- `scripts/` — 6 ficheiros movidos da raiz

## Próximos Passos

Plano B: E1RM persistido por exercício. Plano C: UserInsight memory table.
