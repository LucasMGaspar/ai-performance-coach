# Setup n8n — Workflows de Cron (Nudge Agent)

O n8n é usado APENAS para cron jobs. O caminho crítico de mensagens (WhatsApp → Backend)
não passa pelo n8n.

## Pré-requisitos

- Backend deployado com URL pública (ex: Railway, Render, VPS)
- `NUDGE_SECRET` configurado no `.env` do backend
- `userId` e `phoneNumber` do utilizador na DB (obtidos após primeiro login via WhatsApp)

---

## Workflow 1 — Lanche 17h

**Trigger:** Cron `0 17 * * *` (todos os dias às 17h)

**Node HTTP Request:**
```
Method: POST
URL: https://<seu-backend>/internal/nudge
Headers:
  Authorization: Bearer <NUDGE_SECRET>
  Content-Type: application/json
Body (JSON):
{
  "userId": "<id-do-utilizador>",
  "phoneNumber": "<numero-com-ddi>",
  "nudgeType": "diet",
  "mealLabel": "Lanche"
}
```

**O que faz:** Verifica se existe `DietLog` com meal contendo "Lanche" hoje.
Se não → envia mensagem de lembrete no WhatsApp.

---

## Workflow 2 — Treino 20h (dias úteis)

**Trigger:** Cron `0 20 * * 1-5` (segunda a sexta às 20h)

**Node HTTP Request:**
```
Method: POST
URL: https://<seu-backend>/internal/nudge
Headers:
  Authorization: Bearer <NUDGE_SECRET>
  Content-Type: application/json
Body (JSON):
{
  "userId": "<id-do-utilizador>",
  "phoneNumber": "<numero-com-ddi>",
  "nudgeType": "workout"
}
```

**O que faz:** Verifica se existe `WorkoutLog` hoje.
Se não → envia lembrete de treino no WhatsApp.

---

## Workflow 3 — Check-in 22h

**Trigger:** Cron `0 22 * * *` (todos os dias às 22h)

**Node HTTP Request:**
```
Method: POST
URL: https://<seu-backend>/internal/nudge
Headers:
  Authorization: Bearer <NUDGE_SECRET>
  Content-Type: application/json
Body (JSON):
{
  "userId": "<id-do-utilizador>",
  "phoneNumber": "<numero-com-ddi>",
  "nudgeType": "checkin"
}
```

**O que faz:** Verifica se existe `DailyCheckIn` hoje.
Se não → pede ao utilizador para registar humor, sono e energia.

---

## Como obter userId e phoneNumber

Após a primeira mensagem do utilizador no WhatsApp (onboarding manual):

```sql
-- No Supabase SQL Editor:
SELECT id, "phoneNumber" FROM users WHERE "phoneNumber" = '5511999999999';
```

O `phoneNumber` no sistema usa o formato internacional sem `+` (ex: `5511999999999`).

---

## Testar os workflows

Antes de activar o cron, testar manualmente com um nó "Execute once":

```bash
curl -X POST https://<seu-backend>/internal/nudge \
  -H "Authorization: Bearer <NUDGE_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<id>","phoneNumber":"<numero>","nudgeType":"diet","mealLabel":"Lanche"}'
```

Resposta esperada: `{ "sent": true }` ou `{ "sent": false }` (se já registado hoje).
