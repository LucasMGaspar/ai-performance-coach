# Report: Parser Agent — tool use Anthropic
Data: 2026-05-08
Plano: docs/plans/2026-05-08-parser-tool-use-plan.md
Branch: feat/parser-tool-use

## Resumo da Execução

Migrado `src/agents/parser.agent.ts` para usar Anthropic tool use. O modelo é agora forçado a chamar `extract_message` com `tool_choice`, eliminando regex de strip, `JSON.parse` frágil e a necessidade de "Responda APENAS com JSON" no prompt. O SDK Anthropic valida o schema antes de devolver — output estruturado garantido.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Constante `EXTRACTION_TOOL` | OK | JSON Schema superset dos 5 tipos |
| 2. Simplificar `STATIC_SYSTEM_PROMPT` | OK | Removidos schemas inline + instrução JSON |
| 3. Actualizar `parseMessage` com tool use | OK | `toolBlock.input` em vez de `JSON.parse(cleaned)` |

## Verificação

- lint: N/A
- build: PASS
- types: PASS
- tests: N/A

## Ficheiros Modificados

- `src/agents/parser.agent.ts` — `EXTRACTION_TOOL` + prompt simplificado + tool use no `parseMessage`

## Próximos Passos

Próximo item P1: observabilidade com Langfuse ou Helicone (proxy do Anthropic SDK).
