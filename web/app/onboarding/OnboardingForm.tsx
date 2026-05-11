"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitOnboarding, type MealInput } from "@/lib/actions";
import { Plus, Trash2, Sparkles } from "lucide-react";

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

  const canGenerateMacros =
    !!profile.weightKg && !!profile.heightCm && !!profile.age;

  const generateMacros = () => {
    const w = Number(profile.weightKg);
    const h = Number(profile.heightCm);
    const a = Number(profile.age);
    const bmr =
      profile.sex === "masculino"
        ? 10 * w + 6.25 * h - 5 * a + 5
        : 10 * w + 6.25 * h - 5 * a - 161;
    const tdee = Math.round(bmr * 1.55);
    const goalLower = profile.goal.toLowerCase();
    const totalCalories =
      goalLower.includes("emagrec")
        ? Math.round(tdee * 0.85)
        : goalLower.includes("força") || goalLower.includes("manter")
        ? tdee
        : Math.round(tdee * 1.1);
    const totalProtein = Math.round(w * 2.2);
    const perMealCalories = Math.round(totalCalories / meals.length);
    const perMealProtein = Math.round(totalProtein / meals.length);
    setMeals(meals.map((meal) => ({ ...meal, targetCalories: perMealCalories, targetProtein: perMealProtein })));
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

  const inputClass =
    "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-orange-500/50";
  const labelClass = "text-xs text-slate-500 mb-1 block";
  const sectionTitleClass =
    "text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2";

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Secção 1: Perfil */}
      <div className="space-y-4">
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
      <div className="space-y-4">
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
      <div className="space-y-4">
        <p className={sectionTitleClass}>Refeições Diárias</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-600">
            Adicione as suas refeições habituais com os valores alvo de macros.
          </p>
          <button
            type="button"
            onClick={generateMacros}
            disabled={!canGenerateMacros}
            title={!canGenerateMacros ? "Preencha peso, altura e idade primeiro" : "Distribuir macros automaticamente pelas refeições"}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-orange-500/40 text-orange-400 bg-orange-500/10 hover:bg-orange-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Sugerir macros
          </button>
        </div>

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

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

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
