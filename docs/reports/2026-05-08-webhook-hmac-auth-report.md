# Report: Autenticação HMAC no webhook
Data: 2026-05-08
Plano: docs/plans/2026-05-08-webhook-hmac-auth-plan.md
Branch: fix/webhook-hmac-auth

## Resumo da Execução

Implementada validação HMAC-SHA256 inline em `src/routes/webhook.ts`. O `WEBHOOK_SECRET` (que existia no env mas nunca era usado no webhook) passa a ser utilizado para validar a assinatura da w-api via header `x-hub-signature-256`. Modo soft: valida se header presente, fall-through se ausente (sem quebrar produção até confirmar o header exacto da w-api).

O `webhookAuthHook` existente (Bearer token) permanece inalterado — incompatível com o modelo de entrega da w-api e não activado.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Validação HMAC inline no webhook | OK | Import actualizado + bloco HMAC após guard `fromMe` |

## Verificação

- lint: N/A
- build: PASS
- types: PASS
- tests: N/A

## Ficheiros Modificados

- `src/routes/webhook.ts` — import `createHmac, timingSafeEqual` + bloco de validação HMAC

## Próximos Passos

- Confirmar o nome exacto do header da w-api na documentação e tornar a validação estrita (rejeitar se header ausente)
- Próximo item da sequência P0: streak por dia-civil em fuso do utilizador (`progressionService.updateStreak`)
