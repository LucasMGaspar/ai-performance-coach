# Report: Observabilidade com Langfuse
Data: 2026-05-08
Plano: docs/plans/2026-05-08-langfuse-observability-plan.md
Branch: feat/langfuse-observability

## Resumo da Execução

Cliente Anthropic centralizado em `src/lib/anthropic.ts`. Os três agentes (parser, diet, onboarding) deixaram de instanciar `new Anthropic(...)` directamente e passam a importar `anthropicClient`. Variáveis Langfuse opcionais adicionadas a `config.ts` e `.env.example`.

**Desvio do plano:** `langfuse@3.38.20` não exporta `observeAnthropic` (apenas `observeOpenAI`). O wrapper automático não foi implementado — a infra (env vars, config, cliente centralizado) fica pronta para quando Langfuse adicionar suporte ao Anthropic SDK.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Instalar `langfuse` | OK | v3.38.20 |
| 2. Adicionar vars Langfuse a `config.ts` | OK | 3 campos opcionais |
| 3. Criar `src/lib/anthropic.ts` | OK | Cliente centralizado (sem wrapper — `observeAnthropic` inexistente) |
| 4. Actualizar `parser.agent.ts` | OK | `anthropicClient` importado; `config` removido |
| 5. Actualizar `diet.agent.ts` | OK | `anthropicClient` importado; `config` removido |
| 6. Actualizar `onboarding.agent.ts` | OK | `anthropicClient as anthropic` importado; `config` mantido (usado em `dashboardUrl`) |
| 7. Actualizar `.env.example` | OK | Secção Langfuse adicionada |

## Verificação

- lint: N/A
- build: PASS
- types: PASS
- tests: N/A

## Ficheiros Modificados

- `src/lib/anthropic.ts` — novo ficheiro, cliente centralizado
- `src/config.ts` — 3 env vars opcionais Langfuse
- `src/agents/parser.agent.ts` — usa `anthropicClient`
- `src/agents/diet.agent.ts` — usa `anthropicClient`
- `src/agents/onboarding.agent.ts` — usa `anthropicClient as anthropic`
- `.env.example` — secção Langfuse documentada

## Próximos Passos

P1 restantes: logger estruturado (pino + redaction de phoneNumber, remover console.log).
