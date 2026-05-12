"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitOnboarding, type MealInput } from "@/lib/actions";
import { Plus, Trash2, Calculator, X, Utensils } from "lucide-react";
import { FoodSearchInput } from "@/components/FoodSearchInput";

type MacroPreview = {
  bmr: number;
  tdee: number;
  targetCalories: number;
  targetProtein: number;
  goalLabel: string;
};

interface MealItem {
  id: string;
  name: string;
  quantity: number;
  unit: "g" | "un";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface EnhancedMealInput extends MealInput {
  items: MealItem[];
}

const DEFAULT_MEALS: EnhancedMealInput[] = [
  { mealName: "Café da manhã", scheduledTime: "08:00", description: "", items: [] },
  { mealName: "Almoço", scheduledTime: "12:00", description: "", items: [] },
  { mealName: "Jantar", scheduledTime: "20:00", description: "", items: [] },
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
  const [meals, setMeals] = useState<EnhancedMealInput[]>(DEFAULT_MEALS);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [macroPreview, setMacroPreview] = useState<MacroPreview | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [foodEstimateError, setFoodEstimateError] = useState<string | null>(null);
  const router = useRouter();

  const canCalculate = !!profile.weightKg && !!profile.heightCm && !!profile.age;

  const calculatePreview = () => {
    const w = Number(profile.weightKg);
    const h = Number(profile.heightCm);
    const a = Number(profile.age);
    const bmr = Math.round(
      profile.sex === "masculino"
        ? 10 * w + 6.25 * h - 5 * a + 5
        : 10 * w + 6.25 * h - 5 * a - 161
    );
    const tdee = Math.round(bmr * 1.55);
    const goalLower = profile.goal.toLowerCase();
    const targetCalories =
      goalLower.includes("emagrec")
        ? Math.round(tdee * 0.85)
        : goalLower.includes("força") || goalLower.includes("manter")
        ? tdee
        : Math.round(tdee * 1.1);
    const targetProtein = Math.round(w * 2.2);
    const goalLabel =
      goalLower.includes("emagrec") ? "déficit de 15% para emagrecimento"
      : goalLower.includes("força") || goalLower.includes("manter") ? "manutenção"
      : "superávit de 10% para hipertrofia";

    setMacroPreview({ bmr, tdee, targetCalories, targetProtein, goalLabel });
  };

  const updateProfile = (field: keyof ProfileData, value: string) =>
    setProfile((p) => ({ ...p, [field]: value }));

  const addMeal = () => {
    if (meals.length >= 8) return;
    setMeals([...meals, { mealName: "", scheduledTime: "", description: "", items: [] }]);
  };

  const removeMeal = (i: number) => {
    if (meals.length <= 1) return;
    setMeals(meals.filter((_, idx) => idx !== i));
  };

  const addItemToMeal = (mealIndex: number, food: any, quantity: number, unit: "g" | "un") => {
    const updated = [...meals];
    let weight = quantity;
    if (unit === "un") {
      const desc = food.description.toLowerCase();
      if (desc.includes("ovo")) weight = quantity * 50;
      else if (desc.includes("pão")) weight = quantity * 25;
      else if (desc.includes("whey")) weight = quantity * 30;
      else if (desc.includes("pasta de amendoim")) weight = quantity * 15;
      else weight = quantity * 100;
    }
    const factor = weight / 100;
    
    const newItem: MealItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: food.description,
      quantity,
      unit,
      kcal: Math.round(food.energy_kcal * factor),
      protein: Number((food.protein_g * factor).toFixed(1)),
      carbs: Number((food.carbohydrate_g * factor).toFixed(1)),
      fat: Number((food.lipid_g * factor).toFixed(1)),
    };

    updated[mealIndex].items.push(newItem);
    
    // Atualizar target macros da refeição
    updated[mealIndex].targetCalories = updated[mealIndex].items.reduce((acc, item) => acc + item.kcal, 0);
    updated[mealIndex].targetProtein = updated[mealIndex].items.reduce((acc, item) => acc + item.protein, 0);
    updated[mealIndex].targetCarbs = updated[mealIndex].items.reduce((acc, item) => acc + item.carbs, 0);
    updated[mealIndex].targetFat = updated[mealIndex].items.reduce((acc, item) => acc + item.fat, 0);
    
    // Atualizar descrição para sumarizar itens (usado como fallback no coach)
    updated[mealIndex].description = updated[mealIndex].items.map(item => `${item.quantity}${item.unit} ${item.name}`).join(" + ");
    
    setMeals(updated);
  };

  const removeItemFromMeal = (mealIndex: number, itemId: string) => {
    const updated = [...meals];
    updated[mealIndex].items = updated[mealIndex].items.filter(item => item.id !== itemId);
    
    // Recalcular macros
    updated[mealIndex].targetCalories = updated[mealIndex].items.reduce((acc, item) => acc + item.kcal, 0);
    updated[mealIndex].targetProtein = updated[mealIndex].items.reduce((acc, item) => acc + item.protein, 0);
    updated[mealIndex].targetCarbs = updated[mealIndex].items.reduce((acc, item) => acc + item.carbs, 0);
    updated[mealIndex].targetFat = updated[mealIndex].items.reduce((acc, item) => acc + item.fat, 0);
    updated[mealIndex].description = updated[mealIndex].items.map(item => `${item.quantity}${item.unit} ${item.name}`).join(" + ");

    setMeals(updated);
  };

  const updateMeal = (i: number, field: keyof MealInput, value: string) => {
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

      {/* Secção 3: Refeições */}
      <div className="space-y-4">
        <p className={sectionTitleClass}>Refeições Diárias</p>
        <p className="text-xs text-slate-600">
          Cadastre as suas refeições habituais. Pode descrever o que costuma comer em cada uma.
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

              <div className="col-span-2 space-y-3">
                <label className={labelClass}>Alimentos da Dieta Padrão</label>
                
                {/* Lista de Itens Já Adicionados */}
                {meal.items.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {meal.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-lg p-2.5">
                        <div className="flex items-center gap-3">
                          <div className="bg-orange-500/20 p-1.5 rounded-md">
                            <Utensils className="w-3 h-3 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-white leading-none mb-1">{item.name}</p>
                            <p className="text-[9px] text-slate-500 font-mono uppercase">{item.quantity}{item.unit} • {item.kcal}kcal • {item.protein}g P</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItemFromMeal(i, item.id)}
                          className="text-slate-600 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <FoodSearchInput 
                  onSelect={(food, q, u) => addItemToMeal(i, food, q, u)} 
                  placeholder="Adicionar alimento (ex: Ovo, Arroz...)"
                />

                {/* Resumo de Macros da Refeição */}
                {meal.items.length > 0 && (
                  <div className="flex gap-4 pt-2 border-t border-white/5 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    <span className="text-orange-400/80">{meal.targetCalories} kcal</span>
                    <span>{meal.targetProtein}g prot</span>
                    <span>{meal.targetCarbs}g carb</span>
                  </div>
                )}
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

      {/* Botão calcular macros */}
      <button
        type="button"
        onClick={calculatePreview}
        disabled={!canCalculate || isCalculating}
        title={!canCalculate ? "Preencha peso, altura e idade primeiro" : ""}
        className="w-full flex items-center justify-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 font-bold py-3 rounded-2xl transition-colors text-sm"
      >
        <Calculator className="w-4 h-4" />
        {isCalculating ? "Calculando..." : "Calcular macros da minha dieta"}
      </button>

      {/* Painel de preview */}
      {macroPreview && (
        <div className="bg-white/5 border border-orange-500/20 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">Resumo da sua dieta</p>
            <button type="button" onClick={() => setMacroPreview(null)} className="text-slate-600 hover:text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Metas pelo perfil */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Metas pelo seu perfil</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 mb-1">Metabolismo basal (BMR)</p>
                <p className="text-lg font-black text-white">{macroPreview.bmr.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] text-slate-600">kcal/dia em repouso</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-[10px] text-slate-500 mb-1">Gasto total (TDEE)</p>
                <p className="text-lg font-black text-white">{macroPreview.tdee.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] text-slate-600">kcal/dia c/ atividade</p>
              </div>
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                <p className="text-[10px] text-orange-400 mb-1">Meta calórica</p>
                <p className="text-lg font-black text-orange-400">{macroPreview.targetCalories.toLocaleString("pt-BR")}</p>
                <p className="text-[10px] text-slate-500 capitalize">{macroPreview.goalLabel}</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                <p className="text-[10px] text-blue-400 mb-1">Meta de proteína</p>
                <p className="text-lg font-black text-blue-400">{macroPreview.targetProtein}g</p>
                <p className="text-[10px] text-slate-500">2,2g por kg de peso</p>
              </div>
            </div>
          </div>

          {/* Estimativa pelos alimentos */}
          {macroPreview && (
            <div className="border-t border-white/5 pt-4 space-y-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Resumo dos alimentos cadastrados</p>

              {meals.filter(m => m.items.length > 0).map((m) => (
                <div key={m.mealName} className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-xs text-slate-400">{m.mealName}</span>
                  <div className="flex gap-3 text-xs font-mono">
                    <span className="text-white font-bold">{m.targetCalories} kcal</span>
                    <span className="text-blue-400">{m.targetProtein}g P</span>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-300">Total cadastrado</span>
                <div className="flex gap-3 text-xs font-mono">
                  <span className="text-orange-400 font-black">
                    {meals.reduce((acc, m) => acc + (m.targetCalories || 0), 0)} kcal
                  </span>
                  <span className="text-blue-400 font-bold">
                    {meals.reduce((acc, m) => acc + (m.targetProtein || 0), 0)}g P
                  </span>
                </div>
              </div>

              {meals.reduce((acc, m) => acc + (m.targetCalories || 0), 0) < macroPreview.targetCalories * 0.8 && (
                <p className="text-[9px] text-yellow-500/80 italic">
                  ⚠️ Sua dieta cadastrada está abaixo da meta sugerida. Adicione mais alimentos para bater os macros.
                </p>
              )}
            </div>
          )}

          {!isCalculating && foodEstimateError && (
            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Estimativa dos seus alimentos</p>
              <p className="text-xs text-red-400">{foodEstimateError}</p>
            </div>
          )}
        </div>
      )}

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
