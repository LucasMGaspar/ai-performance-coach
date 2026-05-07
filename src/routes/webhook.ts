import { FastifyPluginAsync } from "fastify";
import { config } from "../config";
import { parserAgent } from "../agents/parser.agent";
import { coachAgent } from "../agents/coach.agent";
import { whisperService } from "../services/whisper.service";
import { wapiService } from "../services/wapi.service";
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

      // Parsear mensagem com o agente
      const result = await parserAgent.parseMessage(text, user.id, phone);

      let responseMessage: string;

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
            const resolvedExerciseId = resolvedEntry?.id ?? "unknown";

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

            // Analisar treino e gerar resposta (usar o último exercício para a resposta)
            responseMessage = await coachAgent.analyzeWorkout(user.id, {
              exerciseName: exercise.exerciseName,
              exerciseId: resolvedExerciseId,
              weightKg: exercise.totalWeight ?? 0,
              reps: exercise.reps,
              sets: exercise.sets,
              rpe: exercise.rpe,
              volume:
                (exercise.totalWeight ?? 0) * exercise.reps * exercise.sets,
            });
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

          responseMessage = await coachAgent.analyzeDiet(user.id);
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
      request.log.error(error);

      // Tentar enviar mensagem de fallback — nunca retornar 5xx
      wapiService.sendTextMessage(phone, FALLBACK_MESSAGE).catch(() => {});

      return reply.status(200).send({ ok: true });
    }
  });
};

export default webhookRoute;
