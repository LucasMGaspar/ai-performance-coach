import { config } from "../config.js";

class WApiService {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor() {
    this.baseUrl = config.wapiBaseUrl;
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.wapiToken}`,
    };
  }

  async sendTextMessage(phone: string, message: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/message/send-text`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ phone, message }),
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
    await fetch(`${this.baseUrl}/chat/presence`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ phone, presence: "composing" }),
    }).catch(() => {});
  }
}

export const wapiService = new WApiService();
