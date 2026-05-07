import OpenAI from "openai";
import { hkdfSync, createDecipheriv } from "crypto";
import { config } from "../config";

class WhisperService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.groqApiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  // Desencripta áudio WhatsApp usando AES-256-CBC com chave derivada via HKDF
  private decryptWhatsAppAudio(encryptedBuffer: Buffer, mediaKeyBase64: string): Buffer {
    const mediaKey = Buffer.from(mediaKeyBase64, "base64");
    const info = Buffer.from("WhatsApp Audio Keys");
    const expanded = Buffer.from(
      hkdfSync("sha256", mediaKey, Buffer.alloc(32), info, 112)
    );
    const iv = expanded.slice(0, 16);
    const aesKey = expanded.slice(16, 48);
    // Remover últimos 10 bytes (HMAC truncado)
    const ciphertext = encryptedBuffer.slice(0, -10);
    const decipher = createDecipheriv("aes-256-cbc", aesKey, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  async transcribeAudio(audioUrl: string, mediaKey?: string): Promise<string> {
    const response = await fetch(audioUrl);
    const bytes = await response.bytes();
    const raw: Buffer = Buffer.from(bytes) as Buffer;
    const buffer: Buffer = mediaKey ? this.decryptWhatsAppAudio(raw, mediaKey) : raw;

    const file = new File([new Uint8Array(buffer)], "audio.ogg", { type: "audio/ogg" });

    const transcription = await this.client.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      language: "pt",
    });

    return transcription.text ?? "";
  }
}

export const whisperService = new WhisperService();
