# Plano: Idempotência por messageId no webhook
Data: 2026-05-08
Branch: fix/webhook-idempotency

## Contexto

`src/routes/webhook.ts` não captura o `messageId` do payload da w-api. Se o provider re-entregar o mesmo payload (retry após timeout), todo o pipeline re-executa — criando WorkoutLogs, DietLogs e CheckIns duplicados silenciosamente.

Estado actual:
- `WApiMessagePayload` em `src/types/index.ts` não tem campo `messageId`.
- `RedisService` em `src/services/redis.service.ts` não tem métodos de idempotência.
- O webhook não faz qualquer verificação de duplicado.

## Objectivo

Antes de qualquer processamento, verificar no Redis se o `messageId` já foi tratado. Se sim, retornar 200 imediatamente sem re-executar o pipeline.

## Passos de Implementação

### Passo 1 — Adicionar `messageId` ao tipo `WApiMessagePayload`

**Ficheiro:** `src/types/index.ts`

Adicionar `messageId?: string` à interface `WApiMessagePayload`, logo após `event`:

```ts
export interface WApiMessagePayload {
  event: string;
  messageId?: string;      // ← adicionar
  instanceId: string;
  // ... resto inalterado
}
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 2 — Adicionar métodos de idempotência ao `RedisService`

**Ficheiro:** `src/services/redis.service.ts`

Adicionar dois métodos à classe `RedisService`:

```ts
private buildIdempotencyKey(id: string): string {
  return `msg:idempotency:${id}`;
}

async isMessageProcessed(id: string): Promise<boolean> {
  const key = this.buildIdempotencyKey(id);
  const val = await this.redis.get(key);
  return val !== null && val !== undefined;
}

async setMessageProcessed(id: string): Promise<void> {
  const key = this.buildIdempotencyKey(id);
  await this.redis.set(key, "1", { ex: 86400 }); // TTL 24h
}
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 3 — Verificação de idempotência no webhook

**Ficheiro:** `src/routes/webhook.ts`

Adicionar import de `createHash` do módulo `crypto` nativo do Node (sem nova dependência):

```ts
import { timingSafeEqual, createHash } from "crypto";
```

> Nota: `timingSafeEqual` já é importado indirectamente via `middleware/webhook-auth.ts`. No webhook, importar `createHash` directamente de `"crypto"`.

Após os guards de `instanceId` e `fromMe` (linha ~28), e **antes** do upsert do user, adicionar:

```ts
// Idempotência: evitar reprocessamento de retries do provider
const rawMessageId = body?.messageId;
const idempotencyKey = rawMessageId
  ? rawMessageId
  : createHash("sha256")
      .update(`${phone}:${JSON.stringify(body?.msgContent)}`)
      .digest("hex");

if (await redisService.isMessageProcessed(idempotencyKey)) {
  return reply.status(200).send({ ok: true });
}
```

E imediatamente antes do `return reply.status(200).send({ ok: true })` final (após `wapiService.sendTextMessage`), marcar como processado:

```ts
await redisService.setMessageProcessed(idempotencyKey);
return reply.status(200).send({ ok: true });
```

**Nota sobre o fallback:** quando `messageId` está ausente, usamos SHA256 de `phone + msgContent` (sem timestamp). Isso é suficiente para deduplicar retries do w-api (que chegam com o mesmo conteúdo em segundos), sem precisar de timestamp que variaria entre tentativas.

**Verificação:** `npx tsc --noEmit` sem erros. Comportamento: segunda entrega do mesmo payload devolve 200 sem criar registos duplicados.

---

### Nota sobre o `try/catch`

A verificação de idempotência fica **fora** do bloco `try/catch` existente, pois é uma guarda de entrada — se falhar (Redis indisponível), o erro sobe naturalmente e o webhook devolve 200 pelo handler de erro sem processar (comportamento seguro: melhor não processar do que duplicar).

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] Comportamento esperado: primeiro delivery processa normalmente; segundo delivery idêntico devolve 200 imediatamente sem criar registos

## Fora de Escopo

- Redis lock por phone para serializar mensagens concorrentes (issue separada — async processing)
- Rate limiting por phone (issue separada)
- Qualquer outra mudança além da idempotência

## Package Manager

npm — existe `package-lock.json` na raiz. Sem novas dependências (`crypto` é nativo do Node).
