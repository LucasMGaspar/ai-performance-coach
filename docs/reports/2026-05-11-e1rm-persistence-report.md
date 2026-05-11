# Report: E1RM Persistido por Exercício
Data: 2026-05-11
Plano: docs/plans/2026-05-11-e1rm-persistence-plan.md
Branch: feat/e1rm-persistence

## Resumo da Execução

Campo `e1rmKg Float?` adicionado ao schema `ExercisePR`. `updatePR` calcula e persiste Epley E1RM a cada novo PR. `rag.service.ts` expõe `getE1RMHistory` com E1RM calculado por sessão. Coach tem nova tool `get_e1rm_history` e system prompt actualizado para expressar cargas em %1RM.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. e1rmKg no schema ExercisePR | OK | prisma generate passou; db push requer acesso manual à DB |
| 2. e1rmKg em updatePR | OK | Epley calculado antes do upsert |
| 3. getE1RMHistory no rag.service | OK | Calcula E1RM de cada WorkoutLog on-the-fly |
| 4. get_e1rm_history tool + prompt | OK | Tool entre compute_e1rm e detect_plateau; prompt actualizado |

## Verificação

- lint: N/A
- build: PASS
- types: PASS
- tests: **22/22 PASS**

## Ficheiros Modificados

- `prisma/schema.prisma` — e1rmKg Float? em ExercisePR
- `src/services/progression.service.ts` — e1rmKg calculado e persistido em updatePR
- `src/services/rag.service.ts` — interface ExercisePRRecord + método getE1RMHistory
- `src/agents/coach.agent.ts` — tool get_e1rm_history + system prompt %1RM

## Atenção — Comando Necessário

Antes de deployar, correr contra a DB de produção (Supabase):
```bash
npx prisma db push
npx prisma generate
```

## Próximos Passos

Plano C: UserInsight — tabela de memória de longo prazo para o coach.
