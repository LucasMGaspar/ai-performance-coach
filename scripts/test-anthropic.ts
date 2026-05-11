import Anthropic from '@anthropic-ai/sdk';
import { config } from './src/config';

const client = new Anthropic({ apiKey: config.anthropicApiKey });
const prompt = `Extrai do texto seguinte os dados de perfil do utilizador e retorna APENAS um JSON válido.
Campos: name (string), age (number), sex ("masculino" | "feminino"), weightKg (number em kg), heightCm (number em cm).
Se algum campo não estiver presente, omite-o. Responde APENAS com o JSON, sem explicações.

Texto: "Daniel, 27 anos, masculino, 110kg, 178cm"`;

client.messages.create({
  model: 'claude-3-5-sonnet-20240620',
  max_tokens: 1024,
  messages: [{ role: 'user', content: prompt }]
}).then(r => console.log(r.content[0])).catch(console.error);
