"use server";

import { prisma } from "./prisma";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";

function startOfDayBRT(): Date {
  const now = new Date();
  const brtMs = now.getTime() - 3 * 60 * 60 * 1000;
  const dateStr = new Date(brtMs).toISOString().split('T')[0];
  return new Date(dateStr + 'T03:00:00.000Z');
}

export async function updateWater(userId: string, liters: number) {
  const today = startOfDayBRT();

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
  const today = startOfDayBRT();

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
// Macro Calculation Engine (Claude 3.5 Sonnet)
// ---------------------------------------------------------------------------

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

  const SYSTEM_PROMPT = `Você é um nutricionista profissional de alto nível.
Sua tarefa é calcular os macros exatos para as refeições fornecidas.

REGRAS CRÍTICAS:
1. Use seu conhecimento treinado das tabelas TACO (Brasil) e USDA (EUA) para obter valores REAIS.
2. Seja preciso com porções: 1 ovo médio = 50g, 1 fatia de pão = 30g, 1 colher de sopa de azeite = 10g, etc., a menos que o usuário especifique o peso.
3. Calcule cada refeição de forma INDEPENDENTE. Não repita valores entre refeições diferentes.
4. Para carnes, use valores de "grelhado/cozido" como padrão.
5. Retorne APENAS um JSON válido.

Formato de Saída:
{
  "meals": [
    { "mealName": "...", "calories": 123, "protein": 20, "carbs": 30, "fat": 10 }
  ],
  "total": { "mealName": "Total", "calories": 123, "protein": 20, "carbs": 30, "fat": 10 }
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Calcule os macros para estas refeições:\n\n${list}` }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch ? jsonMatch[1].trim() : raw;

  try {
    const result = JSON.parse(jsonText) as { meals: MealMacros[]; total: MealMacros };
    return result;
  } catch (err) {
    console.error("Erro ao processar JSON da IA:", err, jsonText);
    return { meals: [], total: empty };
  }
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
