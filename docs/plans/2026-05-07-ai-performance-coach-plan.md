# Plano: AI Performance Coach — Protocolo 80 Dias
Data: 2026-05-07
Branch: feat/initial-architecture

---

## Contexto

Projecto greenfield. Sistema de accountability pessoal via WhatsApp que usa agentes de IA para
transformar mensagens de voz e texto desestruturadas em dados técnicos de treino e dieta.

O utilizador envia áudios como "fiz supino com 35kg de cada lado, 3 séries de 10" e o sistema
regista, analisa progressão e responde com feedback personalizado.

---

## Objectivo

Backend funcional em TypeScript com 3 agentes de IA operacionais:
- **Parser Agent** — extrai dados estruturados de treino/dieta via Zod + Claude structured output
- **Coach Agent** — analisa progressão dos últimos 3 treinos e sugere carga com base em RPE
- **Nudge Agent** — triggered por cron (n8n), envia lembretes se refeições/treino não forem registados

Verificação: utilizador envia áudio de treino no WhatsApp → sistema responde com dados registados
e comparação com semana anterior em < 5 segundos.

---

## Estrutura do Projecto

```
ai-performance-coach/
├── src/
│   ├── server.ts                   # entry point Fastify
│   ├── config.ts                   # validação de env com Zod
│   ├── db/
│   │   └── client.ts               # Prisma client singleton
│   ├── routes/
│   │   ├── webhook.ts              # POST /webhook/whatsapp
│   │   └── health.ts               # GET /health
│   ├── agents/
│   │   ├── parser.agent.ts         # extracção estruturada
│   │   ├── coach.agent.ts          # progressão + RAG
│   │   └── nudge.agent.ts          # mensagens proactivas
│   ├── services/
│   │   ├── whisper.service.ts      # transcrição OpenAI Whisper
│   │   ├── wapi.service.ts         # client w-api.app
│   │   ├── redis.service.ts        # Upstash Redis (sessões)
│   │   └── rag.service.ts          # pgvector similarity search
│   ├── schemas/
│   │   └── extraction.schema.ts    # Zod schemas do structured output
│   ├── middleware/
│   │   └── webhook-auth.ts         # validação token w-api
│   └── types/
│       └── index.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                     # catálogo de exercícios inicial
├── docs/
│   └── plans/
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Passos de Implementação

---

### Passo 1 — Setup do Projecto (Foundation)

**Ficheiros:** `package.json`, `tsconfig.json`, `.env.example`, `src/config.ts`

**O que fazer:**

Inicializar projecto Node.js com TypeScript e instalar dependências.

```
Dependências de produção:
- fastify + @fastify/formbody
- @anthropic-ai/sdk
- openai (para Whisper)
- @prisma/client
- @upstash/redis
- zod
- dotenv

Dependências de desenvolvimento:
- typescript
- @types/node
- tsx
- prisma
```

`tsconfig.json` com `"strict": true`, `"module": "ESNext"`, `"target": "ES2022"`.

`src/config.ts` — validar todas as env vars no startup com Zod. Se alguma falhar, processo termina
com mensagem clara. Variáveis necessárias:

```
DATABASE_URL          # Supabase PostgreSQL connection string
DIRECT_URL            # Supabase direct connection (para Prisma migrations)
ANTHROPIC_API_KEY
OPENAI_API_KEY        # para Whisper
WAPI_TOKEN            # token de autenticação w-api.app
WAPI_BASE_URL         # base URL da instância w-api
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
WEBHOOK_SECRET        # secret para validar requests do w-api
```

**Verificação:** `npx tsc --noEmit` sem erros após setup.

---

### Passo 2 — Schema Prisma + Supabase

**Ficheiros:** `prisma/schema.prisma`, `prisma/seed.ts`

**O que fazer:**

Definir os 5 modelos de dados:

```prisma
model User {
  id             String   @id @default(cuid())
  phoneNumber    String   @unique
  name           String?
  height         Float?        // cm
  weightKg       Float?        // kg actual
  age            Int?
  tdee           Float?        // kcal/dia
  targetCalories Float?
  targetProtein  Float?        // gramas/dia
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  workoutLogs  WorkoutLog[]
  dietLogs     DietLog[]
  checkIns     DailyCheckIn[]
}

model ExerciseCatalog {
  id          String   @id @default(cuid())
  name        String   @unique    // nome canónico: "Supino Reto"
  aliases     String[]            // ["bench press", "supino", "supino reto"]
  muscleGroup String
  equipment   String?             // "barra olímpica", "halteres", "máquina"
  barWeightKg Float?              // peso da barra em kg (ex: 20 para olímpica)

  workoutLogs WorkoutLog[]
}

model WorkoutLog {
  id         String   @id @default(cuid())
  userId     String
  exerciseId String
  date       DateTime @default(now())
  weightKg   Float               // peso TOTAL (barra + anilhas)
  reps       Int
  sets       Int
  rpe        Float?              // 1-10 percepção de esforço
  volume     Float               // weightKg * reps * sets
  rawInput   String?             // transcrição original para auditoria

  user       User            @relation(fields: [userId], references: [id])
  exercise   ExerciseCatalog @relation(fields: [exerciseId], references: [id])

  @@index([userId, exerciseId, date])
}

model DietLog {
  id       String   @id @default(cuid())
  userId   String
  meal     String               // "Café da manhã", "Lanche de Acém", "Jantar"
  calories Float
  protein  Float                // gramas
  carbs    Float?
  fat      Float?
  date     DateTime @default(now())
  notes    String?

  user     User @relation(fields: [userId], references: [id])

  @@index([userId, date])
}

model DailyCheckIn {
  id           String   @id @default(cuid())
  userId       String
  date         DateTime @default(now())
  mood         Int               // 1-10
  sleepQuality Int               // 1-10
  energyLevel  Int               // 1-10
  notes        String?

  user         User @relation(fields: [userId], references: [id])

  @@index([userId, date])
}
```

`prisma/seed.ts` — popular `ExerciseCatalog` com exercícios base de hipertrofia:
- Supino Reto (barra olímpica, 20kg)
- Supino Inclinado (barra olímpica, 20kg)
- Agachamento (barra olímpica, 20kg)
- Levantamento Terra (barra olímpica, 20kg)
- Desenvolvimento (barra olímpica, 20kg)
- Remada Curvada (barra olímpica, 20kg)
- Rosca Direta (barra EZ, 7kg)
- Tríceps Testa (barra EZ, 7kg)
- Leg Press (máquina, sem barra)
- Puxada Frente (máquina, sem barra)

**Verificação:** `npx prisma migrate dev --name init` sem erros + `npx prisma db seed` popula catálogo.

---

### Passo 3 — Zod Schemas de Extracção

**Ficheiros:** `src/schemas/extraction.schema.ts`

**O que fazer:**

Definir os schemas que o Claude deve respeitar no structured output. Estes schemas são a
**garantia de qualidade dos dados** — se a extracção falhar aqui, nada entra na DB.

```typescript
// Três tipos de input possíveis
WorkoutExtractionSchema: {
  type: "workout",
  exercises: [{
    exerciseName: string,        // nome como o utilizador disse
    weightPerSide: number?,      // se disse "de cada lado"
    totalWeight: number?,        // se disse peso total directamente
    reps: number,
    sets: number,
    rpe: number (1-10)?,
    notes: string?               // "quase morri na última"
  }]
}

DietExtractionSchema: {
  type: "diet",
  meal: string,                  // nome da refeição
  calories: number?,
  protein: number?,
  carbs: number?,
  fat: number?,
  description: string?           // "200g de frango com arroz"
}

CheckInExtractionSchema: {
  type: "checkin",
  mood: number (1-10)?,
  sleepQuality: number (1-10)?,
  energyLevel: number (1-10)?,
  notes: string?
}

UnknownSchema: {
  type: "unknown",
  message: string                // resposta para o utilizador
}
```

Usar `z.discriminatedUnion('type', [...])` para que o Claude saiba exactamente qual schema aplicar.

**Verificação:** unit tests dos schemas com `zod.parse()` — cenários válidos e inválidos.

---

### Passo 4 — Middleware de Autenticação + Servidor Fastify

**Ficheiros:** `src/middleware/webhook-auth.ts`, `src/routes/health.ts`, `src/server.ts`

**O que fazer:**

`webhook-auth.ts` — middleware Fastify que valida o token do w-api em cada request:

```typescript
// Comparação com timing-safe para evitar timing attacks
import { timingSafeEqual } from 'crypto'

// Header esperado: Authorization: Bearer <WEBHOOK_SECRET>
// Rejeitar com 401 se token inválido ou ausente
```

`src/server.ts` — inicializar Fastify com:
- Registo de rotas (`/health`, `/webhook/whatsapp`)
- Hook de content-type para JSON
- Error handler global que nunca expõe stack traces ao exterior
- Graceful shutdown (SIGTERM/SIGINT)

**Verificação:** `curl localhost:3000/health` retorna `{ status: "ok" }`. Request sem token ao
webhook retorna 401.

---

### Passo 5 — Serviços Base (Whisper + w-api + Redis)

**Ficheiros:** `src/services/whisper.service.ts`, `src/services/wapi.service.ts`,
`src/services/redis.service.ts`

**O que fazer:**

`whisper.service.ts`:
```typescript
// transcribeAudio(audioUrl: string): Promise<string>
// 1. Download do áudio da URL do w-api (fetch + buffer)
// 2. Enviar para OpenAI Whisper API (model: "whisper-1", language: "pt")
// 3. Retornar transcrição em texto
```

`wapi.service.ts`:
```typescript
// sendTextMessage(phone: string, message: string): Promise<void>
// sendAudioMessage(phone: string, audioUrl: string): Promise<void>
// Autenticação: Bearer token no header Authorization
// Base URL configurável via env WAPI_BASE_URL
```

`redis.service.ts` — gestão de sessões de conversa com TTL de 30 minutos:
```typescript
interface ConversationSession {
  phoneNumber: string
  pendingContext: {
    lastExercise?: string       // para resolver "de cada lado" em msg seguinte
    lastEquipment?: string
  }
  lastActivity: Date
}

// getSession(phone): Promise<ConversationSession | null>
// setSession(phone, session): Promise<void>  — TTL 1800s
// clearSession(phone): Promise<void>
```

**Verificação:** teste manual — enviar URL de áudio para Whisper e confirmar transcrição em PT.

---

### Passo 6 — Parser Agent

**Ficheiros:** `src/agents/parser.agent.ts`

**O que fazer:**

Este é o core do sistema. Usa Claude claude-sonnet-4-6 com **prompt caching** e **structured output (Zod)**.

Fluxo interno do agente:
1. Recebe transcrição em texto
2. Carrega contexto do utilizador (perfil + sessão Redis)
3. Carrega `ExerciseCatalog` completo (com aliases) — **cacheado** no system prompt
4. Claude extrai dados estruturados respeitando o Zod schema
5. **Regra crítica de negócio:** se `weightPerSide` presente → buscar `barWeightKg` do exercício
   no catálogo → `totalWeight = (weightPerSide * 2) + barWeightKg`
6. Resolver nome do exercício: fuzzy match contra `aliases` do catálogo
7. Retornar objecto validado pelo Zod

Estrutura do system prompt com prompt caching:
```typescript
system: [
  {
    type: "text",
    text: STATIC_INSTRUCTIONS,           // instruções fixas
    cache_control: { type: "ephemeral" } // cache hit em todos os requests
  },
  {
    type: "text",
    text: exerciseCatalogJson,           // catálogo serializado
    cache_control: { type: "ephemeral" } // cache hit — catálogo muda raramente
  },
  {
    type: "text",
    text: userProfileJson                // perfil do utilizador (sem cache — pode mudar)
  }
]
```

**Verificação:**
- Input "supino com 35kg de cada lado, 3 de 10" → output `{ type: "workout", exercises: [{ exerciseName: "Supino Reto", totalWeight: 90, reps: 10, sets: 3 }] }`
- Input "comi 200g de frango" → output `{ type: "diet", meal: "...", protein: 46 }`

---

### Passo 7 — Coach Agent

**Ficheiros:** `src/agents/coach.agent.ts`, `src/services/rag.service.ts`

**O que fazer:**

Analisa histórico e gera feedback de progressão.

`rag.service.ts` — queries pgvector para RAG:
```typescript
// Por agora: busca simples por exercício e userId sem embedding
// (pgvector fica para fase 2 com documentos de fisiologia)
// getLast3Workouts(userId, exerciseId): Promise<WorkoutLog[]>
// getDietSummaryToday(userId): Promise<{ calories: number, protein: number }>
```

`coach.agent.ts` — lógica de progressão:

**Double Progression:**
- Se utilizador completou todas as séries com RPE ≤ 8 → sugerir +1 rep na próxima sessão
- Se atingiu o topo do range de reps (ex: 12/12) → sugerir aumento de 2.5-5% na carga

**Resposta gerada pelo Coach:**
```
"Registado! Supino Reto: 90kg × 10 × 3 (volume: 2700kg)
↑ +2kg vs semana passada (+2.3% no volume)
RPE 9 — mantém carga na próxima sessão, foca na execução."
```

**Verificação:** com 3 workout_logs mockados na DB de dev, Coach retorna sugestão correcta de
progressão.

---

### Passo 8 — Webhook Handler (Orquestrador)

**Ficheiros:** `src/routes/webhook.ts`

**O que fazer:**

Orquestrar o fluxo completo ao receber uma mensagem do w-api:

```typescript
POST /webhook/whatsapp

1. Validar token (middleware)
2. Extrair payload: { phone, messageType, text?, audioUrl? }
3. Verificar se phone está autorizado (whitelist na tabela users)
4. Se audioUrl → whisper.transcribe(audioUrl) → texto
5. parserAgent.parse(text, userId, session) → ExtractionResult
6. Switch por tipo:
   - "workout" → salvar WorkoutLog → coachAgent.analyze() → resposta
   - "diet"    → salvar DietLog → feedback de macros do dia
   - "checkin" → salvar DailyCheckIn → resposta motivacional
   - "unknown" → resposta directa do Claude
7. wapi.sendTextMessage(phone, resposta)
8. Retornar 200 ao w-api (sempre, mesmo em erro — evitar reenvios)
```

Tratamento de erros: qualquer excepção interna → log + mensagem de fallback ao utilizador.
Nunca deixar o webhook retornar 5xx (o w-api vai reenviar e duplicar mensagens).

**Verificação:** end-to-end com mensagem de texto simulada (sem áudio) pelo Postman.

---

### Passo 9 — Nudge Agent

**Ficheiros:** `src/agents/nudge.agent.ts`, `src/routes/nudge.ts`

**O que fazer:**

`POST /internal/nudge` — endpoint chamado pelo n8n via cron (autenticado por IP whitelist ou
secret separado).

`nudge.agent.ts`:
```typescript
// checkAndNudge(userId: string, nudgeType: 'diet' | 'workout'): Promise<void>
// 1. Verificar se hoje já tem registo do tipo pedido na DB
// 2. Se não → gerar mensagem personalizada com Claude
// 3. Enviar via wapi.sendTextMessage
```

Exemplos de nudge:
- 17h00: verificar se `DietLog` tem "Lanche" registado hoje
- 20h00: verificar se `WorkoutLog` tem registo hoje (dias de treino)
- 22h00: pedir `DailyCheckIn` se não foi registado

**Verificação:** chamada manual ao endpoint retorna mensagem no WhatsApp do número configurado.

---

### Passo 10 — Configuração n8n (Documentação)

**Ficheiros:** `docs/n8n-setup.md`

**O que fazer:**

Documentar os 3 workflows n8n a criar manualmente:

```
Workflow 1 — Lanche 17h
Cron: 0 17 * * *
HTTP Request: POST https://<backend>/internal/nudge
Body: { userId: "<id>", nudgeType: "diet", mealLabel: "Lanche" }

Workflow 2 — Treino 20h (dias úteis)
Cron: 0 20 * * 1-5
HTTP Request: POST https://<backend>/internal/nudge
Body: { userId: "<id>", nudgeType: "workout" }

Workflow 3 — Check-in 22h
Cron: 0 22 * * *
HTTP Request: POST https://<backend>/internal/nudge
Body: { userId: "<id>", nudgeType: "checkin" }
```

---

## Variáveis de Ambiente (.env.example)

```env
# Supabase
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# IA
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""

# w-api.app
WAPI_TOKEN=""
WAPI_BASE_URL=""          # ex: https://api.w-api.app/v1/instances/XXXX

# Redis
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Segurança
WEBHOOK_SECRET=""         # gerado localmente: openssl rand -hex 32
NUDGE_SECRET=""           # secret para o endpoint /internal/nudge

# App
PORT=3000
NODE_ENV=development
```

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npx prisma migrate dev` sem erros
- [ ] `npx prisma db seed` popula catálogo
- [ ] `GET /health` retorna 200
- [ ] `POST /webhook/whatsapp` sem token retorna 401
- [ ] Envio de texto "supino 3x10 com 40kg" via Postman → registo correcto na DB + resposta
- [ ] Envio de áudio real no WhatsApp → transcrição + registo + feedback no chat
- [ ] `POST /internal/nudge` com nudgeType "diet" → mensagem chega no WhatsApp

---

## Fora de Escopo (Fase 1)

- pgvector com embeddings de documentos de fisiologia (RAG avançado — Fase 2)
- Dashboard web para visualização de progresso
- Suporte a múltiplos utilizadores (multi-tenant)
- Integração com balanças ou wearables
- Autenticação por QR Code / onboarding automatizado

---

## Package Manager

**npm** — sem lockfile existente, usar npm por ser o default do Node.js e não criar dependências
em runtime específico. Instrução: `npm install`.
