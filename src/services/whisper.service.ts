import OpenAI from "openai";
import { config } from "../config";

class WhisperService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.groqApiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }

  async transcribeAudio(audioUrl: string): Promise<string> {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const file = new File([buffer], "audio.ogg", { type: "audio/ogg" });

    const transcription = await this.client.audio.transcriptions.create({
      file,
      model: "whisper-large-v3-turbo",
      language: "pt",
    });

    return transcription.text ?? "";
  }
}

export const whisperService = new WhisperService();
