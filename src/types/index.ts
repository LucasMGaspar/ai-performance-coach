// Tipos reutilizáveis do domínio

export type NudgeType = "diet" | "workout" | "checkin";

// Payload real da w-api.app
export interface WApiMessagePayload {
  event: string;
  instanceId: string;
  connectedPhone: string;
  fromMe: boolean;
  sender: {
    id: string;
    pushName?: string;
  };
  msgContent: {
    conversation?: string;
    audioMessage?: {
      URL: string;
      mediaKey: string;
      mimetype?: string;
      seconds?: number;
      PTT?: boolean;
    };
    imageMessage?: {
      url: string;
      mimetype?: string;
      caption?: string;
    };
  };
}
