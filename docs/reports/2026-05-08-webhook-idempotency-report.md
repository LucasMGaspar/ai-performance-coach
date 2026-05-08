# Report: Idempotência por messageId no webhook
Data: 2026-05-08
Plano: docs/plans/2026-05-08-webhook-idempotency-plan.md
Branch: fix/webhook-idempotency

## Resumo da Execução

Implementada idempotência completa no webhook da w-api. Retries do provider já não duplicam WorkoutLogs, DietLogs ou CheckIns. A verificação ocorre antes do bloco try, usando o `messageId` do payload quando disponível, ou um SHA-256 de `phone:msgContent` como fallback.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. `messageId` no tipo `WApiMessagePayload` | OK | Campo opcional adicionado a `src/types/index.ts` |
| 2. Métodos de idempotência no `RedisService` | OK | `isMessageProcessed` + `setMessageProcessed` com TTL 24h |
| 3. Verificação no webhook | OK | Check antes do `try`, mark após `sendTextMessage` |

## Verificação

- lint: N/A
- build: PASS
- types: PASS
- tests: N/A

## Ficheiros Modificados

- `src/types/index.ts` — adicionado `messageId?: string` a `WApiMessagePayload`
- `src/services/redis.service.ts` — adicionados 3 métodos (`buildIdempotencyKey`, `isMessageProcessed`, `setMessageProcessed`)
- `src/routes/webhook.ts` — import `createHash`, verificação de idempotência antes do try, mark após resposta

## Próximos Passos

Próximo item da sequência P0: ativar autenticação HMAC no webhook (registar `webhookAuthHook` ou validar HMAC do header da w-api).
