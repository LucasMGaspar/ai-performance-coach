# Report: Corrigir lookup de exercícios no webhook
Data: 2026-05-08
Plano: docs/plans/2026-05-08-webhook-catalog-lookup-fix-plan.md
Branch: fix/webhook-catalog-lookup

## Resumo da Execução

Dois bugs críticos corrigidos em `src/routes/webhook.ts` no `case "workout"`:
1. `findMany` movido para fora do loop — de N queries para 1 query por mensagem de treino.
2. Fallback silencioso para `catalog[0]` eliminado — exercícios não reconhecidos são skippados e o utilizador é informado com a listagem dos nomes.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Mover `findMany` para fora do loop | OK | 1 query ao banco independentemente do nº de exercícios |
| 2. Eliminar fallback silencioso | OK | `catalogEntry ?? catalog[0]` removido |
| 3. Aviso ao utilizador | OK | Listagem de exercícios não reconhecidos na resposta WhatsApp |
| 4. Streak condicional | OK | `updateStreak` só corre se ≥1 exercício foi registado |

## Verificação

- lint: N/A (sem lint configurado no backend)
- build: PASS (`npm run build` sem erros)
- types: PASS (`npx tsc --noEmit` sem erros)
- tests: N/A (sem suite de testes)

## Ficheiros Modificados

- `src/routes/webhook.ts` — refactor do `case "workout"`: +28 linhas, -14 linhas

## Próximos Passos

Próximo item da sequência: idempotência por `messageId` no Redis.
