import { FastifyPluginAsync } from "fastify";
import { config } from "../config";
import { parserAgent } from "../agents/parser.agent";
import { coachAgent } from "../agents/coach.agent";
import { dietAgent } from "../agents/diet.agent";
import { onboardingAgent } from "../agents/onboarding.agent";
import { whisperService } from "../services/whisper.service";
import { wapiService } from "../services/wapi.service";
import { redisService } from "../services/redis.service";
// @ts-ignore — prisma generate necessário
import { prisma } from "../db/client";
import type { WApiMessagePayload } from "../types";

const FALLBACK_MESSAGE =
  "Ocorreu um erro ao processar a tua mensagem. Tenta novamente.";

const webhookRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: WApiMessagePayload }>("/whatsapp", async (request, reply) => {
    const body = request.body;

    // Validar instanceId para garantir que o payload é da nossa instância
    if (body?.instanceId !== config.wapiInstanceId) {
      return reply.status(200).send({ ok: true });
    }

    // Ignorar mensagens enviadas pelo próprio bot
    if (body?.fromMe === true) {
      return reply.status(200).send({ ok: true });
    }

    // Extrair campos do payload (estrutura real da w-api.app)
    const phone = (body?.sender?.id ?? "").replace("@s.whatsapp.net", "");
    const audioUrl = body?.msgContent?.audioMessage?.URL;
    const audioMediaKey = body?.msgContent?.audioMessage?.mediaKey;
    const isAudio = !!audioUrl;

    let text = body?.msgContent?.conversation ?? "";

    try {
      // Auto-registro: criar user na primeira mensagem
      // @ts-ignore — prisma generate necessário
      const user = await prisma.user.upsert({
        where: { phoneNumber: phone },
        update: {},
        create: {
          phoneNumber: phone,
          name: body?.sender?.pushName ?? null,
        },
      });

      // Transcrever áudio se necessário
      if (isAudio && audioUrl) {
        text = await whisperService.transcribeAudio(audioUrl, audioMediaKey);
      }

      // Comando especial: reiniciar onboarding (funciona mesmo com onboarded = true)
      if (/^reiniciar$/i.test(text.trim())) {
        // @ts-ignore — prisma generate necessário
        await prisma.user.update({
          where: { id: user.id },
          data: { onboarded: false },
        });
        await redisService.clearSession(phone);
        const welcomeResponse = await onboardingAgent.handle(user.id, phone, "reiniciar");
        wapiService.sendTyping(phone).catch(() => {});
        await wapiService.sendTextMessage(phone, welcomeResponse);
        return reply.status(200).send({ ok: true });
      }

      // Routing: se o utilizador ainda não fez onboarding, encaminha para o agente de onboarding
      if (!user.onboarded) {
        const onboardingResponse = await onboardingAgent.handle(user.id, phone, text);
        wapiService.sendTyping(phone).catch(() => {});
        await wapiService.sendTextMessage(phone, onboardingResponse);
        return reply.status(200).send({ ok: true });
      }

      // Parsear mensagem com o agente (fluxo normal)
      const result = await parserAgent.parseMessage(text, user.id, phone);

      let responseMessage = "";

      // Processar resultado consoante o tipo
      switch (result.type) {
        case "workout": {
          // Resolver exerciseId para cada exercício e salvar WorkoutLogs
          for (const exercise of result.exercises) {
            // Buscar exercício no catálogo (case insensitive, por nome ou aliases)
            // @ts-ignore — prisma generate necessário
            const catalog = await prisma.exerciseCatalog.findMany();

            const nameLower = exercise.exerciseName.toLowerCase();
            const catalogEntry = catalog.find((entry: { name: string; aliases: string[] }) => {
              if (entry.name.toLowerCase().includes(nameLower) || nameLower.includes(entry.name.toLowerCase())) {
                return true;
              }
              return entry.aliases.some((alias: string) => {
                const aliasLower = alias.toLowerCase();
                return aliasLower.includes(nameLower) || nameLower.includes(aliasLower);
              });
            });

            // Fallback: usar o primeiro exercício do catálogo
            const resolvedEntry = catalogEntry ?? catalog[0];

            // Se o catálogo estiver vazio, não podemos salvar (FK inválida) — registar warning
            if (!resolvedEntry) {
              console.warn("workout: catálogo vazio — registo ignorado para:", exercise.exerciseName);
              responseMessage = "⚠️ Catálogo de exercícios vazio. Contacta o administrador.";
              continue;
            }

            const resolvedExerciseId = resolvedEntry.id;

            // @ts-ignore — prisma generate necessário
            await prisma.workoutLog.create({
              data: {
                userId: user.id,
                exerciseId: resolvedExerciseId,
                weightKg: exercise.totalWeight ?? 0,
                reps: exercise.reps,
                sets: exercise.sets,
                rpe: exercise.rpe ?? null,
                volume:
                  (exercise.totalWeight ?? 0) * exercise.reps * exercise.sets,
                rawInput: text,
              },
            });

            // Analisar treino e gerar resposta
            const exerciseResponse = await coachAgent.analyzeWorkout(user.id, {
              exerciseName: exercise.exerciseName,
              exerciseId: resolvedExerciseId,
              weightKg: exercise.totalWeight ?? 0,
              reps: exercise.reps,
              sets: exercise.sets,
              rpe: exercise.rpe ?? undefined,
              volume:
                (exercise.totalWeight ?? 0) * exercise.reps * exercise.sets,
            });

            // Acumular respostas se houver múltiplos exercícios/séries
            responseMessage = responseMessage 
              ? `${responseMessage}\n\n${exerciseResponse}` 
              : exerciseResponse;
          }

          // Se não havia exercícios, gerar mensagem genérica
          responseMessage ??= "Treino registado!";
          break;
        }

        case "diet": {
          // @ts-ignore — prisma generate necessário
          await prisma.dietLog.create({
            data: {
              userId: user.id,
              meal: result.meal,
              calories: result.calories ?? 0,
              protein: result.protein ?? 0,
              carbs: result.carbs ?? null,
              fat: result.fat ?? null,
              notes: result.description ?? null,
            },
          });

          responseMessage = await dietAgent.analyzeDietLog(user.id);
          break;
        }

        case "question": {
          responseMessage = await dietAgent.answerQuestion(user.id, result.question);
          break;
        }

        case "checkin": {
          // @ts-ignore — prisma generate necessário
          await prisma.dailyCheckIn.create({
            data: {
              userId: user.id,
              mood: result.mood ?? 5,
              sleepQuality: result.sleepQuality ?? 5,
              energyLevel: result.energyLevel ?? 5,
              notes: result.notes ?? null,
            },
          });

          responseMessage = await coachAgent.generateMotivationalCheckIn(
            user.name ?? null
          );
          break;
        }

        case "unknown":
        default: {
          responseMessage = result.message;
          break;
        }
      }

      // Enviar indicador "a escrever..." (fire-and-forget)
      wapiService.sendTyping(phone).catch(() => {});

      // Enviar resposta ao utilizador
      await wapiService.sendTextMessage(phone, responseMessage);

      return reply.status(200).send({ ok: true });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : "";
      request.log.error({ errMsg, errStack }, "Webhook error");
      console.error("=== WEBHOOK ERROR ===");
      console.error("Phone:", phone);
      console.error("Message:", errMsg);
      console.error("Stack:", errStack);
      console.error("=====================");

      // Tentar enviar mensagem de fallback — nunca retornar 5xx
      wapiService.sendTextMessage(phone, FALLBACK_MESSAGE).catch(() => {});

      return reply.status(200).send({ ok: true });
    }
  });
};

export default webhookRoute;
