# Plano: Edição de Refeições no Dashboard
Data: 2026-05-11
Branch: feat/diet-edit-dashboard

## Contexto

A aba `/dashboard/[userId]/dieta` é um Server Component que lista `ScheduledMeal` em cards read-only.
O utilizador não consegue alterar nenhuma refeição pelo dashboard — tem de contactar suporte ou re-fazer o onboarding.

## Objectivo

Cada card de refeição passa a ter botão "Editar". Ao clicar, os campos ficam editáveis inline (sem modal separado). Ao guardar, Server Action actualiza o `ScheduledMeal` na DB e a página revalida.

## Modelo de dados

**`ScheduledMeal`** — campos editáveis: `mealName`, `scheduledTime`, `description`, `targetCalories`, `targetProtein`

## Passos de Implementação

---

### Passo 1 — Server Action `updateScheduledMeal`

**Ficheiro:** `web/lib/actions.ts`

Adicionar no fim do ficheiro:

```ts
export async function updateScheduledMeal(
  userId: string,
  mealId: string,
  data: {
    mealName: string;
    scheduledTime: string;
    description: string;
    targetCalories: number;
    targetProtein: number;
  }
): Promise<void> {
  await prisma.scheduledMeal.update({
    where: { id: mealId },
    data: {
      mealName: data.mealName,
      scheduledTime: data.scheduledTime,
      description: data.description,
      targetCalories: data.targetCalories,
      targetProtein: data.targetProtein,
    },
  });
  revalidatePath(`/dashboard/${userId}/dieta`);
}
```

**Verificação:** `cd web && npx tsc --noEmit` sem novos erros.

---

### Passo 2 — Client Component `MealCard`

**Ficheiro:** `web/app/dashboard/[userId]/dieta/MealCard.tsx` *(NOVO)*

Client Component com dois modos: view e edit.

```tsx
"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Trash2, Pencil, X, Check } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { deleteDietLog, updateScheduledMeal } from "@/lib/actions";

type DietLog = { id: string; meal: string; calories: number; protein: number; notes: string | null };

type Props = {
  userId: string;
  meal: {
    id: string;
    mealName: string;
    scheduledTime: string;
    description: string;
    targetCalories: number;
    targetProtein: number;
  };
  log: DietLog | undefined;
};

export function MealCard({ userId, meal, log }: Props) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    mealName: meal.mealName,
    scheduledTime: meal.scheduledTime,
    description: meal.description,
    targetCalories: meal.targetCalories,
    targetProtein: meal.targetProtein,
  });
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      await updateScheduledMeal(userId, meal.id, {
        ...fields,
        targetCalories: Number(fields.targetCalories),
        targetProtein: Number(fields.targetProtein),
      });
      setEditing(false);
    });
  };

  const handleCancel = () => {
    setFields({
      mealName: meal.mealName,
      scheduledTime: meal.scheduledTime,
      description: meal.description,
      targetCalories: meal.targetCalories,
      targetProtein: meal.targetProtein,
    });
    setEditing(false);
  };

  const inputClass =
    "bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-orange-500/50 w-full";

  if (editing) {
    return (
      <GlassCard>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-slate-500 mb-1 block">Nome</label>
              <input
                value={fields.mealName}
                onChange={(e) => setFields((f) => ({ ...f, mealName: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Horário</label>
              <input
                type="time"
                value={fields.scheduledTime}
                onChange={(e) => setFields((f) => ({ ...f, scheduledTime: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Kcal alvo</label>
              <input
                type="number"
                min={0}
                value={fields.targetCalories}
                onChange={(e) => setFields((f) => ({ ...f, targetCalories: Number(e.target.value) }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Proteína (g)</label>
              <input
                type="number"
                min={0}
                value={fields.targetProtein}
                onChange={(e) => setFields((f) => ({ ...f, targetProtein: Number(e.target.value) }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-1 block">Descrição</label>
              <input
                value={fields.description}
                onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1 text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-3 py-1.5 rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-50"
            >
              <Check className="w-3 h-3" />
              {isPending ? "A guardar..." : "Guardar"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-slate-500 border border-white/10 px-3 py-1.5 rounded-lg hover:text-slate-300 transition-colors"
            >
              <X className="w-3 h-3" />
              Cancelar
            </button>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {log ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <Circle className="w-4 h-4 text-slate-700" />
            )}
            <h3 className="font-bold text-white">{meal.mealName}</h3>
          </div>
          <p className="text-xs text-slate-400">
            {meal.scheduledTime} — {meal.description}
          </p>
          <div className="flex gap-2 pt-1">
            <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">
              {meal.targetCalories} kcal
            </span>
            <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">
              {meal.targetProtein}g prot
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {log && (
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter bg-emerald-500/10 px-2 py-1 rounded">
              Realizado
            </span>
          )}
          <div className="flex gap-1">
            <button
              onClick={() => setEditing(true)}
              className="text-slate-600 hover:text-orange-400 transition-colors p-1"
              title="Editar refeição"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {log && (
              <form action={deleteDietLog.bind(null, userId, log.id)}>
                <button
                  type="submit"
                  className="text-slate-600 hover:text-red-400 transition-colors p-1"
                  title="Excluir registro"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
```

**Verificação:** `cd web && npx tsc --noEmit` sem erros.

---

### Passo 3 — Actualizar `dieta/page.tsx`

**Ficheiro:** `web/app/dashboard/[userId]/dieta/page.tsx`

**O que muda:**
1. Adicionar import do `MealCard`
2. Substituir o bloco de render dos `scheduledMeals.map(...)` pelo `<MealCard>` component
3. Manter toda a lógica existente (redirect, extra logs, dica IA)

**Substituição no map:**
```tsx
import { MealCard } from "./MealCard";

// Substituir scheduledMeals.map(...) por:
{scheduledMeals.map((meal: any) => {
  const log = dietLogsToday.find(
    (log) => log.meal.toLowerCase().trim() === meal.mealName.toLowerCase().trim()
  );
  return (
    <MealCard key={meal.id} userId={userId} meal={meal} log={log} />
  );
})}
```

Remover os imports de `CheckCircle2`, `Circle`, `Trash2` e `deleteDietLog` se ficarem sem uso após a substituição. O `deleteDietLog` passa a ser usado dentro do `MealCard`.

**Verificação:** `cd web && npx tsc --noEmit` e `npm run build` sem erros.

---

## Verificação Final

- [ ] `cd web && npx tsc --noEmit` — sem erros
- [ ] `cd web && npm run build` — passa
- [ ] Abrir `/dashboard/{userId}/dieta` → cards mostram ícone de lápis
- [ ] Clicar lápis → card expande com campos editáveis
- [ ] Alterar kcal alvo e guardar → valor actualizado no card imediatamente
- [ ] Cancelar → volta ao estado original sem alterar DB

## Fora de Escopo

- Edição de `targetCarbs` e `targetFat` (campos opcionais — suficiente com kcal + proteína)
- Adicionar ou remover refeições no dashboard (feature separada)
- Validação de macros totais vs TDEE

## Package Manager

`web/package-lock.json` → npm
