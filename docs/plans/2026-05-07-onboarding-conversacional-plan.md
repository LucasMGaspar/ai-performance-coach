# Plano: Onboarding Conversacional via WhatsApp
Data: 2026-05-07
Branch: feat/onboarding-conversacional

## Contexto

Hoje, quando um utilizador envia a primeira mensagem, o webhook faz `upsert` com apenas `phoneNumber` e `name` (pushName). Não há colecta de perfil, metas ou ficha de dieta. O parser agent tenta processar a mensagem como se o utilizador já estivesse configurado, o que não faz sentido.

O que falta:
- Campos de perfil no `User`: `sex`, `experienceLevel`, `goal`, `onboarded`
- Modelo `ScheduledMeal` para a ficha de dieta do utilizador
- Estado de onboarding na sessão Redis
- Agente de onboarding que guia a conversa passo a passo
- Routing no webhook: se `!user.onboarded` → onboarding agent, senão → fluxo normal

## Objectivo

Quando um utilizador envia a primeira mensagem ao WhatsApp, o Coach Agent recolhe via conversa natural:
1. Nome (confirmação ou pushName)
2. Idade, sexo, peso, altura
3. Nível de experiência e objetivo
4. Calorias e proteína alvo (calculadas via TDEE Mifflin-St Jeor ou personalizadas)
5. Ficha de dieta: refeições com horário, descrição e macros estimadas

Ao terminar, guarda tudo na DB (`User` + `ScheduledMeal`), marca `onboarded = true` e transita para o fluxo normal de tracking.

## Conversa esperada

```
Utilizador: "Oi"

IA: "Olá! 👋 Sou o teu coach de performance pessoal para os próximos 80 dias.
     Vou precisar de alguns dados para personalizar o teu protocolo.
     Qual é o teu nome?"

→ "Lucas"

IA: "Lucas, qual é a tua idade, sexo, peso e altura?
     (ex: 25 anos, masculino, 80kg, 178cm)"

→ "25 anos, homem, 80kg, 178cm"

IA: "Qual é o teu nível de experiência no treino e o teu objetivo principal?
     (ex: intermédio, hipertrofia)"

→ "intermédio, quero ganhar massa"

IA: "Com base nos teus dados, calculei:
     • TDEE: ~2.800 kcal/dia
     • Meta sugerida: 3.100 kcal (surplus +10%) | 176g proteína (2.2g/kg)
     
     Confirmas estas metas ou queres ajustar?"

→ "pode ser"

IA: "Agora a tua dieta. Descreve as tuas refeições diárias:
     quantas são, a que horas, e o que comes em cada uma.
     (ex: 8h aveia com whey, 13h frango com arroz, 20h salmão com batata doce)"

→ "8h aveia com leite e whey, 12h frango com arroz e feijão, 16h iogurte grego, 20h carne com batata doce"

IA: "Estimei as macros de cada refeição:
     
     🕗 08:00 — Pequeno-almoço
        Aveia + leite + whey → ~450kcal | 40g prot | 55g carbs | 8g fat
     
     🕛 12:00 — Almoço
        Frango + arroz + feijão → ~650kcal | 52g prot | 75g carbs | 10g fat
     
     🕓 16:00 — Lanche
        Iogurte grego → ~180kcal | 20g prot | 15g carbs | 4g fat
     
     🕗 20:00 — Jantar
        Carne + batata doce → ~550kcal | 48g prot | 40g carbs | 12g fat
     
     Total: ~1.830kcal | 160g prot
     (Nota: ligeiramente abaixo da meta — considera aumentar as porções)
     
     Está correcto ou queres ajustar alguma refeição?"

→ "está bom"

IA: "Perfil configurado! 🎯
     
     Protocolo de 80 dias iniciado.
     
     A partir de hoje:
     • Regista os teus treinos aqui (ex: 'Supino 80kg x 8 x 4')
     • Vou-te enviar mensagem nos horários das refeições para confirmares
     • Check-in diário de bem-estar quando quiseres
     
     Bora começar 💪"
```

## Passos de Implementação

### Passo 1 — Schema: User + ScheduledMeal
**Ficheiros:** `prisma/schema.prisma`

**O que muda:**
- Adicionar ao `User`: `sex String?`, `experienceLevel String?`, `goal String?`, `onboarded Boolean @default(false)`
- Adicionar novo modelo:
```prisma
model ScheduledMeal {
  id             String  @id @default(cuid())
  userId         String
  mealName       String
  scheduledTime  String  // "08:00"
  description    String
  targetCalories Float
  targetProtein  Float
  targetCarbs    Float?
  targetFat      Float?

  user User @relation(fields: [userId], references: [id])

  @@index([userId])
  @@map("scheduled_meals")
}
```
- Adicionar `scheduledMeals ScheduledMeal[]` ao model `User`

**Verificação:** `npx prisma migrate dev --name onboarding` sem erros + `npx prisma generate`

---

### Passo 2 — Types + Redis session
**Ficheiros:** `src/types/index.ts`, `src/services/redis.service.ts`

**O que muda em `src/types/index.ts`:**
- Adicionar interface `OnboardingData`:
```typescript
export interface OnboardingData {
  name?: string;
  age?: number;
  sex?: "masculino" | "feminino";
  weightKg?: number;
  heightCm?: number;
  experienceLevel?: "iniciante" | "intermédio" | "avançado";
  goal?: string;
  targetCalories?: number;
  targetProtein?: number;
  mealsRaw?: string; // texto bruto descrevendo refeições
  meals?: Array<{
    mealName: string;
    scheduledTime: string;
    description: string;
    targetCalories: number;
    targetProtein: number;
    targetCarbs?: number;
    targetFat?: number;
  }>;
}

export type OnboardingStep =
  | "welcome"
  | "profile"
  | "experience_goal"
  | "calories_confirm"
  | "meals"
  | "meals_confirm"
  | "complete";
```

**O que muda em `src/services/redis.service.ts`:**
- Adicionar a `ConversationSession`:
```typescript
onboardingStep?: OnboardingStep;
onboardingData?: OnboardingData;
```
- Adicionar método `updateOnboarding(phone, step, data)` que persiste o estado

**Verificação:** `npx tsc --noEmit` sem erros

---

### Passo 3 — Onboarding Agent
**Ficheiros:** `src/agents/onboarding.agent.ts` (novo)

**O que implementa:**

Método principal: `handle(userId, phone, text): Promise<string>`

Lógica por step:
- **`welcome`** → gera mensagem de boas-vindas + pergunta nome. Avança para `profile`
- **`profile`** → usa Claude para extrair `{ name, age, sex, weightKg, heightCm }` do texto livre. Avança para `experience_goal`
- **`experience_goal`** → extrai `{ experienceLevel, goal }`. Calcula TDEE (Mifflin-St Jeor × 1.55 × 1.10 para surplus). Avança para `calories_confirm`
- **`calories_confirm`** → se utilizador confirma, avança para `meals`. Se pede ajuste, extrai valores novos
- **`meals`** → pede descrição de todas as refeições de uma vez. Avança para `meals_confirm`
- **`meals_confirm`** → usa Claude para estimar macros de cada refeição, apresenta resumo. Se confirma → `complete`
- **`complete`** → salva `User` fields + cria `ScheduledMeal` entries + marca `onboarded = true`. Retorna mensagem de boas-vindas final

Função TDEE (sem Claude, cálculo local):
```typescript
function calculateTDEE(weightKg: number, heightCm: number, age: number, sex: string): number {
  // Mifflin-St Jeor BMR
  const bmr = sex === "masculino"
    ? (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5
    : (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  return Math.round(bmr * 1.55); // moderadamente activo
}
```

Extracção de macros das refeições: Claude recebe lista de refeições descritas em texto livre e retorna JSON com macros estimadas por refeição.

**Verificação:** `npx tsc --noEmit` sem erros

---

### Passo 4 — Webhook: routing por estado de onboarding
**Ficheiros:** `src/routes/webhook.ts`

**O que muda:**
Após o `user = await prisma.user.upsert(...)`, adicionar antes do bloco parser:

```typescript
// Routing: onboarding vs fluxo normal
if (!user.onboarded) {
  const onboardingResponse = await onboardingAgent.handle(user.id, phone, text);
  await wapiService.sendTextMessage(phone, onboardingResponse);
  return reply.status(200).send({ ok: true });
}
```

Se `user.onboarded === true`, cai no fluxo normal existente (parser → coach → log).

**Verificação:** `npx tsc --noEmit` sem erros

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npx prisma migrate dev` aplica migração sem erros
- [ ] Comportamento manual: enviar "Oi" para o WhatsApp → receber mensagem de boas-vindas
- [ ] Completar onboarding completo → `user.onboarded = true` na DB + `ScheduledMeal` criadas
- [ ] Após onboarding, registar treino normalmente → fluxo normal funciona

## Fora de Escopo

- Crons/nudges nos horários das refeições (será implementado em tarefa separada)
- Edição do perfil pós-onboarding via WhatsApp
- Onboarding via formulário web
- Validação de macros: se utilizador diz algo impossível, a IA aceita (sem validação hard)
- Suporte a múltiplos idiomas

## Package Manager

**npm** — sem lockfile presente no repo (package.json existe, node_modules presentes). Usar `npm install <pkg>` e `npm run <script>`.
