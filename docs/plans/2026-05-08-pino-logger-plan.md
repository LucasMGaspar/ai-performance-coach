# Plano: Logger Estruturado com Pino
Data: 2026-05-08
Branch: chore/pino-logger

## Contexto

O projecto usa `console.log` e `console.error` em 8 ficheiros de `src/`. Em produção, esses logs são texto livre — impossível filtrar, sem correlação de userId/requestId, e com dados sensíveis expostos (e.g. `phone` em claro em `webhook.ts`).

Ficheiros afectados (9 ocorrências, 8 ficheiros):

| Ficheiro | Tipo | Sensível? |
|---|---|---|
| `src/agents/diet.agent.ts` | console.error | não |
| `src/agents/nudge.agent.ts` | console.error | não |
| `src/agents/onboarding.agent.ts` | console.log (debug) | não |
| `src/agents/parser.agent.ts` | console.error | não |
| `src/routes/webhook.ts` | console.log + console.error | **sim** — phone em claro |
| `src/server.ts` | console.error | não |
| `src/services/progression.service.ts` | console.error (x3) | não |
| `src/services/wapi.service.ts` | console.error | não |

**Excepção:** `src/config.ts` — `console.error` executado antes de qualquer módulo ser inicializado (validação de env vars no startup). Manter como está.

## Objectivo

- Logger singleton pino com redaction automática de campos sensíveis
- JSON em produção, pretty-print em desenvolvimento
- Substituir todos os `console.log`/`console.error` em `src/` (excepto `config.ts`)
- `phone` e `phoneNumber` nunca aparecem em claro nos logs

## Passos de Implementação

### Passo 1 — Instalar dependências

```bash
npm install pino
npm install --save-dev pino-pretty @types/pino
```

Nota: `pino-pretty` como devDependency é seguro porque só é carregado quando `NODE_ENV !== "production"` — em produção o transporte é `undefined`.

**Verificação:** `pino` em `dependencies`, `pino-pretty` em `devDependencies` no `package.json`.

---

### Passo 2 — Criar `src/lib/logger.ts`

**Ficheiro:** `src/lib/logger.ts` (novo)

```ts
import pino from "pino";
import { config } from "../config";

export const logger = pino({
  level: config.nodeEnv === "production" ? "info" : "debug",
  redact: {
    paths: ["phone", "phoneNumber", "apiKey", "token", "*.phone", "*.phoneNumber"],
    censor: "[REDACTED]",
  },
  transport:
    config.nodeEnv !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 3 — Actualizar `src/agents/`

**Ficheiros:** `diet.agent.ts`, `nudge.agent.ts`, `onboarding.agent.ts`, `parser.agent.ts`

Adicionar a cada um: `import { logger } from "../lib/logger";`

Substituições:

**diet.agent.ts (linha 90):**
```ts
// antes:
console.error("Erro no DietAgent:", err);
// depois:
logger.error({ err }, "diet agent error");
```

**nudge.agent.ts (linha 101):**
```ts
// antes:
console.error("nudgeAgent: nudgeType desconhecido:", _exhaustive);
// depois:
logger.error({ nudgeType: _exhaustive }, "nudgeAgent: nudgeType desconhecido");
```

**onboarding.agent.ts (linha 43):**
```ts
// antes:
console.log(`[extractJson] Model output:`, jsonStr);
// depois:
logger.debug({ output: jsonStr }, "extractJson model output");
```

**parser.agent.ts (linha 254):**
```ts
// antes:
console.error("parser.agent: erro ao processar mensagem —", err);
// depois:
logger.error({ err }, "parser.agent: erro ao processar mensagem");
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 4 — Actualizar `src/routes/webhook.ts`

**Ficheiro:** `src/routes/webhook.ts`

Adicionar: `import { logger } from "../lib/logger";`

**Linha 113 (onboarding info log):**
```ts
// antes:
console.log(`[Webhook] User ${phone} in onboarding. Text received: "${text}"`);
// depois:
logger.info({ phone }, "webhook: user in onboarding");
```

**Linha 115 (onboarding response log):**
```ts
// antes:
console.log(`[Webhook] Onboarding response for ${phone}: "${onboardingResponse}"`);
// depois:
logger.info({ phone }, "webhook: onboarding response sent");
```

**Linhas 287-291 (error block):**
```ts
// antes:
console.error("=== WEBHOOK ERROR ===");
console.error("Phone:", phone);
console.error("Message:", errMsg);
console.error("Stack:", errStack);
console.error("=====================");
// depois:
logger.error({ phone, message: errMsg, stack: errStack }, "webhook error");
```

Nota: `phone` vai para o objecto estruturado — pino redact ocultará automaticamente.

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 5 — Actualizar `src/server.ts` e `src/services/`

**Ficheiros:** `src/server.ts`, `src/services/progression.service.ts`, `src/services/wapi.service.ts`

Adicionar a cada um: `import { logger } from "../lib/logger";`

**server.ts (linha 42):**
```ts
// antes:
console.error("Erro fatal ao iniciar o servidor:", err);
// depois:
logger.fatal({ err }, "erro fatal ao iniciar o servidor");
```

**progression.service.ts (3 ocorrências, linhas 42, 95, 147):**
```ts
// padrão — antes:
console.error("[ProgressionService] Error updating PR:", error);
// depois:
logger.error({ error }, "ProgressionService: erro ao actualizar PR");

// antes:
console.error("[ProgressionService] Error updating streak:", error);
// depois:
logger.error({ error }, "ProgressionService: erro ao actualizar streak");

// antes:
console.error("[ProgressionService] Error updating consistency score:", error);
// depois:
logger.error({ error }, "ProgressionService: erro ao actualizar consistency score");
```

**wapi.service.ts (linha 29):**
```ts
// antes:
console.error(
  `wapi: erro ao enviar mensagem — status ${response.status}`,
  await response.text().catch(() => "")
);
// depois:
logger.error(
  { status: response.status, body: await response.text().catch(() => "") },
  "wapi: erro ao enviar mensagem"
);
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] `grep -r "console\." src/ --include="*.ts" | grep -v "src/config.ts"` — nenhum resultado
- [ ] `src/config.ts` ainda usa `console.error` (excepção mantida)

## Fora de Escopo

- Adicionar `requestId`/`traceId` por request (correlação de logs) — P2
- Adicionar `userId` ao contexto por request (async local storage) — P2
- Alterar logs em `web/` (Next.js — setup diferente)
- `pino-pretty` configuração de formato avançado

## Package Manager

npm — `package-lock.json` na raiz.
