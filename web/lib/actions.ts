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

  const perMealCalories = input.meals.length > 0 ? Math.round(targetCalories / input.meals.length) : 0;
  const perMealProtein = input.meals.length > 0 ? Math.round(targetProtein / input.meals.length) : 0;

  await prisma.scheduledMeal.deleteMany({ where: { userId: user.id } });
  if (input.meals.length > 0) {
    await prisma.scheduledMeal.createMany({
      data: input.meals.map((m) => ({
        userId: user.id,
        mealName: m.mealName,
        scheduledTime: m.scheduledTime,
        description: m.description,
        targetCalories: perMealCalories,
        targetProtein: perMealProtein,
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
        body: JSON.stringify({ phone: input.phone, message: welcomeMessage, delayMessage: 1 }),
      }
    ).catch(() => {});
  }

  revalidatePath(`/dashboard/${user.id}`);
  return { userId: user.id };
}

type MealEstimate = {
  mealName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export async function estimateDietMacros(
  meals: { mealName: string; description: string }[]
): Promise<{ meals: MealEstimate[]; total: MealEstimate }> {
  const withDescription = meals.filter((m) => m.description.trim());
  const empty: MealEstimate = { mealName: "Total", calories: 0, protein: 0, carbs: 0, fat: 0 };

  if (withDescription.length === 0) {
    return { meals: [], total: empty };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const list = withDescription.map((m, i) => `${i + 1}. ${m.mealName}: ${m.description}`).join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Estime os macros nutricionais para cada refeição abaixo. Responda APENAS com JSON válido, sem markdown, sem explicações.

Refeições:
${list}

Formato:
{"meals":[{"mealName":"...","calories":0,"protein":0,"carbs":0,"fat":0}]}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
  const parsed = JSON.parse(text) as { meals: MealEstimate[] };

  const total = parsed.meals.reduce(
    (acc, m) => ({
      mealName: "Total",
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    empty
  );

  return { meals: parsed.meals, total };
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
