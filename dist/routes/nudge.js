// Rota interna para nudges — chamada pelo n8n via cron
// POST /internal/nudge
// Auth: Bearer <NUDGE_SECRET>
import { timingSafeEqual } from "crypto";
import { config } from "../config.js";
import { nudgeAgent } from "../agents/nudge.agent.js";
function verifyNudgeAuth(request, reply) {
    const authHeader = request.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
        reply.status(401).send({ error: "Unauthorized" });
        return false;
    }
    const token = authHeader.slice(7);
    const secret = config.nudgeSecret;
    // Tokens com tamanhos diferentes são rejeitados antes do timingSafeEqual
    // (evita timing leak e erro de Buffer incompatível)
    if (token.length !== secret.length) {
        reply.status(401).send({ error: "Unauthorized" });
        return false;
    }
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(secret);
    if (!timingSafeEqual(tokenBuffer, secretBuffer)) {
        reply.status(401).send({ error: "Unauthorized" });
        return false;
    }
    return true;
}
const nudgeRoute = async (fastify) => {
    fastify.post("/internal/nudge", async (request, reply) => {
        // Autenticação manual com NUDGE_SECRET
        if (!verifyNudgeAuth(request, reply)) {
            return;
        }
        const { userId, phoneNumber, nudgeType, mealLabel } = request.body;
        // Validação básica dos campos obrigatórios
        if (!userId || !phoneNumber || !nudgeType) {
            return reply
                .status(400)
                .send({ error: "userId, phoneNumber e nudgeType são obrigatórios" });
        }
        const validTypes = ["diet", "workout", "checkin"];
        if (!validTypes.includes(nudgeType)) {
            return reply
                .status(400)
                .send({ error: `nudgeType inválido — valores aceites: ${validTypes.join(", ")}` });
        }
        const sent = await nudgeAgent.checkAndNudge(userId, phoneNumber, nudgeType, mealLabel);
        // Retornar sempre 200, independentemente de ter enviado ou não
        return reply.status(200).send({ sent });
    });
};
export default nudgeRoute;
//# sourceMappingURL=nudge.js.map