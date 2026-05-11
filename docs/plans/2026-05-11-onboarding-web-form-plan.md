# Plano: Onboarding Completo via Web Form (Revisado)
Data: 2026-05-11
Branch: feat/onboarding-web-form

## Contexto

Fluxo actual: onboarding 100% via WhatsApp (7 estados de state machine).
Problema: utilizadores têm dificuldade a registar a dieta por chat.

Novo fluxo:
- Landing page vende o produto → utilizador adquire → acede a `/onboarding`
- Preenche tudo no formulário web: perfil + dieta
- Ao submeter: utilizador criado na DB, refeições salvas, bot WhatsApp envia mensagem de boas-vindas
- Utilizador é redirecionado para `/dashboard/{userId}`
- A partir daí usa o bot normalmente (dados já estão salvos)

O WhatsApp onboarding agent passa a ser apenas fallback (utilizadores que chegam pelo WhatsApp sem ter feito web form → recebem link).

## Modelo de dados relevante

**`User`** (campos do onboarding):
- `phoneNumber String @unique` — número WhatsApp (identificador)
- `name`, `age`, `sex`, `weightKg`, `height` (Float), `experienceLevel`, `goal`
- `targetCalories Float?`, `targetProtein Float?` — calculados via Mifflin-St Jeor × 1.55
- `onboarded Boolean @default(false)`

**`ScheduledMeal`** — `userId, mealName, scheduledTime, description, targetCalories, targetProtein, targetCarbs?, targetFat?`

## WAPI — Envio de mensagem a partir da web

O Server Action faz fetch directo ao WAPI REST API:
```
POST https://api.w-api.app/v1/message/send-text?instanceId={WAPI_INSTANCE_ID}
Authorization: Bearer {WAPI_TOKEN}
Body: { phone, message, delayMessage: 1 }
```
Requer `WAPI_TOKEN` e `WAPI_INSTANCE_ID` nas env vars do projecto `web/`.

## Fórmula TDEE (já existe em onboarding.agent.ts)
```
BMR = 10×peso + 6.25×altura - 5×idade ± 5/-161 (masc/fem)
TDEE = BMR × 1.55
targetCalories = TDEE × 0.85 (emagrecimento) | TDEE (força/manter) | TDEE × 1.1 (hipertrofia)
targetProtein = round(peso × 2.2)
```

---

## Passos de Implementação

### Passo 1 — Simplificar onboarding WhatsApp (fallback)

**Ficheiro:** `src/agents/onboarding.agent.ts`
**Ficheiro:** `src/types/index.ts`

**O que muda:**

Em `onboarding.agent.ts`, substituir toda a lógica de state machine por uma resposta simples:
- Qualquer mensagem de utilizador não-onboarded → enviar link do formulário web
- Não é necessário manter estados `profile`, `experience_goal`, `calories_confirm`, `meals`, `meals_confirm`
- O método `handle()` passa a ser: verificar se já tem dados completos; se não → enviar link

Novo `handle()` simplificado:
```ts
async handle(userId: string, phone: string, _text: string): Promise<string> {
  const registrationUrl = `${config.dashboardUrl}/onboarding`;
  return (
    `Para configurar o seu perfil, aceda ao formulário de registo:\n${registrationUrl}\n\n` +
    `Após preencher, receberá uma mensagem de boas-vindas aqui. 🎯`
  );
}
```

Em `src/types/index.ts`, simplificar `OnboardingStep` — remover `"meals"` e `"meals_confirm"`:
```ts
export type OnboardingStep =
  | "welcome"
  | "profile"
  | "experience_goal"
  | "calories_confirm"
  | "complete";
```
(Os estados que ficam não são usados activamente, mas manter não quebra nada.)

**Verificação:** `npx tsc --noEmit` na raiz sem erros.

---

### Passo 2 — Server Action `submitOnboarding`

**Ficheiro:** `web/lib/actions.ts`

**O que muda:** adicionar tipo `OnboardingInput` e função `submitOnboarding` ao ficheiro existente.

```ts
export type MealInput = {
  mealName: string;
  scheduledTime: string;
  description: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs?: number;
  targetFat?: number;
};

export type OnboardingInput = {
  phone: string;          // número WhatsApp (ex: "5511999998888")
  name: string;
  age: number;
  sex: "masculino" | "feminino";
  weightKg: number;
  heightCm: number;
  experienceLevel: "iniciante" | "intermédio" | "avançado";
  goal: string;           // "hipertrofia" | "emagrecimento" | "força" | "manter"
  targetCalories: number; // calculado no Server Action
  targetProtein: number;  // calculado no Server Action
  meals: MealInput[];
};

function calculateTDEE(weightKg: number, heightCm: number, age: number, sex: string): number {
  const bmr =
    sex === "masculino"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  return Math.round(bmr * 1.55);
}

export async function submitOnboarding(input: Omit<OnboardingInput, "targetCalories" | "targetProtein"> & { meals: MealInput[] }): Promise<{ userId: string }> {
  const tdee = calculateTDEE(input.weightKg, input.heightCm, input.age, input.sex);
  const goalLower = input.goal.toLowerCase();
  const targetCalories = goalLower.includes("emagrec") || goalLower.includes("perda")
    ? Math.round(tdee * 0.85)
    : goalLower.includes("força") || goalLower.includes("manter")
    ? tdee
    : Math.round(tdee * 1.1);
  const targetProtein = Math.round(input.weightKg * 2.2);

  // Criar ou actualizar utilizador por phoneNumber
  const user = await prisma.user.upsert({
    where: { phoneNumber: input.phone },
    update: {
      name: input.name,
      age: input.age,
      sex: input.sex,
      weightKg: input.weightKg,
      height: input.heightCm,
      experienceLevel: input.experienceLevel,
      goal: input.goal,
      targetCalories,
      targetProtein,
      onboarded: true,
    },
    create: {
      phoneNumber: input.phone,
      name: input.name,
      age: input.age,
      sex: input.sex,
      weightKg: input.weightKg,
      height: input.heightCm,
      experienceLevel: input.experienceLevel,
      goal: input.goal,
      targetCalories,
      targetProtein,
      onboarded: true,
    },
  });

  // Limpar refeições antigas (caso re-onboarding) e criar novas
  await prisma.scheduledMeal.deleteMany({ where: { userId: user.id } });
  if (input.meals.length > 0) {
    await prisma.scheduledMeal.createMany({
      data: input.meals.map((m) => ({
        userId: user.id,
        mealName: m.mealName,
        scheduledTime: m.scheduledTime,
        description: m.description,
        targetCalories: m.targetCalories,
        targetProtein: m.targetProtein,
        targetCarbs: m.targetCarbs ?? null,
        targetFat: m.targetFat ?? null,
      })),
    });
  }

  // Enviar mensagem de boas-vindas via WAPI
  const wapiToken = process.env.WAPI_TOKEN;
  const wapiInstanceId = process.env.WAPI_INSTANCE_ID;
  if (wapiToken && wapiInstanceId) {
    const welcomeMessage =
      `Olá, ${input.name}! 👋\n\n` +
      `O seu perfil foi configurado com sucesso. 🎯\n\n` +
      `A partir de agora:\n` +
      `• Registe os seus treinos aqui _(ex: Supino 80kg x 8 x 4)_\n` +
      `• Envie o que você comeu para registrar a dieta\n` +
      `• Faça check-in de bem-estar quando quiser _(humor, sono, energia)_\n\n` +
      `O seu dashboard pessoal:\n${process.env.NEXT_PUBLIC_APP_URL ?? ""}/dashboard/${user.id}\n\n` +
      `Bora começar 💪`;

    await fetch(
      `https://api.w-api.app/v1/message/send-text?instanceId=${wapiInstanceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${wapiToken}`,
        },
        body: JSON.stringify({ phone: input.phone, message: welcomeMessage, delayMessage: 1 }),
      }
    ).catch(() => {}); // Não falhar o onboarding se o WhatsApp falhar
  }

  revalidatePath(`/dashboard/${user.id}`);
  return { userId: user.id };
}
```

> **Nota sobre env vars na web:** adicionar ao `web/.env.local` (e ao `.env.example` se existir):
> - `WAPI_TOKEN` — mesmo valor do backend
> - `WAPI_INSTANCE_ID` — mesmo valor do backend
> - `NEXT_PUBLIC_APP_URL` — URL público do dashboard (ex: `https://app.minhaapp.com`)

**Verificação:** `cd web && npx tsc --noEmit` sem erros.

---

### Passo 3 — Página de onboarding (Server Component)

**Ficheiro:** `web/app/onboarding/page.tsx` *(NOVO)*

> Ler `node_modules/next/dist/docs/` para confirmar padrão de metadata e page exports antes de escrever.

```tsx
import { OnboardingForm } from "./OnboardingForm";
import { Dumbbell } from "lucide-react";

export const metadata = { title: "Configurar Perfil" };

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-cyan-500/5 blur-[100px] rounded-full" />
      </div>

      <div className="p-5 pb-16 max-w-lg mx-auto space-y-6">
        <div className="pt-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500/10 rounded-2xl mb-4">
            <Dumbbell className="text-orange-500 w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Configurar Perfil</h1>
          <p className="text-slate-500 text-sm mt-2">
            Preencha os seus dados para personalizar o protocolo de 80 dias.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </div>
  );
}
```

---

### Passo 4 — Formulário de onboarding (Client Component)

**Ficheiro:** `web/app/onboarding/OnboardingForm.tsx` *(NOVO)*

Formulário com 3 secções:
1. **Perfil pessoal** — telefone, nome, idade, sexo, peso, altura
2. **Treino & Objetivo** — nível de experiência (radio buttons), objetivo (radio buttons)
3. **Dieta** — lista dinâmica de refeições (igual ao DietSetupForm anterior)

Ao submeter:
- Chama `submitOnboarding(data)` com `useTransition`
- Recebe `{ userId }` de volta
- Faz `router.push(`/dashboard/${userId}`)``

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitOnboarding, type MealInput } from "@/lib/actions";
import { Plus, Trash2 } from "lucide-react";

const DEFAULT_MEALS: MealInput[] = [
  { mealName: "Café da manhã", scheduledTime: "08:00", description: "", targetCalories: 0, targetProtein: 0 },
  { mealName: "Almoço", scheduledTime: "12:00", description: "", targetCalories: 0, targetProtein: 0 },
  { mealName: "Jantar", scheduledTime: "20:00", description: "", targetCalories: 0, targetProtein: 0 },
];

type ProfileData = {
  phone: string;
  name: string;
  age: string;
  sex: "masculino" | "feminino";
  weightKg: string;
  heightCm: string;
  experienceLevel: "iniciante" | "intermédio" | "avançado";
  goal: string;
};

export function OnboardingForm() {
  const [profile, setProfile] = useState<ProfileData>({
    phone: "",
    name: "",
    age: "",
    sex: "masculino",
    weightKg: "",
    heightCm: "",
    experienceLevel: "intermédio",
    goal: "hipertrofia",
  });
  const [meals, setMeals] = useState<MealInput[]>(DEFAULT_MEALS);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Helpers de actualização
  const updateProfile = (field: keyof ProfileData, value: string) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const addMeal = () => {
    if (meals.length >= 8) return;
    setMeals([...meals, { mealName: "", scheduledTime: "", description: "", targetCalories: 0, targetProtein: 0 }]);
  };

  const removeMeal = (i: number) => {
    if (meals.length <= 1) return;
    setMeals(meals.filter((_, idx) => idx !== i));
  };

  const updateMeal = (i: number, field: keyof MealInput, value: string | number) => {
    const updated = [...meals];
    updated[i] = { ...updated[i], [field]: value };
    setMeals(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await submitOnboarding({
          phone: profile.phone,
          name: profile.name,
          age: Number(profile.age),
          sex: profile.sex,
          weightKg: Number(profile.weightKg),
          heightCm: Number(profile.heightCm),
          experienceLevel: profile.experienceLevel,
          goal: profile.goal,
          meals,
        });
        router.push(`/dashboard/${result.userId}`);
      } catch {
        setError("Erro ao guardar o perfil. Tente novamente.");
      }
    });
  };

  // Estilos reutilizáveis
  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50";
  const labelClass = "text-xs text-slate-500 mb-1 block";
  const sectionClass = "space-y-4";
  const sectionTitleClass =
    "text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Secção 1: Perfil */}
      <div className={sectionClass}>
        <p className={sectionTitleClass}>Perfil Pessoal</p>

        <div>
          <label className={labelClass}>Número WhatsApp</label>
          <input
            type="tel"
            placeholder="ex: 5511999998888 (com código do país)"
            value={profile.phone}
            onChange={(e) => updateProfile("phone", e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelClass}>Nome completo</label>
            <input
              type="text"
              placeholder="ex: Lucas Gaspar"
              value={profile.name}
              onChange={(e) => updateProfile("name", e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Idade</label>
            <input
              type="number"
              placeholder="ex: 25"
              min={14}
              max={80}
              value={profile.age}
              onChange={(e) => updateProfile("age", e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Sexo</label>
            <select
              value={profile.sex}
              onChange={(e) => updateProfile("sex", e.target.value as ProfileData["sex"])}
              className={inputClass}
            >
              <option value="masculino">Masculino</option>
              <option value="feminino">Feminino</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Peso (kg)</label>
            <input
              type="number"
              placeholder="ex: 80"
              min={30}
              max={250}
              step={0.1}
              value={profile.weightKg}
              onChange={(e) => updateProfile("weightKg", e.target.value)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Altura (cm)</label>
            <input
              type="number"
              placeholder="ex: 178"
              min={100}
              max={250}
              value={profile.heightCm}
              onChange={(e) => updateProfile("heightCm", e.target.value)}
              required
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Secção 2: Treino & Objetivo */}
      <div className={sectionClass}>
        <p className={sectionTitleClass}>Treino & Objetivo</p>

        <div>
          <label className={labelClass}>Nível de experiência</label>
          <div className="grid grid-cols-3 gap-2">
            {(["iniciante", "intermédio", "avançado"] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => updateProfile("experienceLevel", level)}
                className={`py-2.5 rounded-lg text-xs font-bold capitalize border transition-colors ${
                  profile.experienceLevel === level
                    ? "border-orange-500 bg-orange-500/10 text-orange-400"
                    : "border-white/10 bg-white/5 text-slate-500 hover:text-slate-300"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass}>Objetivo principal</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "hipertrofia", label: "Ganho Muscular" },
              { value: "emagrecimento", label: "Emagrecimento" },
              { value: "força", label: "Força" },
              { value: "manter", label: "Manter Peso" },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateProfile("goal", value)}
                className={`py-2.5 rounded-lg text-xs font-bold border transition-colors ${
                  profile.goal === value
                    ? "border-orange-500 bg-orange-500/10 text-orange-400"
                    : "border-white/10 bg-white/5 text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Secção 3: Dieta */}
      <div className={sectionClass}>
        <p className={sectionTitleClass}>Refeições Diárias</p>
        <p className="text-xs text-slate-600">
          Adicione as suas refeições habituais com os valores alvo de macros.
        </p>

        {meals.map((meal, i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Refeição {i + 1}
              </span>
              {meals.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMeal(i)}
                  className="text-slate-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={labelClass}>Nome</label>
                <input
                  type="text"
                  placeholder="ex: Café da manhã"
                  value={meal.mealName}
                  onChange={(e) => updateMeal(i, "mealName", e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Horário</label>
                <input
                  type="time"
                  value={meal.scheduledTime}
                  onChange={(e) => updateMeal(i, "scheduledTime", e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Calorias alvo</label>
                <input
                  type="number"
                  placeholder="ex: 450"
                  min={0}
                  value={meal.targetCalories || ""}
                  onChange={(e) => updateMeal(i, "targetCalories", Number(e.target.value))}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Proteína alvo (g)</label>
                <input
                  type="number"
                  placeholder="ex: 40"
                  min={0}
                  value={meal.targetProtein || ""}
                  onChange={(e) => updateMeal(i, "targetProtein", Number(e.target.value))}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Descrição dos alimentos</label>
                <input
                  type="text"
                  placeholder="ex: Aveia com leite e whey"
                  value={meal.description}
                  onChange={(e) => updateMeal(i, "description", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        ))}

        {meals.length < 8 && (
          <button
            type="button"
            onClick={addMeal}
            className="w-full border border-dashed border-white/20 rounded-xl py-3 text-sm text-slate-500 hover:text-slate-300 hover:border-white/30 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar refeição
          </button>
        )}
      </div>

      {/* Erro */}
      {error && (
        <p className="text-red-400 text-sm text-center">{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl transition-colors text-sm tracking-wide"
      >
        {isPending ? "A configurar o seu perfil..." : "Iniciar Protocolo de 80 Dias 🚀"}
      </button>
    </form>
  );
}
```

**Verificação:** `cd web && npx tsc --noEmit` sem erros.

---

## Verificação Final

- [ ] `npx tsc --noEmit` (backend raiz) — sem erros
- [ ] `cd web && npx tsc --noEmit` — sem erros
- [ ] `cd web && npm run build` — passa
- [ ] Aceder a `http://localhost:3000/onboarding` → formulário carrega
- [ ] Preencher e submeter → user criado na DB, meals criadas, redirect para dashboard
- [ ] Verificar DB: `User.onboarded = true`, `ScheduledMeal` criados com userId correcto
- [ ] WhatsApp: boas-vindas enviadas (requer WAPI env vars configuradas)
- [ ] Bot WhatsApp: utilizador que texta sem registo recebe link do formulário

## Fora de Escopo

- Multi-step wizard (wizard de 3 passos separados) — form de scroll único é suficiente para MVP
- Validação de macros totais vs. TDEE calculado
- Preview de TDEE em tempo real no formulário
- Edição de perfil após onboarding (feature separada)
- Página de sucesso dedicada após submit

## Variáveis de Ambiente Necessárias (web)

Adicionar a `web/.env.local`:
```
WAPI_TOKEN=...
WAPI_INSTANCE_ID=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Package Manager

- Backend: `package-lock.json` na raiz → `npm`
- Web (`web/`): `package-lock.json` → `npm`
