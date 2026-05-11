"use server";

import { prisma } from "./prisma";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";

export async function updateWater(userId: string, liters: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkIn = await prisma.dailyCheckIn.findFirst({
    where: { 
      userId, 
      date: { gte: today } 
    }
  });

  if (checkIn) {
    await prisma.dailyCheckIn.update({
      where: { id: checkIn.id },
      data: { waterLiters: { increment: liters } }
    });
  } else {
    await prisma.dailyCheckIn.create({
      data: {
        userId,
        date: today,
        waterLiters: liters,
        mood: 5,
        sleepQuality: 5,
        energyLevel: 5
      }
    });
  }

  revalidatePath(`/dashboard/${userId}`);
}

export async function toggleSupplement(userId: string, supplement: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkIn = await prisma.dailyCheckIn.findFirst({
    where: { 
      userId, 
      date: { gte: today } 
    }
  });

  if (checkIn) {
    const current = checkIn.supplements || [];
    const updated = current.includes(supplement)
      ? current.filter(s => s !== supplement)
      : [...current, supplement];

    await prisma.dailyCheckIn.update({
      where: { id: checkIn.id },
      data: { supplements: updated }
    });
  } else {
    await prisma.dailyCheckIn.create({
      data: {
        userId,
        date: today,
        supplements: [supplement],
        mood: 5,
        sleepQuality: 5,
        energyLevel: 5
      }
    });
  }

  revalidatePath(`/dashboard/${userId}`);
}

export async function deleteDietLog(userId: string, logId: string) {
  await prisma.dietLog.delete({
    where: { id: logId }
  });

  revalidatePath(`/dashboard/${userId}/dieta`);
  revalidatePath(`/dashboard/${userId}`);
}

export type MealInput = {
  mealName: string;
  scheduledTime: string;
  description: string;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
};

function calculateTDEE(weightKg: number, heightCm: number, age: number, sex: string): number {
  const bmr =
    sex === "masculino"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  return Math.round(bmr * 1.55);
}

export async function submitOnboarding(input: {
  phone: string;
  name: string;
  age: number;
  sex: "masculino" | "feminino";
  weightKg: number;
  heightCm: number;
  experienceLevel: "iniciante" | "intermédio" | "avançado";
  goal: string;
  meals: MealInput[];
}): Promise<{ userId: string }> {
  const tdee = calculateTDEE(input.weightKg, input.heightCm, input.age, input.sex);
  const goalLower = input.goal.toLowerCase();
  const targetCalories =
    goalLower.includes("emagrec") || goalLower.includes("perda")
      ? Math.round(tdee * 0.85)
      : goalLower.includes("força") || goalLower.includes("manter")
      ? tdee
      : Math.round(tdee * 1.1);
  const targetProtein = Math.round(input.weightKg * 2.2);

  // Normalizar telefone: apenas dígitos, garantir prefixo 55 para Brasil
  const rawPhone = input.phone.replace(/\D/g, "");
  const normalizedPhone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;

  const user = await prisma.user.upsert({
    where: { phoneNumber: normalizedPhone },
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
      phoneNumber: normalizedPhone,
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

  const fallbackCal = input.meals.length > 0 ? Math.round(targetCalories / input.meals.length) : 0;
  const fallbackProt = input.meals.length > 0 ? Math.round(targetProtein / input.meals.length) : 0;

  await prisma.scheduledMeal.deleteMany({ where: { userId: user.id } });
  if (input.meals.length > 0) {
    await prisma.scheduledMeal.createMany({
      data: input.meals.map((m) => ({
        userId: user.id,
        mealName: m.mealName,
        scheduledTime: m.scheduledTime,
        description: m.description,
        targetCalories: m.targetCalories ?? fallbackCal,
        targetProtein: m.targetProtein ?? fallbackProt,
        targetCarbs: m.targetCarbs ?? null,
        targetFat: m.targetFat ?? null,
      })),
    });
  }

  const wapiToken = process.env.WAPI_TOKEN;
  const wapiInstanceId = process.env.WAPI_INSTANCE_ID;
  if (wapiToken && wapiInstanceId) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const welcomeMessage =
      `Olá, ${input.name}! 👋\n\n` +
      `O seu perfil foi configurado com sucesso. 🎯\n\n` +
      `A partir de agora:\n` +
      `• Registe os seus treinos aqui _(ex: Supino 80kg x 8 x 4)_\n` +
      `• Envie o que você comeu para registrar a dieta\n` +
      `• Faça check-in de bem-estar quando quiser _(humor, sono, energia)_\n\n` +
      `O seu dashboard pessoal:\n${appUrl}/dashboard/${user.id}\n\n` +
      `Bora começar 💪`;

    await fetch(
      `https://api.w-api.app/v1/message/send-text?instanceId=${wapiInstanceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${wapiToken}`,
        },
        body: JSON.stringify({ phone: normalizedPhone, message: welcomeMessage, delayMessage: 1 }),
      }
    ).catch((err) => console.error("WAPI send-text error:", err));
  }

  revalidatePath(`/dashboard/${user.id}`);
  return { userId: user.id };
}

export type MealMacros = {
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// ---------------------------------------------------------------------------
// TACO lookup + math engine
// ---------------------------------------------------------------------------

type TacoEntry = {
  id: number;
  description: string;
  category: string;
  energy_kcal: number | null;
  protein_g: number | null;
  lipid_g: number | null;
  carbohydrate_g: number | null;
  fiber_g: number | null;
};

// Loaded once at module level
let _tacoData: TacoEntry[] | null = null;
function getTacoData(): TacoEntry[] {
  if (_tacoData) return _tacoData;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _tacoData = require("../data/taco.json") as TacoEntry[];
  return _tacoData;
}

// Supplementary table for gym foods not in TACO (values per 100g, verified sources)
const SUPPLEMENT_FOODS: (TacoEntry & { aliases: string[] })[] = [
  // ── Proteínas em pó ──────────────────────────────────────────────────────
  {
    id: 9001, description: "Whey protein concentrado (WPC 80%)", category: "Suplementos",
    aliases: ["whey", "whey protein", "whey concentrado", "proteína whey"],
    energy_kcal: 390, protein_g: 80, lipid_g: 4, carbohydrate_g: 8, fiber_g: 0,
  },
  {
    id: 9002, description: "Whey protein isolado (WPI 90%)", category: "Suplementos",
    aliases: ["whey isolado", "whey isolate", "wpi"],
    energy_kcal: 370, protein_g: 90, lipid_g: 1, carbohydrate_g: 2, fiber_g: 0,
  },
  {
    id: 9003, description: "Caseína micelar", category: "Suplementos",
    aliases: ["caseína", "casein", "caseina", "proteína caseína"],
    energy_kcal: 357, protein_g: 73, lipid_g: 1, carbohydrate_g: 14, fiber_g: 0,
  },
  {
    id: 9004, description: "Proteína vegetal de soja isolada", category: "Suplementos",
    aliases: ["proteína de soja", "soy protein", "proteína vegetal", "protein vegetal", "proteína em pó", "protein powder"],
    energy_kcal: 360, protein_g: 91, lipid_g: 0.5, carbohydrate_g: 3, fiber_g: 0,
  },
  // ── Aminoácidos ───────────────────────────────────────────────────────────
  {
    id: 9005, description: "BCAA (2:1:1)", category: "Suplementos",
    aliases: ["bcaa", "aminoácidos", "amino", "leucina isoleucina valina"],
    energy_kcal: 350, protein_g: 88, lipid_g: 0, carbohydrate_g: 0, fiber_g: 0,
  },
  {
    id: 9006, description: "Creatina monohidratada", category: "Suplementos",
    aliases: ["creatina", "creatine", "creatina monohidratada"],
    energy_kcal: 0, protein_g: 0, lipid_g: 0, carbohydrate_g: 0, fiber_g: 0,
  },
  // ── Carboidratos ──────────────────────────────────────────────────────────
  {
    id: 9007, description: "Maltodextrina", category: "Suplementos",
    aliases: ["maltodextrina", "malto"],
    energy_kcal: 380, protein_g: 0, lipid_g: 0, carbohydrate_g: 95, fiber_g: 0,
  },
  {
    id: 9008, description: "Dextrose", category: "Suplementos",
    aliases: ["dextrose", "glicose em pó", "glucose"],
    energy_kcal: 380, protein_g: 0, lipid_g: 0, carbohydrate_g: 95, fiber_g: 0,
  },
  // ── Gorduras ─────────────────────────────────────────────────────────────
  {
    id: 9009, description: "Azeite de oliva", category: "Gorduras",
    aliases: ["azeite", "azeite oliva", "azeite de oliva", "olive oil"],
    energy_kcal: 884, protein_g: 0, lipid_g: 100, carbohydrate_g: 0, fiber_g: 0,
  },
  {
    id: 9010, description: "Óleo de coco", category: "Gorduras",
    aliases: ["óleo de coco", "oleo de coco", "coconut oil"],
    energy_kcal: 896, protein_g: 0, lipid_g: 99, carbohydrate_g: 0, fiber_g: 0,
  },
  {
    id: 9011, description: "Pasta de amendoim integral", category: "Gorduras",
    aliases: ["pasta de amendoim", "manteiga de amendoim", "peanut butter"],
    energy_kcal: 580, protein_g: 25, lipid_g: 50, carbohydrate_g: 9, fiber_g: 6,
  },
  // ── Laticínios / derivados ────────────────────────────────────────────────
  {
    id: 9012, description: "Cottage cheese", category: "Laticínios",
    aliases: ["cottage", "queijo cottage"],
    energy_kcal: 98, protein_g: 11, lipid_g: 4.3, carbohydrate_g: 3.4, fiber_g: 0,
  },
  {
    id: 9013, description: "Iogurte grego integral", category: "Laticínios",
    aliases: ["iogurte grego", "yogurt grego", "iogurte grego integral"],
    energy_kcal: 129, protein_g: 10, lipid_g: 7, carbohydrate_g: 3.5, fiber_g: 0,
  },
  {
    id: 9014, description: "Queijo mussarela", category: "Laticínios",
    aliases: ["mussarela", "muçarela", "queijo mussarela", "mozzarella"],
    energy_kcal: 264, protein_g: 20, lipid_g: 20, carbohydrate_g: 2, fiber_g: 0,
  },
  {
    id: 9015, description: "Cream cheese", category: "Laticínios",
    aliases: ["cream cheese", "queijo cremoso"],
    energy_kcal: 342, protein_g: 5.9, lipid_g: 34, carbohydrate_g: 4.3, fiber_g: 0,
  },
  // ── Cereais / carboidratos ────────────────────────────────────────────────
  {
    id: 9016, description: "Pão francês", category: "Cereais",
    aliases: ["pão francês", "pao frances", "pão de sal", "francês"],
    energy_kcal: 267, protein_g: 8, lipid_g: 1.2, carbohydrate_g: 55, fiber_g: 2.3,
  },
  {
    id: 9017, description: "Granola tradicional", category: "Cereais",
    aliases: ["granola"],
    energy_kcal: 415, protein_g: 9.7, lipid_g: 5, carbohydrate_g: 67, fiber_g: 5,
  },
  {
    id: 9018, description: "Tapioca (goma hidratada, preparada)", category: "Cereais",
    aliases: ["tapioca", "goma de tapioca", "polvilho"],
    energy_kcal: 130, protein_g: 0.2, lipid_g: 0.3, carbohydrate_g: 32, fiber_g: 0.5,
  },
];

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMatch(tacoDesc: string, query: string): number {
  const tNorm = normalizeText(tacoDesc);
  const qNorm = normalizeText(query);
  if (tNorm === qNorm) return 100;
  if (tNorm.includes(qNorm)) return 80;
  const qWords = qNorm.split(" ").filter(w => w.length > 2);
  const matches = qWords.filter(w => tNorm.includes(w));
  return (matches.length / Math.max(qWords.length, 1)) * 60;
}

type ParsedIngredient = {
  food: string;
  quantity_g: number;
  state: string;
};

function lookupTaco(ingredient: ParsedIngredient): TacoEntry | null {
  const query = ingredient.food;
  const state = normalizeText(ingredient.state);
  const taco = getTacoData();

  // Check supplementary table first (aliases)
  for (const s of SUPPLEMENT_FOODS) {
    if (s.aliases.some(a => normalizeText(a) === normalizeText(query))) return s;
    if (s.aliases.some(a => normalizeText(query).includes(normalizeText(a)))) return s;
  }

  let best: TacoEntry | null = null;
  let bestScore = 0;

  for (const entry of taco) {
    let score = scoreMatch(entry.description, query);
    if (score < 20) continue;

    // Bonus for matching preparation state
    const entryNorm = normalizeText(entry.description);
    const isCozido = entryNorm.includes("cozido") || entryNorm.includes("grelhado") || entryNorm.includes("assado") || entryNorm.includes("frito");
    const isCru = entryNorm.includes("cru") || entryNorm.includes("crua") || entryNorm.includes("crus");

    if (state.includes("cozido") || state.includes("grelhado") || state.includes("assado")) {
      if (isCozido) score += 15;
      if (isCru) score -= 10;
    } else if (state.includes("cru")) {
      if (isCru) score += 15;
      if (isCozido) score -= 10;
    } else {
      // Default: prefer cooked
      if (isCozido) score += 5;
    }

    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return bestScore >= 25 ? best : null;
}

// ---------------------------------------------------------------------------
// USDA FoodData Central API lookup
// ---------------------------------------------------------------------------

type UsdaMacros = {
  energy_kcal: number;
  protein_g: number;
  lipid_g: number;
  carbohydrate_g: number;
  fiber_g: number;
};

async function lookupUSDA(foodName: string): Promise<UsdaMacros | null> {
  const apiKey = process.env.USDA_API_KEY ?? "DEMO_KEY";
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodName)}&api_key=${apiKey}&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)&pageSize=3`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const data = await res.json() as {
      foods?: { foodNutrients: { nutrientId: number; value: number }[] }[];
    };
    if (!data.foods?.length) return null;

    const nutrients = data.foods[0].foodNutrients;
    const get = (id: number) => {
      const n = nutrients.find(n => n.nutrientId === id);
      return n ? Math.round(n.value * 10) / 10 : 0;
    };

    const result: UsdaMacros = {
      energy_kcal:    get(1008),
      protein_g:      get(1003),
      lipid_g:        get(1004),
      carbohydrate_g: get(1005),
      fiber_g:        get(1079),
    };

    // Sanity check: reject if all macros are zero
    if (result.energy_kcal === 0 && result.protein_g === 0 && result.carbohydrate_g === 0) return null;
    return result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// LLM parse-only prompt
// ---------------------------------------------------------------------------

const PARSE_SYSTEM = `Você é um analisador de refeições. Sua ÚNICA função é converter descrições de refeições em JSON estruturado com os ingredientes e quantidades em gramas.

REGRAS ABSOLUTAS:
- Converta TODAS as unidades para gramas: colher de sopa = 10g para óleos/líquidos densos, 15g para sólidos. Xícara de arroz cozido = 200g. Copo de leite = 200g.
- Estado padrão: carnes → "grelhado", grãos/leguminosas → "cozido", frutas/vegetais frescos → "cru", óleos → "natural"
- Quando a quantidade não for informada, use a porção padrão brasileira
- Responda SOMENTE com JSON válido, sem markdown, sem explicações

Formato obrigatório:
{"meals":[{"mealName":"...","ingredients":[{"food":"nome do alimento","quantity_g":100,"state":"cozido"}]}]}`;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function calculateMealMacros(
  meals: { mealName: string; description: string }[]
): Promise<{ meals: MealMacros[]; total: MealMacros }> {
  const withDescription = meals.filter((m) => m.description.trim());
  const empty: MealMacros = { mealName: "Total", calories: 0, protein: 0, carbs: 0, fat: 0 };

  if (withDescription.length === 0) return { meals: [], total: empty };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const list = withDescription.map((m) => `- ${m.mealName}: ${m.description}`).join("\n");

  // Step 1: LLM parses ingredients only (no calculation)
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: PARSE_SYSTEM,
    messages: [{ role: "user", content: `Analise estas refeições:\n\n${list}` }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch ? jsonMatch[1].trim() : raw;

  type ParsedMeal = { mealName: string; ingredients: ParsedIngredient[] };
  const parsed = JSON.parse(jsonText) as { meals: ParsedMeal[] };

  // Step 2: Lookup TACO + math (deterministic)
  const resultMeals: MealMacros[] = [];
  const unknownIngredients: { mealName: string; food: string; quantity_g: number }[] = [];

  for (const meal of parsed.meals) {
    let cal = 0, prot = 0, carbs = 0, fat = 0;

    for (const ing of meal.ingredients) {
      const entry = lookupTaco(ing);
      if (entry) {
        const factor = ing.quantity_g / 100;
        cal   += (entry.energy_kcal ?? 0) * factor;
        prot  += (entry.protein_g    ?? 0) * factor;
        carbs += (entry.carbohydrate_g ?? 0) * factor;
        fat   += (entry.lipid_g      ?? 0) * factor;
      } else {
        unknownIngredients.push({ mealName: meal.mealName, food: ing.food, quantity_g: ing.quantity_g });
      }
    }

    resultMeals.push({
      mealName: meal.mealName,
      calories: Math.round(cal),
      protein:  Math.round(prot),
      carbs:    Math.round(carbs),
      fat:      Math.round(fat),
    });
  }

  // Step 3: USDA lookup → LLM fallback (only for what USDA also doesn't find)
  if (unknownIngredients.length > 0) {
    const stillUnknown: typeof unknownIngredients = [];

    await Promise.all(
      unknownIngredients.map(async (u) => {
        const usdaResult = await lookupUSDA(u.food);
        const idx = resultMeals.findIndex(m => m.mealName === u.mealName);
        if (idx === -1) return;

        if (usdaResult) {
          const factor = u.quantity_g / 100;
          resultMeals[idx].calories += Math.round((usdaResult.energy_kcal    ?? 0) * factor);
          resultMeals[idx].protein  += Math.round((usdaResult.protein_g      ?? 0) * factor);
          resultMeals[idx].carbs    += Math.round((usdaResult.carbohydrate_g ?? 0) * factor);
          resultMeals[idx].fat      += Math.round((usdaResult.lipid_g        ?? 0) * factor);
        } else {
          stillUnknown.push(u);
        }
      })
    );

    // Last resort: LLM estimation for anything not found in TACO or USDA
    if (stillUnknown.length > 0) {
      const fallbackList = stillUnknown.map(u => `- ${u.food}: ${u.quantity_g}g`).join("\n");

      const fbResponse = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: `Estime os macros destes alimentos não encontrados em nenhuma base nutricional. Responda SOMENTE JSON válido:
{"items":[{"food":"...","calories":0,"protein":0,"carbs":0,"fat":0}]}`,
        messages: [{ role: "user", content: fallbackList }],
      });

      const fbRaw = fbResponse.content[0].type === "text" ? fbResponse.content[0].text.trim() : "{}";
      const fbMatch = fbRaw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? fbRaw.match(/(\{[\s\S]*\})/);
      const fbParsed = JSON.parse(fbMatch ? fbMatch[1].trim() : fbRaw) as {
        items: { food: string; calories: number; protein: number; carbs: number; fat: number }[];
      };

      for (const item of fbParsed.items) {
        const mealName = stillUnknown.find(u => normalizeText(u.food) === normalizeText(item.food))?.mealName;
        if (!mealName) continue;
        const idx = resultMeals.findIndex(m => m.mealName === mealName);
        if (idx === -1) continue;
        resultMeals[idx].calories += item.calories;
        resultMeals[idx].protein  += item.protein;
        resultMeals[idx].carbs    += item.carbs;
        resultMeals[idx].fat      += item.fat;
      }
    }
  }

  const total = resultMeals.reduce(
    (acc, m) => ({
      mealName: "Total",
      calories: acc.calories + m.calories,
      protein:  acc.protein  + m.protein,
      carbs:    acc.carbs    + m.carbs,
      fat:      acc.fat      + m.fat,
    }),
    empty
  );

  return { meals: resultMeals, total };
}

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
