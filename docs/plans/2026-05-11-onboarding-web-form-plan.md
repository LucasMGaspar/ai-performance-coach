# Plano: Onboarding de Dieta via Web Form
Data: 2026-05-11
Branch: feat/onboarding-web-form

## Contexto

O onboarding actual guia o utilizador por WhatsApp através de 7 estados:
`welcome → profile → experience_goal → calories_confirm → meals → meals_confirm → complete`

Os estados `meals` e `meals_confirm` são os que causam dificuldade — o utilizador tem de descrever todas as refeições numa mensagem de texto, e o bot tenta estimar macros. O processo é longo e confuso.

O dashboard Next.js já existe em `web/`, acessível por `/dashboard/[userId]/`. Quando o utilizador não tem refeições configuradas (`scheduledMeals.length === 0`), a aba de dieta mostra apenas "Nenhum plano alimentar definido."

A `config.dashboardUrl` (env var `DASHBOARD_URL`) já existe e é usada no final do onboarding para enviar o link do dashboard.

## Objectivo

1. WhatsApp onboarding termina após confirmação de calorias — salva perfil, marca `onboarded: true`, envia link do dashboard
2. Quando utilizador acede à aba de dieta sem refeições configuradas → redirecionar para `/dashboard/[userId]/setup-dieta`
3. Nova página web `/setup-dieta` com formulário para criar N refeições (nome, horário, kcal, proteína)
4. Ao submeter o formulário, cria os `ScheduledMeal` na DB e redireciona para `/dieta`

## Modelo de dados relevante

**`ScheduledMeal`** (tabela `scheduled_meals`):
```prisma
id             String
userId         String
mealName       String    // "Café da manhã", "Almoço", etc
scheduledTime  String    // "08:00", "12:00"
description    String    // "Aveia com leite e whey"
targetCalories Float
targetProtein  Float
targetCarbs    Float?
targetFat      Float?
```

**`User.onboarded`** — boolean que controla se o utilizador completou o onboarding.

## Passos de Implementação

---

### Passo 1 — Simplificar onboarding WhatsApp

**Ficheiro:** `src/agents/onboarding.agent.ts`

**O que muda:**

1. No método `handle()`, remover os cases `"meals"` e `"meals_confirm"` do switch.

2. No método `handleCaloriesConfirm()`, após confirmação bem-sucedida (onde actualmente chama `await redisService.updateOnboarding(phone, "meals", updatedData)`), substituir por:
   - Salvar perfil do utilizador na DB (mesmo bloco do `handleMealsConfirm` actual)
   - Limpar estado Redis com `"complete"`
   - Retornar mensagem com link do dashboard

   **Bloco de save a colocar em `handleCaloriesConfirm` após validação:**
   ```ts
   // Salvar perfil na DB
   // @ts-ignore — prisma generate necessário
   await prisma.user.update({
     where: { id: userId },   // ATENÇÃO: userId não está disponível aqui — ver nota abaixo
     data: {
       name: updatedData.name ?? undefined,
       age: updatedData.age ?? undefined,
       weightKg: updatedData.weightKg ?? undefined,
       height: updatedData.heightCm ?? undefined,
       sex: updatedData.sex ?? undefined,
       experienceLevel: updatedData.experienceLevel ?? undefined,
       goal: updatedData.goal ?? undefined,
       targetCalories: updatedData.targetCalories ?? undefined,
       targetProtein: updatedData.targetProtein ?? undefined,
       onboarded: true,
     },
   });
   await redisService.updateOnboarding(phone, "complete", {});
   const dashboardUrl = `${config.dashboardUrl}/dashboard/${userId}`;
   return (
     `Perfil configurado! 🎯\n\n` +
     `*Protocolo de 80 dias iniciado.*\n\n` +
     `Para personalizar a sua dieta, aceda ao dashboard e configure as suas refeições:\n` +
     `${dashboardUrl}\n\n` +
     `A partir de hoje:\n` +
     `• Registre os seus treinos aqui _(ex: Supino 80kg x 8 x 4)_\n` +
     `• Envie o que você comeu para registrar a dieta\n` +
     `• Faça check-in de bem-estar quando quiser _(humor, sono, energia)_\n\n` +
     `Bora começar 💪`
   );
   ```

   > **Nota importante**: `handleCaloriesConfirm` actualmente recebe `(phone, text, data)` mas NÃO recebe `userId`. Adicionar `userId: string` como parâmetro e actualizar a chamada no `handle()` para passar `userId` (já disponível lá).

3. Remover os métodos privados `handleMeals()` e `handleMealsConfirm()` (dead code após a mudança).

4. No tipo `OnboardingStep` (em `src/types/index.ts` ou onde estiver definido), remover `"meals"` e `"meals_confirm"` se for um union type estrito. Se não quebrar a compilação, deixar — o importante é que o switch nunca chegue lá.

**Assinatura final de `handleCaloriesConfirm`:**
```ts
private async handleCaloriesConfirm(
  phone: string,
  userId: string,
  text: string,
  data: OnboardingData
): Promise<string>
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 2 — Server Action `saveDietPlan`

**Ficheiro:** `web/lib/actions.ts`

**O que muda:** adicionar o tipo `MealInput` e a função `saveDietPlan` ao ficheiro existente (que já tem `"use server"` no topo).

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

export async function saveDietPlan(userId: string, meals: MealInput[]): Promise<void> {
  await prisma.scheduledMeal.createMany({
    data: meals.map((m) => ({
      userId,
      mealName: m.mealName,
      scheduledTime: m.scheduledTime,
      description: m.description,
      targetCalories: m.targetCalories,
      targetProtein: m.targetProtein,
      targetCarbs: m.targetCarbs ?? null,
      targetFat: m.targetFat ?? null,
    })),
  });
  revalidatePath(`/dashboard/${userId}/dieta`);
}
```

**Verificação:** `cd web && npx tsc --noEmit` sem erros.

---

### Passo 3 — Redirect na página de dieta

**Ficheiro:** `web/app/dashboard/[userId]/dieta/page.tsx`

**O que muda:** após carregar `scheduledMeals`, se estiver vazio, redirecionar para `setup-dieta`.

Adicionar import no topo:
```ts
import { redirect } from "next/navigation";
```

Adicionar após a linha `const { scheduledMeals, dietLogsToday } = await getUserDashboard(userId);`:
```ts
if (scheduledMeals.length === 0) {
  redirect(`/dashboard/${userId}/setup-dieta`);
}
```

Remover o bloco `{scheduledMeals.length === 0 ? (<p>Nenhum plano...</p>) : (...)}` — substituir pelo render directo da lista (sem o condicional de "vazio", pois agora o redirect trata isso):
```tsx
{scheduledMeals.map((meal: any) => { ... })}
```

**Verificação:** `cd web && npx tsc --noEmit` sem erros.

---

### Passo 4 — Página setup-dieta (Server Component)

**Ficheiro:** `web/app/dashboard/[userId]/setup-dieta/page.tsx` *(NOVO)*

> Ler `node_modules/next/dist/docs/` para confirmar padrão de params async antes de escrever.

```tsx
import { DietSetupForm } from "./DietSetupForm";
import { Utensils } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SetupDietaPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="p-5 pb-24 max-w-lg mx-auto space-y-6">
        <div className="pt-4">
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Utensils className="text-orange-500 w-6 h-6" />
            Configurar Dieta
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Defina as suas refeições diárias com os macros alvo.
          </p>
        </div>

        <DietSetupForm userId={userId} />
      </div>
    </div>
  );
}
```

---

### Passo 5 — Formulário de setup (Client Component)

**Ficheiro:** `web/app/dashboard/[userId]/setup-dieta/DietSetupForm.tsx` *(NOVO)*

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDietPlan, type MealInput } from "@/lib/actions";
import { Plus, Trash2 } from "lucide-react";

const DEFAULT_MEALS: MealInput[] = [
  { mealName: "Café da manhã", scheduledTime: "08:00", description: "", targetCalories: 0, targetProtein: 0 },
  { mealName: "Almoço", scheduledTime: "12:00", description: "", targetCalories: 0, targetProtein: 0 },
  { mealName: "Jantar", scheduledTime: "20:00", description: "", targetCalories: 0, targetProtein: 0 },
];

export function DietSetupForm({ userId }: { userId: string }) {
  const [meals, setMeals] = useState<MealInput[]>(DEFAULT_MEALS);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const addMeal = () => {
    if (meals.length >= 8) return;
    setMeals([...meals, { mealName: "", scheduledTime: "", description: "", targetCalories: 0, targetProtein: 0 }]);
  };

  const removeMeal = (index: number) => {
    if (meals.length <= 1) return;
    setMeals(meals.filter((_, i) => i !== index));
  };

  const updateMeal = (index: number, field: keyof MealInput, value: string | number) => {
    const updated = [...meals];
    updated[index] = { ...updated[index], [field]: value };
    setMeals(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await saveDietPlan(userId, meals);
      router.push(`/dashboard/${userId}/dieta`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="text-xs text-slate-500 mb-1 block">Nome</label>
              <input
                type="text"
                placeholder="ex: Café da manhã"
                value={meal.mealName}
                onChange={(e) => updateMeal(i, "mealName", e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Horário</label>
              <input
                type="time"
                value={meal.scheduledTime}
                onChange={(e) => updateMeal(i, "scheduledTime", e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Calorias alvo</label>
              <input
                type="number"
                placeholder="ex: 450"
                min={0}
                value={meal.targetCalories || ""}
                onChange={(e) => updateMeal(i, "targetCalories", Number(e.target.value))}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Proteína alvo (g)</label>
              <input
                type="number"
                placeholder="ex: 40"
                min={0}
                value={meal.targetProtein || ""}
                onChange={(e) => updateMeal(i, "targetProtein", Number(e.target.value))}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-slate-500 mb-1 block">Descrição dos alimentos</label>
              <input
                type="text"
                placeholder="ex: Aveia com leite e whey"
                value={meal.description}
                onChange={(e) => updateMeal(i, "description", e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50"
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

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
      >
        {isPending ? "A guardar..." : "Guardar dieta"}
      </button>
    </form>
  );
}
```

**Verificação:** `cd web && npx tsc --noEmit` sem erros.

---

## Verificação Final

- [ ] `npx tsc --noEmit` (backend) — sem erros
- [ ] `cd web && npx tsc --noEmit` — sem erros
- [ ] `cd web && npm run build` — passa
- [ ] Fluxo WhatsApp: após confirmar calorias, utilizador recebe link do dashboard (sem pedir refeições)
- [ ] Aceder a `/dashboard/[userId]/dieta` sem refeições → redireciona para `/setup-dieta`
- [ ] Formulário: adicionar/remover refeições, preencher campos, submeter → cria ScheduledMeals
- [ ] Após submit → volta para `/dieta` com refeições listadas

## Fora de Escopo

- Edição de refeições existentes no dashboard (feature separada)
- Validação de macros no formulário (ex: kcal total vs meta do utilizador)
- Onboarding WhatsApp para utilizadores já existentes com dieta
- Reordenar refeições no formulário

## Package Manager

- Backend: `package-lock.json` na raiz → `npm`
- Web (`web/`): `package-lock.json` → `npm`
