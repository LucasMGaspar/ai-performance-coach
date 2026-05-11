# Report: Onboarding Completo via Web Form
Data: 2026-05-11
Plano: docs/plans/2026-05-11-onboarding-web-form-plan.md
Branch: feat/onboarding-web-form

## Resumo da Execução

Fluxo de onboarding migrado do WhatsApp para um formulário web completo. O utilizador acede a `/onboarding`, preenche perfil + dieta, e ao submeter recebe uma mensagem de boas-vindas no WhatsApp com os dados já salvos. O bot WhatsApp simplificado actua apenas como fallback (envia link do formulário).

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Simplificar onboarding.agent.ts | OK | State machine removida; handle() retorna link do form |
| 2. Server Action submitOnboarding | OK | upsert User + createMany ScheduledMeal + WAPI welcome |
| 3. web/app/onboarding/page.tsx | OK | Server Component público, rota /onboarding |
| 4. web/app/onboarding/OnboardingForm.tsx | OK | Client Component, 3 secções, add/remove meals |

## Verificação

- lint: N/A
- build: **PASS** (Next.js 16.2.6 Turbopack, /onboarding listada como ƒ Dynamic)
- types: PASS (erros pré-existentes em actions.ts e treino/page.tsx, não introduzidos por esta feature)
- tests: N/A

## Ficheiros Modificados

- `src/agents/onboarding.agent.ts` — state machine substituída por resposta simples com link
- `src/types/index.ts` — "meals" e "meals_confirm" removidos de OnboardingStep
- `web/lib/actions.ts` — MealInput + calculateTDEE + submitOnboarding adicionados
- `web/app/onboarding/page.tsx` — NOVO: página pública de registo
- `web/app/onboarding/OnboardingForm.tsx` — NOVO: formulário completo (perfil + objetivo + dieta)

## Variáveis de Ambiente Necessárias (web)

Adicionar a `web/.env.local` antes de deployar:
```
WAPI_TOKEN=<mesmo valor do backend>
WAPI_INSTANCE_ID=<mesmo valor do backend>
NEXT_PUBLIC_APP_URL=https://<domínio-da-web>
```

## Fluxo Resultante

```
/onboarding → preencher perfil + dieta → submit
  → User criado/actualizado na DB (onboarded: true)
  → ScheduledMeal criadas
  → WhatsApp: mensagem de boas-vindas enviada
  → redirect → /dashboard/{userId}
```

## Próximos Passos

- Adicionar env vars WAPI_TOKEN, WAPI_INSTANCE_ID, NEXT_PUBLIC_APP_URL na web (Vercel ou .env.local)
- Features pendentes: edição de dieta no dashboard, extra food WhatsApp logging
