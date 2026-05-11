# Report: Extra Food Logging no WhatsApp
Data: 2026-05-11
Plano: docs/plans/2026-05-11-extra-food-whatsapp-plan.md
Branch: feat/extra-food-whatsapp

## Resumo da Execução

Parser passou a extrair itens extras além da refeição principal. Quando o utilizador diz "comi o almoço + 100g de purê extra", o webhook cria um `DietLog` separado para o item extra (nome: "Almoço - Purê de batata"), que aparece na secção de registros extras do dashboard e é somado ao total diário.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Schema de extracção | OK | `ExtraDietItemSchema` + `extraItems` em `DietExtractionSchema` |
| 2. Parser: tool schema + prompt | OK | `extraItems` no `EXTRACTION_TOOL` + regra no `STATIC_SYSTEM_PROMPT` |
| 3. Webhook: processar extraItems | OK | Loop cria `DietLog` separado por extra |

## Verificação

- lint: N/A
- build: **PASS** (`npm run build`)
- types: **PASS** (`npx tsc --noEmit` em cada passo)
- tests: **PASS** (22/22 testes passam)

## Ficheiros Modificados

- `src/schemas/extraction.schema.ts` — `ExtraDietItemSchema`, `ExtraDietItem` type, campo `extraItems` em `DietExtractionSchema`
- `src/agents/parser.agent.ts` — `extraItems` no `EXTRACTION_TOOL`, regra no `STATIC_SYSTEM_PROMPT`
- `src/routes/webhook.ts` — bloco para criar `DietLog` por cada item em `result.extraItems`

## Próximos Passos

- Merge para main e deploy em produção
