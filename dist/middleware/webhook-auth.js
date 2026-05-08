import { config } from "../config";
import { timingSafeEqual } from "crypto";
export function webhookAuthHook(request, reply, done) {
    const authorization = request.headers["authorization"];
    if (!authorization || !authorization.startsWith("Bearer ")) {
        reply.status(401).send({ error: "Unauthorized" });
        return;
    }
    const token = authorization.slice(7);
    const secret = config.webhookSecret;
    if (token.length !== secret.length) {
        reply.status(401).send({ error: "Unauthorized" });
        return;
    }
    const tokenBuffer = Buffer.from(token);
    const secretBuffer = Buffer.from(secret);
    if (!timingSafeEqual(tokenBuffer, secretBuffer)) {
        reply.status(401).send({ error: "Unauthorized" });
        return;
    }
    done();
}
//# sourceMappingURL=webhook-auth.js.map