import { config } from "../config";

const BASE_URL = "https://api.w-api.app/v1";

class WApiService {
  private readonly headers: Record<string, string>;
  private readonly instanceId: string;

  constructor() {
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.wapiToken}`,
    };
    this.instanceId = config.wapiInstanceId;
  }

  private url(path: string): string {
    return `${BASE_URL}${path}?instanceId=${this.instanceId}`;
  }

  async sendTextMessage(phone: string, message: string): Promise<void> {
    const response = await fetch(this.url("/message/send-text"), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ phone, message, delayMessage: 1 }),
    });

    if (!response.ok) {
      console.error(
        `wapi: erro ao enviar mensagem — status ${response.status}`,
        await response.text().catch(() => "")
      );
      throw new Error("wapi: falha ao enviar mensagem");
    }
  }

  async sendTyping(phone: string): Promise<void> {
    await fetch(this.url("/chat/presence"), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ phone, presence: "composing" }),
    }).catch(() => {});
  }
}

export const wapiService = new WApiService();
