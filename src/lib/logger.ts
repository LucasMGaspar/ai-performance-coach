import pino from "pino";
import { config } from "../config";

export const logger = pino({
  level: config.nodeEnv === "production" ? "info" : "debug",
  redact: {
    paths: ["phone", "phoneNumber", "apiKey", "token", "*.phone", "*.phoneNumber"],
    censor: "[REDACTED]",
  },
  transport:
    config.nodeEnv !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});
