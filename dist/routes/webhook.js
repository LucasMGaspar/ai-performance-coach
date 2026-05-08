import { createHash, createHmac, timingSafeEqual } from "crypto";
import { config } from "../config";
import { logger } from "../lib/logger";
import { parserAgent } from "../agents/parser.agent";
import { coachAgent } from "../agents/coach.agent";
import { dietAgent } from "../agents/diet.agent";
import { onboardingAgent } from "../agents/onboarding.agent";
import { whisperService } from "../services/whisper.service";
import { wapiService } from "../services/wapi.service";
import { redisService } from "../services/redis.service";
// @ts-ignore — prisma generate necessário
import { prisma } from "../db/client";
import { progressionService } from "../services/progression.service";
const FALLBACK_MESSAGE = "Ocorreu um erro ao processar a tua mensagem. Tenta novamente.";
const webhookRoute = async (fastify) => {
    fastify.post("/whatsapp", async (request, reply) => {
        const body = request.body;
        // Validar instanceId para garantir que o payload é da nossa instância
        if (body?.instanceId !== config.wapiInstanceId) {
            return reply.status(200).send({ ok: true });
        }
        // Ignorar mensagens enviadas pelo próprio bot
        if (body?.fromMe === true) {
            return reply.status(200).send({ ok: true });
        }
        // Autenticação HMAC — valida assinatura da w-api se header presente (soft mode)
        const WAPI_SIGNATURE_HEADER = "x-hub-signature-256";
        const receivedSig = request.headers[WAPI_SIGNATURE_HEADER];
        if (receivedSig) {
            const expectedSig = `sha256=${createHmac("sha256", config.webhookSecret)
                .update(JSON.stringify(body))
                .digest("hex")}`;
            const sigBuffer = Buffer.from(receivedSig);
            const expectedBuffer = Buffer.from(expectedSig);
            const sigMatch = sigBuffer.length === expectedBuffer.length &&
                timingSafeEqual(sigBuffer, expectedBuffer);
            if (!sigMatch) {
                return reply.status(200).send({ ok: true });
            }
        }
        // Extrair campos do payload (estrutura real da w-api.app)
        const phone = (body?.sender?.id ?? "").replace("@s.whatsapp.net", "");
        const audioUrl = body?.msgContent?.audioMessage?.URL;
        const audioMediaKey = body?.msgContent?.audioMessage?.mediaKey;
        const isAudio = !!audioUrl;
        // Suporte para mensagens normais, respostas (extendedTextMessage) e legendas de imagem
        let text = body?.msgContent?.conversation ||
            body?.msgContent?.extendedTextMessage?.text ||
            body?.msgContent?.imageMessage?.caption ||
            "";
        // Se não houver texto nem áudio, ignorar (evita processar recibos de entrega ou mensagens vazias)
        if (!text && !isAudio) {
            return reply.status(200).send({ ok: true });
        }
        // Idempotência: evitar reprocessamento de retries do provider
        const rawMessageId = body?.messageId;
        const idempotencyKey = rawMessageId
            ? rawMessageId
            : createHash("sha256")
                .update(`${phone}:${JSON.stringify(body?.msgContent)}`)
                .digest("hex");
        if (await redisService.isMessageProcessed(idempotencyKey)) {
            return reply.status(200).send({ ok: true });
        }
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
                wapiService.sendTyping(phone).catch(() => { });
                await wapiService.sendTextMessage(phone, welcomeResponse);
                return reply.status(200).send({ ok: true });
            }
            // Routing: se o utilizador ainda não fez onboarding, encaminha para o agente de onboarding
            if (!user.onboarded) {
                logger.info({ phone }, "webhook: user in onboarding");
                const onboardingResponse = await onboardingAgent.handle(user.id, phone, text);
                logger.info({ phone }, "webhook: onboarding response sent");
                wapiService.sendTyping(phone).catch(() => { });
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
                    // @ts-ignore — prisma generate necessário
                    const catalog = await prisma.exerciseCatalog.findMany();
                    if (catalog.length === 0) {
                        responseMessage = "⚠️ Catálogo de exercícios vazio. Contacta o administrador.";
                        break;
                    }
                    const unrecognizedExercises = [];
                    for (const exercise of result.exercises) {
                        // Buscar exercício no catálogo (case insensitive, por nome ou aliases)
                        const nameLower = exercise.exerciseName.toLowerCase();
                        const catalogEntry = catalog.find((entry) => {
                            if (entry.name.toLowerCase().includes(nameLower) || nameLower.includes(entry.name.toLowerCase())) {
                                return true;
                            }
                            return entry.aliases.some((alias) => {
                                const aliasLower = alias.toLowerCase();
                                return aliasLower.includes(nameLower) || nameLower.includes(aliasLower);
                            });
                        });
                        if (!catalogEntry) {
                            unrecognizedExercises.push(exercise.exerciseName);
                            continue;
                        }
                        const resolvedEntry = catalogEntry;
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
                                volume: (exercise.totalWeight ?? 0) * exercise.reps * exercise.sets,
                                rawInput: text,
                            },
                        });
                        // Verificar PR
                        const isPR = await progressionService.updatePR(user.id, resolvedExerciseId, exercise.totalWeight ?? 0, exercise.reps);
                        // Analisar treino e gerar resposta
                        let exerciseResponse = await coachAgent.analyzeWorkout(user.id, {
                            exerciseName: exercise.exerciseName,
                            exerciseId: resolvedExerciseId,
                            weightKg: exercise.totalWeight ?? 0,
                            reps: exercise.reps,
                            sets: exercise.sets,
                            rpe: exercise.rpe ?? undefined,
                            volume: (exercise.totalWeight ?? 0) * exercise.reps * exercise.sets,
                        });
                        if (isPR) {
                            exerciseResponse = `🏆 *NOVO RECORDE PESSOAL!* 🏆\n${exerciseResponse}`;
                        }
                        // Acumular respostas se houver múltiplos exercícios/séries
                        responseMessage = responseMessage
                            ? `${responseMessage}\n\n${exerciseResponse}`
                            : exerciseResponse;
                    }
                    if (unrecognizedExercises.length > 0) {
                        const listagem = unrecognizedExercises.map(n => `• ${n}`).join("\n");
                        const avisoNaoReconhecido = `\n\n⚠️ Não reconheci ${unrecognizedExercises.length === 1 ? "este exercício" : "estes exercícios"} — não foram registados:\n${listagem}\n_Verifica o nome ou pede para adicionar ao catálogo._`;
                        responseMessage = responseMessage
                            ? `${responseMessage}${avisoNaoReconhecido}`
                            : avisoNaoReconhecido.trim();
                    }
                    // Atualizar streak apenas se pelo menos um exercício foi registado
                    const algumRegistado = result.exercises.length > unrecognizedExercises.length;
                    if (algumRegistado) {
                        await progressionService.updateStreak(user.id);
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
                    await progressionService.updateStreak(user.id);
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
                    responseMessage = await coachAgent.generateMotivationalCheckIn(user.name ?? null);
                    await progressionService.updateStreak(user.id);
                    break;
                }
                case "unknown":
                default: {
                    responseMessage = result.message;
                    break;
                }
            }
            // Enviar indicador "a escrever..." (fire-and-forget)
            wapiService.sendTyping(phone).catch(() => { });
            // Enviar resposta ao utilizador
            await wapiService.sendTextMessage(phone, responseMessage);
            await redisService.setMessageProcessed(idempotencyKey);
            return reply.status(200).send({ ok: true });
        }
        catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            const errStack = error instanceof Error ? error.stack : "";
            logger.error({ phone, message: errMsg, stack: errStack }, "webhook error");
            // Tentar enviar mensagem de fallback — nunca retornar 5xx
            wapiService.sendTextMessage(phone, FALLBACK_MESSAGE).catch(() => { });
            return reply.status(200).send({ ok: true });
        }
    });
};
export default webhookRoute;
//# sourceMappingURL=webhook.js.map