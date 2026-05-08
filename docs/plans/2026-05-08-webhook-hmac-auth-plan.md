# Plano: Autenticação HMAC no webhook
Data: 2026-05-08
Branch: fix/webhook-hmac-auth

## Contexto

O `webhookAuthHook` em `src/middleware/webhook-auth.ts` usa `Authorization: Bearer <secret>`.
A w-api.app não envia este header — activar o hook quebraria todos os deliveries em produção.

A única "autenticação" actual é `body.instanceId === config.wapiInstanceId`, que não é um segredo.

`config.webhookSecret` já existe (variável `WEBHOOK_SECRET` no `.env`), mas nunca é usado no webhook.

## Decisão de implementação

**Não usar `webhookAuthHook` (Bearer token)** — incompatível com o modelo de entrega da w-api.

**Implementar validação HMAC-SHA256 inline** no handler do webhook:
- Header esperado: `x-hub-signature-256` (padrão mais comum para webhooks, ex. GitHub)
- Formato do valor: `sha256=<hex>`
- Computado sobre `JSON.stringify(body)` com `config.webhookSecret`
- Estratégia: **soft validation** — rejeita se header presente mas inválido; fall-through se ausente (não quebra prod até confirmar header exacto da w-api)

> **Nota:** quando a w-api confirmar o nome exacto do header, basta mudar a constante `WAPI_SIGNATURE_HEADER` para o valor correcto e tornar a validação estrita (rejeitar se header ausente).

## Objectivo

- Injecção de payloads por terceiros com `instanceId` correcto passa a ser bloqueada
- `WEBHOOK_SECRET` passa a ser usado para validação criptográfica real
- Sem regressões em produção (soft mode)

## Passos de Implementação

### Passo 1 — Adicionar validação HMAC ao webhook

**Ficheiro:** `src/routes/webhook.ts`

Adicionar import de `createHmac` (junto ao `createHash` já importado):

```ts
import { createHash, createHmac } from "crypto";
```

Logo após o guard `body?.fromMe === true` e antes da extração do `phone`, adicionar:

```ts
// Autenticação HMAC — valida assinatura da w-api se header presente
const WAPI_SIGNATURE_HEADER = "x-hub-signature-256";
const receivedSig = request.headers[WAPI_SIGNATURE_HEADER] as string | undefined;
if (receivedSig) {
  const expectedSig = `sha256=${createHmac("sha256", config.webhookSecret)
    .update(JSON.stringify(body))
    .digest("hex")}`;
  const sigBuffer = Buffer.from(receivedSig);
  const expectedBuffer = Buffer.from(expectedSig);
  const sigMatch =
    sigBuffer.length === expectedBuffer.length &&
    timingSafeEqual(sigBuffer, expectedBuffer);
  if (!sigMatch) {
    return reply.status(200).send({ ok: true }); // 200 por convenção de webhook
  }
}
```

Adicionar import de `timingSafeEqual` ao import existente de `crypto`:

```ts
import { createHash, createHmac, timingSafeEqual } from "crypto";
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 2 — Remover import redundante do `timingSafeEqual` se existir

**Ficheiro:** `src/middleware/webhook-auth.ts`

Este ficheiro já importa `timingSafeEqual` de `"crypto"` para o hook Bearer — não tocar.
O webhook passa a usar o seu próprio import inline. Sem conflito.

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] Comportamento com header ausente: fluxo normal inalterado (soft mode)
- [ ] Comportamento com header correcto: fluxo normal
- [ ] Comportamento com header inválido: devolve 200 imediatamente sem processar

## Fora de Escopo

- Tornar a validação estrita (rejeitar se header ausente) — depende de confirmar o header exacto da w-api
- Substituir `JSON.stringify(body)` por raw body capture — melhoria futura se detectarmos divergência de assinatura
- Remover ou alterar `webhookAuthHook` — mantém-se como está (não é usado)

## Package Manager

npm — `package-lock.json` na raiz. Sem novas dependências (`crypto` é nativo do Node).
