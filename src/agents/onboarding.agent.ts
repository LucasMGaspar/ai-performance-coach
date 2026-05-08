import { anthropicClient as anthropic } from "../lib/anthropic";
import { config } from "../config";
import { redisService } from "../services/redis.service";
import { logger } from "../lib/logger";
// @ts-ignore — prisma generate necessário
import { prisma } from "../db/client";
import type {
  OnboardingStep,
  OnboardingData,
  ScheduledMealData,
} from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: string
): number {
  // Mifflin-St Jeor BMR × 1.55 (moderadamente activo)
  const bmr =
    sex === "masculino"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  return Math.round(bmr * 1.55);
}

async function extractJson<T>(prompt: string): Promise<T> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const raw = response.content[0].type === "text" ? response.content[0].text : "";
  // Extrair bloco JSON da resposta (pode vir dentro de ```json ... ```)
  const match =
    raw.match(/```json\s*([\s\S]*?)```/) ??
    raw.match(/(\[[\s\S]*\])/) ??
    raw.match(/(\{[\s\S]*\})/);
  const jsonStr = match ? match[1] : raw;
  logger.debug({ output: jsonStr }, "extractJson model output");
  return JSON.parse(jsonStr.trim()) as T;
}

/**
 * Detecta se o utilizador confirmou (sim, pode, ok, etc.).
 * Usa padrões estritos para evitar falsos positivos.
 */
function isConfirmation(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    /^(sim|s|yes|pode|ok|okay|bom|certo|confirmo|perfeito|tá|tudo bem|tudo certo|correcto|correto|está bom|está certo|está correcto|está correto|está ótimo|boa|beleza|isso|exato|exatamente|claro|show|tudo|assim mesmo|mantém|mantém assim)$/.test(t) ||
    /^(sim,|ok,|pode,|certo,)/.test(t)
  );
}

// ---------------------------------------------------------------------------
// Onboarding Agent
// ---------------------------------------------------------------------------

class OnboardingAgent {
  async handle(userId: string, phone: string, text: string): Promise<string> {
    // Comando especial: reiniciar onboarding a qualquer momento
    if (/^reiniciar$/i.test(text.trim())) {
      await redisService.updateOnboarding(phone, "welcome", {});
      return this.handleWelcome(phone);
    }

    const session = await redisService.getSession(phone);
    const step: OnboardingStep = session?.onboardingStep ?? "welcome";
    const data: OnboardingData = session?.onboardingData ?? {};

    switch (step) {
      case "welcome":
        return this.handleWelcome(phone);

      case "profile":
        return this.handleProfile(phone, text, data);

      case "experience_goal":
        return this.handleExperienceGoal(phone, text, data);

      case "calories_confirm":
        return this.handleCaloriesConfirm(phone, text, data);

      case "meals":
        return this.handleMeals(phone, text, data);

      case "meals_confirm":
        return this.handleMealsConfirm(phone, userId, text, data);

      default:
        return this.handleWelcome(phone);
    }
  }

  // -------------------------------------------------------------------------
  // Step: welcome
  // -------------------------------------------------------------------------
  private async handleWelcome(phone: string): Promise<string> {
    await redisService.updateOnboarding(phone, "profile", {});
    return (
      "Olá! 👋 Sou o seu coach de performance pessoal para os próximos 80 dias.\n\n" +
      "Vou precisar de alguns dados para personalizar o seu protocolo.\n\n" +
      "Para começar: qual é o seu nome, idade, sexo, peso e altura?\n" +
      "_(ex: Lucas, 25 anos, masculino, 80kg, 178cm)_"
    );
  }

  // -------------------------------------------------------------------------
  // Step: profile — extrai nome, idade, sexo, peso, altura
  // -------------------------------------------------------------------------
  private async handleProfile(
    phone: string,
    text: string,
    data: OnboardingData
  ): Promise<string> {
    const extracted = await extractJson<{
      name?: string;
      age?: number;
      sex?: string;
      weightKg?: number;
      heightCm?: number;
    }>(
      `Extrai do texto seguinte os dados de perfil do utilizador e retorna APENAS um JSON válido.\n` +
        `Campos: name (string), age (number), sex ("masculino" | "feminino"), weightKg (number em kg), heightCm (number em cm).\n` +
        `Se algum campo não estiver presente, omite-o. Responde APENAS com o JSON, sem explicações.\n\n` +
        `Texto: "${text}"`
    );

    const merged: OnboardingData = {
      ...data,
      ...extracted,
      sex: extracted.sex as OnboardingData["sex"],
    };

    // Verificar campos obrigatórios em falta
    const missing: string[] = [];
    if (!merged.name)      missing.push("nome");
    if (!merged.age)       missing.push("idade");
    if (!merged.sex)       missing.push("sexo (masculino/feminino)");
    if (!merged.weightKg)  missing.push("peso (kg)");
    if (!merged.heightCm)  missing.push("altura (cm)");

    if (missing.length > 0) {
      // Guardar o que já temos e ficar no mesmo step
      await redisService.updateOnboarding(phone, "profile", merged);
      return (
        `Ainda preciso de mais alguns dados! Faltou: *${missing.join(", ")}*\n\n` +
        `Você pode completar? _(ex: 80kg, 178cm)_`
      );
    }

    await redisService.updateOnboarding(phone, "experience_goal", merged);

    return (
      `Obrigado, ${merged.name}! 💪\n\n` +
      `Qual é o seu nível de experiência no treino e o seu objetivo principal?\n` +
      `_(ex: intermediário, hipertrofia)_`
    );
  }

  // -------------------------------------------------------------------------
  // Step: experience_goal — extrai nível e objetivo; calcula TDEE
  // -------------------------------------------------------------------------
  private async handleExperienceGoal(
    phone: string,
    text: string,
    data: OnboardingData
  ): Promise<string> {
    const extracted = await extractJson<{
      experienceLevel?: string;
      goal?: string;
    }>(
      `Extrai do texto seguinte o nível de experiência ("iniciante", "intermédio" ou "avançado") e o objetivo principal (ex: "hipertrofia", "emagrecimento", "força").\n` +
        `Retorna APENAS um JSON com campos experienceLevel e goal. Sem explicações.\n\n` +
        `Texto: "${text}"`
    );

    const merged: OnboardingData = {
      ...data,
      ...extracted,
      experienceLevel: extracted.experienceLevel as OnboardingData["experienceLevel"],
    };

    // Garantir que temos todos os dados biométricos para calcular o TDEE
    if (!merged.weightKg || !merged.heightCm || !merged.age || !merged.sex) {
      await redisService.updateOnboarding(phone, "profile", merged);
      return (
        `Parece que ainda faltam dados biométricos para calcular o seu TDEE. ` +
        `Pode me dizer o seu peso, altura, idade e sexo?\n` +
        `_(ex: 80kg, 178cm, 25 anos, masculino)_`
      );
    }

    const tdee = calculateTDEE(merged.weightKg, merged.heightCm, merged.age, merged.sex);

    const goalLower = (merged.goal ?? "").toLowerCase();
    let targetCalories: number;
    if (goalLower.includes("emagrec") || goalLower.includes("perda")) {
      targetCalories = Math.round(tdee * 0.85);
    } else if (goalLower.includes("força") || goalLower.includes("manter")) {
      targetCalories = tdee;
    } else {
      targetCalories = Math.round(tdee * 1.1); // surplus +10% (hipertrofia default)
    }
    const targetProtein = Math.round(merged.weightKg * 2.2);

    const updatedData: OnboardingData = { ...merged, targetCalories, targetProtein };
    await redisService.updateOnboarding(phone, "calories_confirm", updatedData);

    return (
      `Com base nos seus dados, calculei:\n\n` +
      `• TDEE: ~${tdee} kcal/dia\n` +
      `• Meta sugerida: *${targetCalories} kcal* | *${targetProtein}g proteína* (2.2g/kg)\n\n` +
      `Confirma estas metas ou quer ajustar? _(responda "sim" ou indique os valores que prefere)_`
    );
  }

  // -------------------------------------------------------------------------
  // Step: calories_confirm
  // -------------------------------------------------------------------------
  private async handleCaloriesConfirm(
    phone: string,
    text: string,
    data: OnboardingData
  ): Promise<string> {
    let updatedData = { ...data };

    if (isConfirmation(text)) {
      // Confirma mas valida que temos valores reais
      if (!updatedData.targetCalories || updatedData.targetCalories === 0) {
        return (
          `Não consegui calcular as suas metas automaticamente. ` +
          `Pode indicar manualmente? _(ex: 3100 kcal e 170g proteína)_`
        );
      }
    } else {
      // Utilizador quer ajustar — tentar extrair valores do texto
      const custom = await extractJson<{
        targetCalories?: number;
        targetProtein?: number;
      }>(
        `O utilizador quer ajustar as suas metas calóricas. Extrai os valores de calorias e proteína mencionados.\n` +
          `Retorna APENAS um JSON com campos targetCalories (number) e targetProtein (number). Se não mencionou, omite.\n\n` +
          `Texto: "${text}"`
      );
      updatedData = { ...updatedData, ...custom };

      // Se ainda não temos valores válidos, pedir explicitamente
      if (!updatedData.targetCalories || updatedData.targetCalories === 0) {
        await redisService.updateOnboarding(phone, "calories_confirm", updatedData);
        return `Podes indicar os valores que preferes? _(ex: 3100 kcal e 170g proteína)_`;
      }
    }

    await redisService.updateOnboarding(phone, "meals", updatedData);

    return (
      `Perfeito! Metas definidas: *${updatedData.targetCalories} kcal* | *${updatedData.targetProtein}g proteína* ✅\n\n` +
      `Agora vamos à sua dieta. Descreva as suas refeições diárias:\n` +
      `quantas são, a que horas, e o que você come em cada uma.\n\n` +
      `_(ex: 8h aveia com whey, 13h frango com arroz, 20h salmão com batata doce)_`
    );
  }

  // -------------------------------------------------------------------------
  // Step: meals — recebe texto com refeições, pede Claude para estruturar
  // -------------------------------------------------------------------------
  private async handleMeals(
    phone: string,
    text: string,
    data: OnboardingData
  ): Promise<string> {
    // Detectar se o texto é completamente vazio ou curto demais para ser qualquer coisa
    const isVague = text.trim().length < 2;
    if (isVague) {
      await redisService.updateOnboarding(phone, "meals", data);
      return (
        `Por favor descreva as suas refeições do dia com horário e o que você come.\n\n` +
        `_(ex: 8h aveia com leite e whey, 12h frango com arroz, 16h iogurte grego, 20h carne com batata doce)_`
      );
    }
    const meals = await extractJson<ScheduledMealData[]>(
      `Analise a descrição de refeições seguinte e estime as macros de cada uma.\n` +
        `Retorne APENAS um JSON array com os campos:\n` +
        `  mealName (string — "Café da manhã", "Almoço", "Lanche", "Jantar", etc),\n` +
        `  scheduledTime (string — "08:00"),\n` +
        `  description (string — descrição breve dos alimentos),\n` +
        `  targetCalories (number),\n` +
        `  targetProtein (number — gramas),\n` +
        `  targetCarbs (number — gramas),\n` +
        `  targetFat (number — gramas).\n` +
        `Sem explicações. Apenas o array JSON.\n\n` +
        `Refeições: "${text}"`
    );

    const totalCal = meals.reduce((s, m) => s + m.targetCalories, 0);
    const totalProt = meals.reduce((s, m) => s + m.targetProtein, 0);

    const lines = meals
      .map((m) => {
        const icons: Record<string, string> = {
          "café da manhã": "🕗",
          almoço: "🕛",
          lanche: "🕓",
          jantar: "🕗",
        };
        const icon =
          icons[m.mealName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? "🍽️";
        return (
          `${icon} *${m.scheduledTime} — ${m.mealName}*\n` +
          `   ${m.description} → ~${m.targetCalories}kcal | ${m.targetProtein}g prot`
        );
      })
      .join("\n\n");

    const updatedData: OnboardingData = { ...data, mealsRaw: text, meals };
    await redisService.updateOnboarding(phone, "meals_confirm", updatedData);

    return (
      `Estimei as macros de cada refeição:\n\n${lines}\n\n` +
      `📊 *Total: ~${totalCal} kcal | ${totalProt}g proteína*\n\n` +
      `Está correcto ou queres ajustar alguma refeição? _(responde "sim" ou indica o que mudar)_`
    );
  }

  // -------------------------------------------------------------------------
  // Step: meals_confirm — salva tudo na DB e marca onboarded = true
  // -------------------------------------------------------------------------
  private async handleMealsConfirm(
    phone: string,
    userId: string,
    text: string,
    data: OnboardingData
  ): Promise<string> {
    const textLower = text.toLowerCase().trim();
    const confirmed = isConfirmation(textLower);

    if (!confirmed) {
      // Re-processar refeições com o ajuste mencionado
      return this.handleMeals(phone, text, { ...data, meals: undefined });
    }

    // Salvar perfil no User
    // @ts-ignore — prisma generate necessário
    await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name ?? undefined,
        age: data.age ?? undefined,
        weightKg: data.weightKg ?? undefined,
        height: data.heightCm ?? undefined,
        sex: data.sex ?? undefined,
        experienceLevel: data.experienceLevel ?? undefined,
        goal: data.goal ?? undefined,
        targetCalories: data.targetCalories ?? undefined,
        targetProtein: data.targetProtein ?? undefined,
        onboarded: true,
      },
    });

    // Salvar ScheduledMeals
    if (data.meals && data.meals.length > 0) {
      // @ts-ignore — prisma generate necessário
      await prisma.scheduledMeal.createMany({
        data: data.meals.map((m) => ({
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
    }

    // Limpar estado de onboarding da sessão Redis
    await redisService.updateOnboarding(phone, "complete", {});

    const dashboardUrl = `${config.dashboardUrl}/dashboard/${userId}`;

    return (
      `Perfil configurado! 🎯\n\n` +
      `*Protocolo de 80 dias iniciado.*\n\n` +
      `A partir de hoje:\n` +
      `• Registre os seus treinos aqui _(ex: Supino 80kg x 8 x 4)_\n` +
      `• Envie o que você comeu para registrar a dieta\n` +
      `• Faça check-in de bem-estar quando quiser _(humor, sono, energia)_\n\n` +
      `📊 O seu dashboard pessoal:\n${dashboardUrl}\n\n` +
      `Bora começar 💪`
    );
  }
}

export const onboardingAgent = new OnboardingAgent();
