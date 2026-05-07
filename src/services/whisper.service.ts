import OpenAI from "openai";
import { config } from "../config";

class WhisperService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: config.openaiApiKey });
  }

  async transcribeAudio(audioUrl: string): Promise<string> {
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const file = new File([buffer], "audio.ogg", { type: "audio/ogg" });

    const transcription = await this.openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "pt",
    });

    return transcription.text ?? "";
  }
}

export const whisperService = new WhisperService();
