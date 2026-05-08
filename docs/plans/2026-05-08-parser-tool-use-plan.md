# Plano: Parser Agent — tool use Anthropic
Data: 2026-05-08
Branch: feat/parser-tool-use

## Contexto

`src/agents/parser.agent.ts` pede ao Claude "Responda APENAS com JSON válido", usa regex para strip de ` ```json ``` ` e chama `JSON.parse()` que pode lançar excepção se o modelo responder fora do padrão.

A abordagem correcta no SDK Anthropic é definir um `tool` com `input_schema` (JSON Schema) e usar `tool_choice: { type: "tool", name: "..." }` — o modelo é obrigado a chamar a tool e o SDK garante que o `input` é JSON válido conforme o schema. Elimina regex, elimina `JSON.parse` frágil, reduz tokens de saída.

`zod-to-json-schema` não está instalado. O JSON Schema será escrito manualmente como superset dos 5 tipos (todos os campos opcionais excepto `type`). O Zod (`parseExtraction`) mantém-se para validação TypeScript pós-extracção.

## Objectivo

- Chamada ao Claude usa `tools` + `tool_choice: { type: "tool", name: "extract_message" }`
- Resultado lido de `response.content[0].input` (já é objecto JS, sem JSON.parse)
- Regex de strip removida
- System prompt simplificado (sem bloco "SCHEMAS OBRIGATÓRIOS" nem "Responda APENAS com JSON")
- Zod (`parseExtraction`) mantém-se para type safety

## Passos de Implementação

### Passo 1 — Definir `EXTRACTION_TOOL` como constante de módulo

**Ficheiro:** `src/agents/parser.agent.ts`

Adicionar após as importações e antes de `STATIC_SYSTEM_PROMPT`:

```ts
const EXTRACTION_TOOL: Anthropic.Tool = {
  name: "extract_message",
  description: "Extrai dados estruturados de treino, dieta, check-in ou pergunta da mensagem do utilizador.",
  input_schema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        enum: ["workout", "diet", "checkin", "question", "unknown"],
        description: "Tipo de mensagem detectado",
      },
      exercises: {
        type: "array",
        description: "Lista de exercícios (apenas para type=workout)",
        items: {
          type: "object",
          properties: {
            exerciseName: { type: "string" },
            weightPerSide: { type: "number", description: "Kg de cada lado (quando user diz 'X de cada lado')" },
            totalWeight: { type: "number", description: "Peso total em kg" },
            reps: { type: "integer" },
            sets: { type: "integer" },
            rpe: { type: "number", description: "Rate of Perceived Exertion 1-10" },
          },
          required: ["exerciseName", "reps", "sets"],
        },
      },
      meal: { type: "string", description: "Nome da refeição (apenas para type=diet)" },
      calories: { type: "number" },
      protein: { type: "number", description: "Proteína em gramas" },
      carbs: { type: "number", description: "Hidratos em gramas" },
      fat: { type: "number", description: "Gordura em gramas" },
      description: { type: "string", description: "Descrição livre da refeição" },
      mood: { type: "integer", description: "Humor 1-10 (apenas para type=checkin)" },
      sleepQuality: { type: "integer", description: "Qualidade do sono 1-10" },
      energyLevel: { type: "integer", description: "Nível de energia 1-10" },
      notes: { type: "string", description: "Notas livres do check-in" },
      question: { type: "string", description: "Pergunta do utilizador (apenas para type=question)" },
      message: { type: "string", description: "Resposta útil em português (apenas para type=unknown)" },
    },
    required: ["type"],
  },
};
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 2 — Simplificar `STATIC_SYSTEM_PROMPT`

**Ficheiro:** `src/agents/parser.agent.ts`

Substituir o valor actual de `STATIC_SYSTEM_PROMPT` pelo seguinte (remove bloco "SCHEMAS OBRIGATÓRIOS" e instrução "Responda APENAS com JSON"):

```ts
const STATIC_SYSTEM_PROMPT = `Você é um assistente de extracção de dados de treino e dieta. Analise a mensagem do utilizador e use a ferramenta extract_message para extrair as informações estruturadas.

REGRA CRÍTICA — PESO "DE CADA LADO":
- Se o utilizador disser "Xkg de cada lado", "X de cada lado", "X por lado" — preencher weightPerSide com X
- NÃO calcular totalWeight — deixar null (será calculado pelo sistema)
- Se disser o peso total directamente (ex: "90kg no supino") — preencher totalWeight directamente

CATÁLOGO DE EXERCÍCIOS:
O catálogo abaixo contém os exercícios disponíveis com seus aliases. Use-o para normalizar o nome do exercício.

REGRAS:
- O campo "exercises" é SEMPRE um array (mesmo com 1 exercício)
- Se o utilizador mencionar uma refeição das suas refeições planeadas (ex: "jantei"), utilize os macros planeados para preencher os campos de Dieta
- Se o utilizador fizer uma pergunta sobre o seu plano de treino, dieta, ou macros (ex: "qual a minha dieta?"), use type="question" com a pergunta
- O campo "message" em type="unknown" é OBRIGATÓRIO e deve conter uma resposta útil ao utilizador em português`;
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 3 — Actualizar `parseMessage` para usar tool use

**Ficheiro:** `src/agents/parser.agent.ts`

Dentro do método `parseMessage`, substituir o bloco `try` actual:

```ts
// ANTES — a substituir:
try {
  const response = await this.client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemMessages,
    messages: [
      {
        role: "user",
        content: `${text}\n\nResponda APENAS com JSON válido.`,
      },
    ],
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip de markdown code blocks que o Claude por vezes adiciona (```json ... ```)
  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  // Parse e validação com Zod
  const parsed = parseExtraction(JSON.parse(cleaned));

  // 5. Aplicar regra de negócio "de cada lado"
  return this.applyWeightPerSideRule(parsed, exerciseCatalog);
} catch (err) {
  console.error("parser.agent: erro ao processar mensagem —", err);
  return {
    type: "unknown",
    message: "Não consegui processar a mensagem. Tenta de novo!",
  };
}
```

Por:

```ts
// DEPOIS:
try {
  const response = await this.client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemMessages,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "tool", name: "extract_message" },
    messages: [
      {
        role: "user",
        content: text,
      },
    ],
  });

  // tool_choice força tool_use — input já é objecto JS validado pelo SDK
  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Resposta inesperada: nenhum bloco tool_use encontrado");
  }

  // Validação com Zod para type safety TypeScript
  const parsed = parseExtraction(toolBlock.input);

  // Aplicar regra de negócio "de cada lado"
  return this.applyWeightPerSideRule(parsed, exerciseCatalog);
} catch (err) {
  console.error("parser.agent: erro ao processar mensagem —", err);
  return {
    type: "unknown",
    message: "Não consegui processar a mensagem. Tenta de novo!",
  };
}
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] Sem referências a `JSON.parse` nem ao regex de strip no método `parseMessage`

## Fora de Escopo

- Instalar `zod-to-json-schema` (seria melhor a longo prazo, mas não necessário agora)
- Mudar o modelo (manter `claude-sonnet-4-5` existente)
- Alterar `applyWeightPerSideRule` ou os schemas Zod
- Cache de prompt — estrutura mantida igual (system messages com `cache_control`)

## Package Manager

npm — `package-lock.json` na raiz. Sem novas dependências.
