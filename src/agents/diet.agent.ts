import Anthropic from "@anthropic-ai/sdk";
import { anthropicClient } from "../lib/anthropic";
// @ts-ignore
import { prisma } from "../db/client";
import { logger } from "../lib/logger";
import { ragService } from "../services/rag.service";

class DietAgent {
  private client: Anthropic;

  constructor() {
    this.client = anthropicClient;
  }

  /**
   * Analisa a dieta registada até agora no dia (movido do coachAgent)
   */
  async analyzeDietLog(userId: string): Promise<string> {
    const [summary, user] = await Promise.all([
      ragService.getDietSummaryToday(userId),
      // @ts-ignore
      prisma.user.findUnique({
        where: { id: userId },
        select: { targetCalories: true, targetProtein: true },
      }),
    ]);

    const targetCalories = user?.targetCalories ?? 2000;
    const targetProtein = user?.targetProtein ?? 150;

    const mealsText =
      summary.mealsLogged.length > 0
        ? summary.mealsLogged.join(", ")
        : "nenhuma refeição registada";

    return (
      `Hoje: ${Math.round(summary.calories)}kcal / ${Math.round(targetCalories)}kcal | ` +
      `Proteína: ${Math.round(summary.protein)}g / ${Math.round(targetProtein)}g\n` +
      `Refeições: ${mealsText}`
    );
  }

  /**
   * Responde a perguntas sobre a dieta do utilizador (planeamento e consumo atual)
   */
  async answerQuestion(userId: string, question: string): Promise<string> {
    // Buscar contexto
    const [scheduledMeals, dietSummary, user] = await Promise.all([
      // @ts-ignore
      prisma.scheduledMeal.findMany({
        where: { userId },
        select: { mealName: true, description: true, scheduledTime: true, targetCalories: true, targetProtein: true },
      }),
      ragService.getDietSummaryToday(userId),
      // @ts-ignore
      prisma.user.findUnique({
        where: { id: userId },
        select: { targetCalories: true, targetProtein: true, name: true },
      }),
    ]);

    const prompt = `Você é um nutricionista virtual (assistente). Responda à pergunta do utilizador sobre a sua dieta de forma direta, amigável e MUITO concisa (formato mensagem de WhatsApp, máximo 3 parágrafos curtos).

DADOS DO UTILIZADOR (${user?.name || "O utilizador"}):
Meta diária: ${user?.targetCalories} kcal, ${user?.targetProtein}g proteína.

REFEIÇÕES PLANEADAS (O seu plano alimentar):
${JSON.stringify(scheduledMeals, null, 2)}

CONSUMO DE HOJE:
Já consumiu: ${dietSummary.calories} kcal, ${dietSummary.protein}g proteína.
Refeições já feitas hoje: ${dietSummary.mealsLogged.join(", ") || "Nenhuma"}

PERGUNTA DO UTILIZADOR:
"${question}"

Lembre-se: Seja natural. Se ele perguntar "qual minha dieta", liste as refeições planeadas brevemente. Se perguntar "o que falta comer", compare o consumo de hoje com o planeado.`;

    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      });

      if (response.content[0].type === "text") {
        return response.content[0].text;
      }
      return "Não consegui formular uma resposta neste momento.";
    } catch (err) {
      logger.error({ err }, "diet agent error");
      return "Desculpa, tive um problema ao analisar a tua dieta. Tenta de novo mais tarde.";
    }
  }
}

export const dietAgent = new DietAgent();
