import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

export const anthropicClient = new Anthropic({ apiKey: config.anthropicApiKey });
