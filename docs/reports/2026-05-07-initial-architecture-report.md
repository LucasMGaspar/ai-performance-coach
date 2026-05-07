# Report: AI Performance Coach — Arquitectura Inicial
Data: 2026-05-07
Plano: docs/plans/2026-05-07-ai-performance-coach-plan.md
Branch: feat/initial-architecture

## Resumo da Execução

Backend completo implementado em TypeScript com 3 agentes de IA, 4 serviços,
schema Prisma com 5 modelos, webhook handler orquestrador e documentação de setup do n8n.

## Passos Executados

| Passo | Status | Notas |
|-------|--------|-------|
| 1. Foundation (npm, tsconfig, config) | OK | Zod v4 para validação de env vars |
| 2. Schema Prisma + seed exercícios | OK | Prisma 7 com prisma.config.ts (sem url no schema) |
| 3. Zod schemas de extracção | OK | discriminatedUnion com 4 tipos |
| 4. Servidor Fastify + auth middleware | OK | timingSafeEqual para timing-safe token check |
| 5a. Whisper service | OK | fetch nativo Node 20 |
| 5b. wapi.service | OK | REST client com fire-and-forget typing |
| 5c. Redis service (sessões) | OK | TTL 1800s, updatePendingContext |
| 6. Parser Agent | OK | Prompt caching 3 blocos, regra "de cada lado" |
| 7. Coach Agent + RAG service | OK | Double Progression determinística, sem Claude |
| 8. Webhook handler | OK | Orquestrador completo, nunca retorna 5xx |
| 9. Nudge Agent + rota interna | OK | timingSafeEqual com NUDGE_SECRET separado |
| 10. Docs n8n | OK | 3 workflows documentados com curl de teste |

## Verificação

- typecheck: PASS (`npx tsc --noEmit`)
- prisma validate: PASS
- build: N/A (requer `prisma generate` com DB conectada)
- tests: N/A (Fase 2)

## Ficheiros Criados (16 ficheiros TypeScript + 2 Prisma)

```
src/
├── config.ts                   — validação env vars (Zod)
├── server.ts                   — Fastify entry point
├── types/index.ts              — WApiMessagePayload, MessageType, NudgeType
├── db/client.ts                — Prisma singleton
├── schemas/extraction.schema.ts — Zod structured output schemas
├── middleware/webhook-auth.ts  — timing-safe token validation
├── routes/health.ts            — GET /health
├── routes/webhook.ts           — POST /webhook/whatsapp (orquestrador)
├── routes/nudge.ts             — POST /internal/nudge (cron endpoint)
├── agents/parser.agent.ts      — Claude + prompt caching + regra "de cada lado"
├── agents/coach.agent.ts       — Double Progression determinística
├── agents/nudge.agent.ts       — Lembrete proactivo por tipo
└── services/
    ├── whisper.service.ts      — OpenAI Whisper transcrição
    ├── wapi.service.ts         — w-api.app REST client
    ├── redis.service.ts        — Upstash Redis sessões
    └── rag.service.ts          — Queries de histórico Prisma
prisma/
├── schema.prisma               — 5 modelos: User, ExerciseCatalog, WorkoutLog, DietLog, DailyCheckIn
└── seed.ts                     — 10 exercícios base com aliases e barWeightKg
```

## Próximos Passos (para activar o sistema)

1. Criar projecto no Supabase e obter `DATABASE_URL` + `DIRECT_URL`
2. Copiar `.env.example` → `.env` e preencher todas as variáveis
3. `npx prisma migrate dev --name init` — criar tabelas na DB
4. `npx prisma db seed` — popular catálogo de exercícios
5. `npx prisma generate` — gerar tipos do client (remove os @ts-ignore)
6. Criar conta no w-api.app (trial 7 dias), configurar webhook para `https://<backend>/webhook/whatsapp`
7. Criar conta Upstash Redis e preencher as vars
8. Deploy do backend (Railway ou Render)
9. Configurar workflows n8n conforme `docs/n8n-setup.md`
10. Enviar primeira mensagem de teste no WhatsApp
