// Tipos reutilizáveis do domínio

export type MessageType = "text" | "audio" | "image" | "document";

export type NudgeType = "diet" | "workout" | "checkin";

export interface WApiMessagePayload {
  event: string;
  instanceId: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    pushName?: string;
    message: {
      conversation?: string;
      extendedTextMessage?: {
        text: string;
      };
      audioMessage?: {
        url: string;
        mimetype: string;
        seconds: number;
      };
      imageMessage?: {
        url: string;
        mimetype: string;
        caption?: string;
      };
      documentMessage?: {
        url: string;
        mimetype: string;
        title?: string;
        fileName?: string;
      };
    };
    messageType: MessageType;
    messageTimestamp: number;
  };
}
