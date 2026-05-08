# Análise Técnica — AI Performance Coach
Data: 2026-05-08
Escopo: backend (`src/`), schema Prisma, frontend Next.js (`web/`), docs e fluxos n8n.

---

## 1. Visão Geral do Sistema

O projeto é um *accountability coach* via WhatsApp para um protocolo de 80 dias. Stack:

- **Backend:** Fastify 5 + TypeScript 6, Node 20, Prisma 7 (Postgres/Supabase), Upstash Redis (sessões), Anthropic Claude Sonnet 4.5, Groq Whisper (transcrição), w-api.app (gateway WhatsApp), n8n para cron de nudges.
- **Frontend:** Next.js 16 + React 19 + Tailwind 4 + Recharts (dashboard glassmorphism mobile-first).
- **Domínios:** ingestão de mensagem (texto/áudio) → parser estruturado (Zod) → persistência (Workout/Diet/CheckIn) → feedback (regras determinísticas + Claude para perguntas).

A separação macro está bem feita: `agents/`, `services/`, `routes/`, `schemas/`, `db/`, `middleware/`. O hot-path é `routes/webhook.ts` que orquestra Whisper → Parser → roteamento por `type` → Coach/Diet → wapi.

---

## 2. Pontos Fortes

**Estruturação do parser com structured output + Zod.** O `parser.agent.ts` é o ponto mais maduro. Usa `discriminatedUnion` em Zod (`workout | diet | checkin | question | unknown`), prompt caching de 3 blocos (instruções fixas + catálogo + perfil dinâmico) e regra de negócio aplicada *após* a extração (`applyWeightPerSideRule`). Isso é exatamente o padrão correto: LLM extrai, código valida e aplica regras de domínio.

**Cache de prompt no Anthropic.** A separação dos blocos com `cache_control: { type: "ephemeral" }` para system prompt + catálogo é a forma certa de reduzir custo/latência (≥2× mais barato em tokens cacheados).

**Determinismo onde possível.** O Coach Agent (`analyzeWorkout`) é puro TypeScript — Double Progression e RPE são regras fixas, sem LLM. Isto reduz custo, latência e variância em decisões críticas. Excelente princípio aplicado.

**Segurança da rota interna de nudge.** `timingSafeEqual` com pré-checagem de tamanho evita timing leak e exceções de buffer.

**Webhook nunca devolve 5xx.** Bom padrão para webhook de provider terceiro — evita retries em cascata do w-api.

**Idempotência leve no User.** `prisma.user.upsert` por `phoneNumber` no início do webhook permite auto-registo seguro.

**Frontend bem desacoplado.** `web/lib/data.ts` agrega o dashboard num único `Promise.all`. Heatmap e progressão calculados in-memory a partir de queries indexadas.

---

## 3. Problemas de Arquitetura e Engenharia

### 3.1. Webhook síncrono no caminho crítico

`routes/webhook.ts` faz, sequencialmente, dentro do request HTTP do w-api:

1. `prisma.user.upsert`
2. (se áudio) download + descriptografia + Whisper Groq (~1–3 s)
3. Anthropic Claude Sonnet 4.5 (~1–4 s)
4. Loop de exercícios → `findMany` do catálogo a cada exercício (N queries) + `workoutLog.create` + `updatePR` + `analyzeWorkout`
5. `progressionService.updateStreak` → faz mais queries
6. `wapiService.sendTextMessage`

Isto roda dentro do handler do webhook. Tempo total realista: **3–8 s** para texto, **5–12 s** para áudio. O w-api tem timeouts agressivos e tende a re-entregar payload se não receber 200 rápido — você não tem proteção contra isto.

**Risco crítico:** mensagens duplicadas serão processadas duas vezes (criação dupla de WorkoutLog) porque não existe idempotência por `messageId`.

### 3.2. Falta de idempotência nas mensagens

O `WApiMessagePayload` não captura o `messageId` (você só usa `sender.id`, `msgContent`, `fromMe`, `instanceId`). Um retry do provider re-executará todo o pipeline. Para um sistema de tracking (treinos, dieta), isto é **dado corrompido silenciosamente**.

### 3.3. Autenticação fraca do webhook

A constante `webhookAuthHook` em `middleware/webhook-auth.ts` **existe mas não é registada** no `routes/webhook.ts`. A única verificação é `body.instanceId === config.wapiInstanceId`, que é um valor previsível em logs/tráfego e que **não é segredo**. Qualquer pessoa que conheça o `instanceId` pode injectar payloads.

O w-api envia HMAC nos headers; você deveria estar validando esse HMAC com `WEBHOOK_SECRET` (que existe no `.env` mas só aparece no middleware desativado).

### 3.4. Resolução do exercício é frágil

Em dois sítios (`webhook.ts` e `parser.agent.ts`) há *fuzzy match* manual com `String.includes` bidirecional contra `name` e cada `alias`. Problemas:

- Falsos positivos: "agachamento" casa "agachamento livre" e "agachamento búlgaro" — o primeiro `find` ganha.
- Fallback **silencioso para `catalog[0]`** (Supino Reto!) quando não há match, o que vai gravar exercícios errados como Supino Reto. O usuário não sabe, o coach progride o que não devia.
- Catálogo é re-buscado por `findMany` dentro do loop de exercícios, sem cache, no webhook.

O parser tem cache (1h em memória), mas o webhook não usa o cache do parser — refaz a query.

### 3.5. Acoplamento direto entre webhook e múltiplos agentes

O webhook conhece detalhes de Workout/Diet/Checkin, faz inserts diretos, calcula `volume`, decide PR e streak. É um *God controller*. À medida que tipos de mensagem crescerem (treinos compostos, supersets, suplementos, hidratação, fotos, vídeos), este switch vai inchar.

### 3.6. Onboarding com chamadas Claude redundantes e sem cache

`onboarding.agent.ts` faz **uma chamada Claude por step de extração** (perfil, experiência, calorias, refeições), cada uma sem prompt caching, sem JSON mode, sem tool use. Cada step usa um prompt one-shot improvisado e depende de regex (` ```json ... ``` `) para extrair JSON. Se o Claude responder fora do padrão, `JSON.parse` explode (apesar do try não capturar isto, o erro escala).

Pior: `extractJson` tem `console.log(model output)` — vaza dados de utilizador para stdout em prod.

### 3.7. `coachAgent.analyzeWorkout` — regra de progressão com bugs sutis

```ts
const previous = logs[0]; // treino mais recente anterior
const volumeChange = ((current.volume - previous.volume) / previous.volume) * 100;
```

`logs[0]` é o **mais recente**, que pode ser **a sessão atual** ou uma sessão arbitrária se for o mesmo dia. A mensagem diz "vs treino anterior" mas pode estar comparando contra a própria sessão de hoje. A `getLast3Workouts` não filtra por `date < today`. Resultado: feedback de progressão ruidoso e em alguns casos enganoso.

Adicionalmente:
- Sugestão `weightKg * 1.025` com `Math.round` ignora o incremento mínimo realista (2.5 kg para barra olímpica, 5 kg em halter, 1 kg em isolação) — sugere coisas como "70.875 → 71".
- Não diferencia exercício composto vs isolado, equipamento, ou faixa de reps.

### 3.8. `progressionService.updateStreak` quebra com fuso horário

Comparação `(now - lastLog) / 86400000` arredondada com `Math.floor`. Se o user treina às 23h um dia e às 8h do dia seguinte, `diffInDays === 0` e o streak não incrementa. Se treina às 0h e às 23h59 do dia seguinte, `diffInDays === 0` igualmente. Streak deveria comparar **dias-civis em fuso do utilizador**, não horas.

### 3.9. `consistencyScore` calculado em dois lugares

`progressionService.updateConsistencyScore` (backend) e `web/lib/data.ts` (`calculatedScore`) duplicam a lógica. Já há divergência: o backend persiste, o frontend ignora a coluna e recalcula. Inconsistência matemática garantida.

### 3.10. Singletons com estado em memória

`ParserAgent.catalogCache` quebra com >1 réplica (cada pod tem cache próprio). Para um sistema com 1 pod isso é OK; em escala vira inconsistência durante 1h após mudar o catálogo. Use Redis para cache compartilhado.

### 3.11. Falta de testes, observabilidade e tracing

Não vi testes (`*.test.ts`/`*.spec.ts` ausentes). Para um sistema agentic com regras de negócio (regra "de cada lado", PR, streak, fuso), isto é dívida técnica alta. Não há também:

- Tracing (OpenTelemetry / Langfuse / Helicone) para rastrear cada chamada LLM com latência, tokens, custo, prompt cache hit, JSON parse OK/fail.
- Métricas (taxa de fallback, taxa de `unknown`, ratio de PR detectado).
- Logging estruturado consistente (mistura de `console.log`, `console.error`, `request.log`, `fastify.log`).

### 3.12. Frontend expõe userId em URL pública

`/dashboard/[userId]` sem autenticação. Qualquer um com o `userId` (cuid) vê o dashboard inteiro. Há um `ShareButton` que sugere isso ser intencional (compartilhamento), mas não há dashboard *autenticado* para o próprio utilizador. Risco de privacy by design.

### 3.13. Pequenos cheiros

- `// @ts-ignore — prisma generate necessário` espalhado em ~10 arquivos. Após `prisma generate` numa pipeline, isto deveria ser removido.
- `query-check.ts`, `query-diet.ts`, `delete-daniel.ts`, `delete-users.ts`, `test-anthropic.ts`, `test-onboarding.ts` na raiz — scripts ad-hoc, fora do `scripts/`, alguns com nomes de produção (`delete-daniel.ts`).
- `server.log` commitado/deixado na raiz.
- `web/postinstall` faz `cp ../prisma/schema.prisma` — frágil e quebra em CI/Vercel se a estrutura mudar; o correto é `prisma` separado por app ou um shared package.
- Sem `eslint`/`prettier`/`husky` no backend.
- `tsconfig` sem `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — perderia bugs como `response.content[0].type` (acesso sem checagem).

---

## 4. Engenharia de IA — Onde a IA está "genérica"

Hoje o sistema usa Claude para **extrair** (parser) e **conversar pontualmente** (diet question, onboarding). Isso é correto. O coach em si usa apenas heurística simples. O resultado é uma experiência funcional mas pouco "especialista" — o coach não traz insights, não personaliza por atleta, não detecta padrões, não corrige forma, não periodiza.

### 4.1. Coach é uma string template

`analyzeWorkout` devolve sempre `"Registrado! Supino: 80kg × 8 × 4 (volume: 2560kg)\n↑ Volume subiu X%..."`. Isto é o que tornaria o produto genérico. Um atleta após 20 dias quer:

- "Tu plateauaste no supino — terça o RPE foi 9 com 80×8, hoje foi 9.5 com o mesmo. Provavelmente fadiga acumulada do treino de ontem. Sugiro um deload de 10% na próxima sessão e foco em pausa peitoral."
- "Tua proteína média de 7 dias está em 130 g (alvo 170 g). Os dias com déficit foram terça e quinta — ambos sem registo de almoço. Queres que adicione um lembrete às 13h?"
- "PR no terra hoje! Mas o intervalo entre tentativas caiu de 4 min para 2 min — pode ter limitado a carga máxima. Para o próximo PR attempt, descansa 4–5 min."

Nada disto requer fine-tuning — requer **contexto + RAG + reasoning explícito + tool use + memória**.

### 4.2. RAG é só "últimos 3 logs"

`rag.service.ts` é, na prática, queries SQL básicas. Não há embeddings, semântica, recuperação por intenção, ou agregação histórica. Para um produto de coach, o "R" deveria recuperar: histórico do exercício (10–20 sessões), padrões de RPE, dias de descanso, correlações com check-in (sono ruim → volume cai), refeições nos dias de treino, comentários em `rawInput`.

### 4.3. Prompt do parser não usa tool use

Hoje você pede "responde APENAS com JSON" e usa regex/parser. **A forma correta no SDK Anthropic é `tools` com `input_schema` JSON-Schema** (gerado de Zod via `zod-to-json-schema`) e `tool_choice: { type: "tool", name: "extract" }`. Isto:

- Garante JSON válido (Anthropic valida o schema antes de devolver).
- Elimina o regex de strip de ` ```json `.
- Reduz tokens de saída.
- Permite o modelo "raciocinar" no pre-text sem poluir o JSON.

### 4.4. Sem persona técnica nem rubrica

Os system prompts são curtos e descritivos ("você é um assistente de extração"). Falta:

- **Persona de domínio**: "Você é coach de força e condicionamento certificado, com formação em CSCS/NSCA, periodização linear e ondulatória..." — não para floreio, para fixar o vocabulário técnico (RPE, %1RM, tonelagem, mesociclo, PWO, MV, MRV).
- **Rubrica de raciocínio**: cadeia explícita "1. olha histórico do exercício; 2. compara RPE; 3. detecta plateau (3+ sessões sem progressão); 4. sugere intervenção".
- **Few-shot examples** para casos limítrofes ("supino com 35kg de cada lado em barra olímpica...", "comi marmita do dia, +- 600 kcal").

### 4.5. Onboarding não é um agente, é um state machine bobo

Cada step pergunta uma coisa, faz um Claude call de extração, valida e avança. O ideal para conversas estruturadas é **Anthropic tool use com slot filling**: um agente único com tools `register_profile`, `set_targets`, `add_meals`, `confirm`, e o modelo decide quando chamar. Você ganha capacidade de o user dar tudo de uma vez ("sou Lucas, 25 anos, masculino, 80kg, 178cm, intermediário, hipertrofia") e pular múltiplos steps.

### 4.6. Falta de evals

Sem dataset de mensagens reais com extração esperada. Sem métricas de:

- Acurácia do parser (% de mensagens onde `type` está correto).
- Acurácia do `exerciseName` resolvido vs catalog.
- Taxa de queda em `unknown`.
- Drift quando trocar o modelo.

Sem evals, qualquer mudança de prompt ou modelo é cega.

---

## 5. Roadmap de Melhorias Priorizado

### P0 — Correção de risco (1–2 dias)

1. **Idempotência por `messageId`.** Capturar `body.messageId` (ou hash de `phone+timestamp+conteúdo`), gravar em Redis com TTL 24h. Se já existe, devolve 200 sem reprocessar. Se não, processa.
2. **HMAC do webhook.** Ativar `webhookAuthHook` (ou validar HMAC do header conforme docs do w-api). Remover dependência só do `instanceId`.
3. **Async processing.** Webhook devolve 200 em <100 ms e enfileira o trabalho. Opções:
   - Mais simples: `setImmediate(async () => { ... })` + Redis lock por phone para serializar mensagens do mesmo usuário.
   - Melhor: BullMQ no Upstash (Redis), worker separado.
4. **Eliminar fallback silencioso para `catalog[0]`.** Se não houver match, devolver "Não reconheci o exercício X — quer que eu adicione?". Isto evita corrupção de PR/progressão.
5. **`getLast3Workouts` filtrar `date < today` (ou `< now - margem`)** para o coach de fato comparar com o anterior.
6. **Streak por dia-civil em fuso do utilizador**, não por horas.
7. **Centralizar `consistencyScore`** numa função pura usada por backend e frontend (ou frontend só lê do backend).

### P1 — Engenharia de produção (3–5 dias)

8. **Tool use no parser**, com `zod-to-json-schema`, `tool_choice: { type: "tool" }`. Remove regex e estabiliza saída.
9. **Observabilidade.** Adicionar Langfuse ou Helicone (proxy do Anthropic SDK) — captura prompt, completion, latência, custo, cache hit/miss por agente. Custa ~5 min de integração e dá um superpoder operacional.
10. **Tracing OpenTelemetry no Fastify** (OTel auto-instrumentation) → Honeycomb/Tempo/Datadog. Permite ver onde os 5–12 s vão.
11. **Logger estruturado** (`pino` é nativo do Fastify) + redaction de `phoneNumber`. Eliminar `console.log` espalhados.
12. **Suite de tests** com Vitest:
    - Unit: `applyWeightPerSideRule`, `calculateTDEE`, `isConfirmation`, `generateProgressionSuggestion`, parser de "X de cada lado", PR/streak.
    - Integration: webhook end-to-end com Anthropic mocado e Prisma test DB.
    - Eval: dataset de 50–100 mensagens com `type` e `exerciseName` esperados; rodar sempre que mudar prompt/modelo.
13. **Remover `// @ts-ignore` após `prisma generate` no setup**, mover scripts ad-hoc para `scripts/`, apagar `server.log`, mover lógica de `web/postinstall` para um pacote partilhado (ou usar `prisma` no monorepo com workspaces).
14. **Auth no dashboard** (NextAuth + magic link no WhatsApp).
15. **Rate limiting** no webhook por phone (Upstash Rate Limit) — impede flood.

### P2 — IA mais especialista (1–3 semanas)

16. **Coach Agent v2 — agente Claude com tool use**:
    - Tools: `get_exercise_history(exercise, n)`, `get_diet_summary(days)`, `get_checkin_history(days)`, `detect_plateau(exercise)`, `compute_e1rm(weight, reps)`, `suggest_load(exercise)`, `explain_progression(exercise)`.
    - System prompt com persona de S&C coach + rubrica "olha histórico → identifica padrão → escolhe intervenção".
    - Output: 1–3 frases naturais, com 1 insight acionável; não recita números.
    - Roda **assíncrono** após o registo. A mensagem rápida ("Registrado! Supino...") devolve em <1 s; o insight chega ~3–5 s depois numa segunda mensagem WhatsApp.
17. **RAG real**:
    - Embed (OpenAI `text-embedding-3-small` ou Voyage) o `rawInput` + `notes` + observações do user em `pgvector` no Supabase.
    - Tool `search_user_notes(query)` para o agente recuperar contexto rico ("o usuário se queixou de dor no ombro semana passada").
    - Tool `compare_to_phase(metric, phase)` para comparar fase atual do protocolo vs início.
18. **Memória de longo prazo estruturada**: tabela `UserInsight` com `{type, content, evidence, createdAt}` que o agente escreve quando detecta padrão (ex: "user costuma falhar lanche às terças"). Lida em prompts subsequentes — "menos genérico" vem disto.
19. **E1RM (Epley/Brzycki)** persistido por exercício como métrica derivada — coach passa a falar em % de 1RM, não em kg cru. É a linguagem nativa de S&C e diferencia o produto de "qualquer chatbot".
20. **Periodização leve**: máquina de estado por mesociclo (acumulação 4 sem → intensificação 3 sem → deload 1 sem). Coach respeita a fase: na acumulação sugere +reps; na intensificação +carga; no deload reduz.
21. **Detecção de plateau e overreaching**: regra + tool. 3 sessões sem progresso de carga/volume → sugere deload. Sono <6 média de 3 dias + RPE crescente → alerta.
22. **Eval contínuo**: dataset versionado em `evals/` + `npm run eval` que roda parser e coach contra ground truth e devolve precisão. Rodar em CI a cada PR que mexe em prompt.
23. **Agente nutricional v2**: hoje chamadas Claude soltas. Migrar para tool use com `get_meal_targets`, `compare_to_today`, `suggest_meal(remaining_macros)`. Concisão WhatsApp + acionabilidade.
24. **Multimodal — fotos de marmita.** Anthropic suporta imagem; o `imageMessage` já aparece no `WApiMessagePayload`. Adicionar tool de "estimar macros da foto" (validar o intervalo com a meta diária).

### P3 — Diferenciação de produto

25. **Voz como output** (TTS curto via ElevenLabs/Cartesia) para o coach mandar áudio de feedback — fricção zero no WhatsApp.
26. **Relatório semanal automático** (Sunday digest) gerado pelo coach: tonelagem, PRs, aderência a macros, padrões detectados, plano da semana.
27. **Multi-tenant / coach humano em loop**: dashboard de admin onde um treinador real revisa insights do agente antes de enviar (modo HITL para os primeiros N usuários).

---

## 6. Resumo Executivo

O projeto está num estado raro: **fundação enxuta e correta** (Fastify, Zod, Prisma, prompt caching, regras determinísticas, separação webhook → parser → coach). Em ~1.500 LOC é mais limpo que muito MVP. O que impede o salto para "AI coach especialista" não é arquitetura — é:

1. **Risco operacional**: sem idempotência, sem HMAC, sem async, sem observabilidade. Em produção real com 50 usuários, vai começar a corromper dados silenciosamente.
2. **IA usada como stenographer**: extrai mas não raciocina. Coach é template; LLM não aparece onde mais agregaria (insight, plateau, periodização, memória).
3. **Falta de loop de melhoria**: sem evals, sem testes, sem métricas — qualquer iteração no prompt é fé.

Atacando P0 + 2–3 itens de P2 (Coach Agent v2 com tool use + RAG real + memória estruturada), a percepção do produto pula de "registrei meu treino" para "o coach percebeu algo que eu não tinha percebido". Esse é o momento em que o usuário começa a pagar.
