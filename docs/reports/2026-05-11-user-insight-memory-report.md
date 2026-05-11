# Report: UserInsight — Memória de Longo Prazo do Coach
Data: 2026-05-11
Plano: docs/plans/2026-05-11-user-insight-memory-plan.md
Branch: feat/user-insight-memory

## Resumo da Execução

Tabela `UserInsight` adicionada ao schema Prisma. Coach tem agora memória persistente entre sessões: lê insights activos no início de cada análise (`get_user_insights`) e escreve novos padrões quando os detecta (`save_insight`). Upsert por tipo garante sem duplicados.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. UserInsight no schema + relação em User | OK | prisma generate passou; db push requer acesso manual |
| 2. getActiveInsights + upsertInsight no rag.service | OK | upsertInsight desactiva anterior antes de criar novo |
| 3. Tools + system prompt no coach | OK | 8 tools totais; prompt inicia com get_user_insights obrigatório |

## Verificação

- lint: N/A
- build: PASS
- types: PASS
- tests: **22/22 PASS**

## Ficheiros Modificados

- `prisma/schema.prisma` — model UserInsight + relação insights[] em User
- `src/services/rag.service.ts` — interface UserInsightRecord + getActiveInsights + upsertInsight
- `src/agents/coach.agent.ts` — tools get_user_insights + save_insight + system prompt actualizado

## Atenção — Comando Necessário

Antes de deployar, correr contra a DB de produção (Supabase):
```bash
npx prisma db push
npx prisma generate
```

## Próximos Passos

Todas as melhorias do roadmap Opus sem schema change estão feitas. Restam: dashboard auth (NextAuth), RAG com pgvector, periodização por mesociclo, evals.
