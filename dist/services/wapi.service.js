import { config } from "../config";
import { logger } from "../lib/logger";
const BASE_URL = "https://api.w-api.app/v1";
class WApiService {
    headers;
    instanceId;
    constructor() {
        this.headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.wapiToken}`,
        };
        this.instanceId = config.wapiInstanceId;
    }
    url(path) {
        return `${BASE_URL}${path}?instanceId=${this.instanceId}`;
    }
    async sendTextMessage(phone, message) {
        const response = await fetch(this.url("/message/send-text"), {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ phone, message, delayMessage: 1 }),
        });
        if (!response.ok) {
            logger.error({ status: response.status, body: await response.text().catch(() => "") }, "wapi: erro ao enviar mensagem");
            throw new Error("wapi: falha ao enviar mensagem");
        }
    }
    async sendTyping(phone) {
        await fetch(this.url("/chat/presence"), {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({ phone, presence: "composing" }),
        }).catch(() => { });
    }
}
export const wapiService = new WApiService();
//# sourceMappingURL=wapi.service.js.map