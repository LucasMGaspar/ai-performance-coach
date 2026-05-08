# Plano: Observabilidade com Langfuse
Data: 2026-05-08
Branch: feat/langfuse-observability

## Contexto

Três agentes instanciam o cliente Anthropic independentemente:
- `src/agents/parser.agent.ts` — `new Anthropic(...)` no constructor da classe
- `src/agents/diet.agent.ts` — `new Anthropic(...)` no constructor da classe
- `src/agents/onboarding.agent.ts` — `const anthropic = new Anthropic(...)` ao nível do módulo

Sem qualquer rastreio de latência, tokens, custo ou prompt cache hit/miss. Nenhuma variável Langfuse existe em `config.ts` ou `.env.example`.

## Objectivo

- Instalar `langfuse` como dependência
- Criar `src/lib/anthropic.ts` com cliente Anthropic centralizado, wrapped com `observeAnthropic` se `LANGFUSE_PUBLIC_KEY` e `LANGFUSE_SECRET_KEY` estiverem presentes
- Actualizar os três agentes para importar o cliente centralizado
- Adicionar variáveis opcionais a `config.ts` e `.env.example`
- Comportamento condicional: sem as env vars, o código funciona exactamente como antes

## Passos de Implementação

### Passo 1 — Instalar dependência

```bash
npm install langfuse
```

**Verificação:** `langfuse` aparece em `dependencies` no `package.json`.

---

### Passo 2 — Adicionar variáveis Langfuse ao `config.ts`

**Ficheiro:** `src/config.ts`

Adicionar ao `envSchema`:
```ts
LANGFUSE_PUBLIC_KEY: z.string().optional(),
LANGFUSE_SECRET_KEY: z.string().optional(),
LANGFUSE_HOST: z.string().optional(),
```

Adicionar ao objecto `config`:
```ts
langfusePublicKey: env.LANGFUSE_PUBLIC_KEY,
langfuseSecretKey: env.LANGFUSE_SECRET_KEY,
langfuseHost: env.LANGFUSE_HOST,
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 3 — Criar `src/lib/anthropic.ts`

**Ficheiro:** `src/lib/anthropic.ts` (novo)

```ts
import Anthropic from "@anthropic-ai/sdk";
import { observeAnthropic } from "langfuse";
import { config } from "../config";

const _baseClient = new Anthropic({ apiKey: config.anthropicApiKey });

export const anthropicClient: Anthropic =
  config.langfusePublicKey && config.langfuseSecretKey
    ? (observeAnthropic(_baseClient, {
        publicKey: config.langfusePublicKey,
        secretKey: config.langfuseSecretKey,
        ...(config.langfuseHost ? { baseUrl: config.langfuseHost } : {}),
      }) as unknown as Anthropic)
    : _baseClient;
```

O cast `as unknown as Anthropic` é necessário porque `observeAnthropic` devolve um proxy compatível mas com tipo ligeiramente diferente. O comportamento é idêntico.

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 4 — Actualizar `src/agents/parser.agent.ts`

**O que muda:**
- Remover `import Anthropic from "@anthropic-ai/sdk";`
- Adicionar `import Anthropic from "@anthropic-ai/sdk";` mantido apenas para os tipos (se necessário para `Anthropic.TextBlockParam`, `Anthropic.Tool`)
- Adicionar `import { anthropicClient } from "../lib/anthropic";`
- No constructor da classe: substituir `this.client = new Anthropic({ apiKey: config.anthropicApiKey });` por `this.client = anthropicClient;`
- Remover o import de `config` se já não for usado noutro lugar do ficheiro (verificar — `config.anthropicApiKey` era o único uso)

> Nota: o import de `Anthropic` ainda é necessário para os tipos `Anthropic.TextBlockParam`, `Anthropic.Tool`, etc. Manter o import mas apenas para tipos: `import type Anthropic from "@anthropic-ai/sdk";` — ou manter como está se isso causar problemas de tipagem com `this.client: Anthropic`.

Abordagem segura: manter `import Anthropic from "@anthropic-ai/sdk";` para os tipos e para o tipo de `this.client`. Apenas substituir a instanciação.

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 5 — Actualizar `src/agents/diet.agent.ts`

**O que muda:**
- Adicionar `import { anthropicClient } from "../lib/anthropic";`
- No constructor: substituir `this.client = new Anthropic({ apiKey: config.anthropicApiKey });` por `this.client = anthropicClient;`
- Remover `import { config } from "../config";` se já não usado (verificar — era só para `config.anthropicApiKey`)

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 6 — Actualizar `src/agents/onboarding.agent.ts`

**O que muda:**
- Adicionar `import { anthropicClient } from "../lib/anthropic";`
- Substituir `const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });` por `const anthropic = anthropicClient;`
- Remover `import Anthropic from "@anthropic-ai/sdk";` se já não usado para tipos neste ficheiro (verificar)
- Remover `import { config } from "../config";` se `config.anthropicApiKey` era o único uso

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 7 — Actualizar `.env.example`

**Ficheiro:** `.env.example`

Adicionar secção Langfuse:
```
# Observabilidade (opcional — só preencher se quiser rastreio Langfuse)
LANGFUSE_PUBLIC_KEY=""
LANGFUSE_SECRET_KEY=""
LANGFUSE_HOST=""
```

---

## Verificação Final

- [ ] `npm install` sem erros
- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] Sem `new Anthropic(...)` nos agentes (excepto em `src/lib/anthropic.ts`)
- [ ] Sem referências a `config.anthropicApiKey` fora de `src/lib/anthropic.ts`

## Fora de Escopo

- Configurar traces/spans manuais com Langfuse SDK (apenas o wrapper automático)
- Adicionar Langfuse ao agente nudge (verificar se usa Anthropic — parece não usar)
- Qualquer alteração à lógica dos agentes

## Package Manager

npm — `package-lock.json` na raiz. Instalar com `npm install langfuse`.
