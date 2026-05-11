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
        body: JSON.stringify({ phone: input.phone, message: welcomeMessage, delayMessage: 1 }),
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

const MACRO_AGENT_SYSTEM = `Você é um nutricionista esportivo com acesso à tabela TACO (Tabela Brasileira de Composição de Alimentos) e USDA FoodData Central.

Sua tarefa é calcular os macros nutricionais de refeições com a maior precisão possível.

METODOLOGIA OBRIGATÓRIA — siga exatamente esta ordem:
1. Identifique cada alimento e sua quantidade na refeição
2. Para cada alimento, use os valores por 100g da tabela nutricional padrão
3. Calcule proporcionalmente à quantidade informada
4. Some todos os componentes para obter o total da refeição

VALORES DE REFERÊNCIA (por 100g, cozido/preparado):
- Arroz branco cozido: 128 kcal, 2.5g prot, 28g carb, 0.2g gord
- Feijão cozido: 77 kcal, 4.8g prot, 14g carb, 0.5g gord
- Frango grelhado (peito): 165 kcal, 31g prot, 0g carb, 3.6g gord
- Carne bovina (patinho grelhado): 219 kcal, 32g prot, 0g carb, 9.5g gord
- Ovo inteiro cozido (1 unidade=50g): 78 kcal, 6g prot, 0.6g carb, 5.3g gord
- Pão de forma (1 fatia=25g): 66 kcal, 2.4g prot, 12.4g carb, 0.9g gord
- Banana média (100g): 89 kcal, 1.1g prot, 23g carb, 0.3g gord
- Aveia (40g): 156 kcal, 5.4g prot, 27g carb, 2.8g gord
- Leite integral (200ml): 122 kcal, 6.6g prot, 9.6g carb, 6.8g gord
- Whey protein (1 scoop=30g): 120 kcal, 24g prot, 3g carb, 1.5g gord
- Queijo mussarela (30g): 80 kcal, 6g prot, 1g carb, 6g gord
- Pão francês (50g): 134 kcal, 4.3g prot, 27.6g carb, 0.6g gord
- Bife de acém (100g): 219 kcal, 26g prot, 0g carb, 12g gord
- Salada verde (50g): 12 kcal, 1g prot, 2g carb, 0g gord

REGRAS:
- Quando a quantidade não for especificada, use porção padrão brasileira
- Método de preparo padrão: grelhado para carnes, cozido para grãos
- Arredonde para inteiros
- Responda APENAS com JSON válido, sem markdown, sem explicações`;

export async function calculateMealMacros(
  meals: { mealName: string; description: string }[]
): Promise<{ meals: MealMacros[]; total: MealMacros }> {
  const withDescription = meals.filter((m) => m.description.trim());
  const empty: MealMacros = { mealName: "Total", calories: 0, protein: 0, carbs: 0, fat: 0 };

  if (withDescription.length === 0) {
    return { meals: [], total: empty };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const list = withDescription.map((m) => `- ${m.mealName}: ${m.description}`).join("\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: MACRO_AGENT_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Calcule os macros de cada refeição abaixo:\n\n${list}\n\nFormato de resposta:\n{"meals":[{"mealName":"...","calories":0,"protein":0,"carbs":0,"fat":0}]}`,
      },
    ],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
  // Extrair JSON mesmo que venha dentro de bloco markdown ```json ... ```
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
  const jsonText = jsonMatch ? jsonMatch[1].trim() : raw;
  const parsed = JSON.parse(jsonText) as { meals: MealMacros[] };

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
