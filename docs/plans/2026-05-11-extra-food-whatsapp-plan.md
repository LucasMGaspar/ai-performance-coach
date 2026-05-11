# Plano: Extra Food Logging no WhatsApp
Data: 2026-05-11
Branch: feat/extra-food-whatsapp

## Contexto

Quando o utilizador diz "comi o almoço + 100g de purê extra", o parser actual apenas extrai a refeição principal ("Almoço") e ignora o item extra. O utilizador quer que o extra seja contabilizado no total do dia.

## Solução

Adicionar campo `extraItems` ao schema de extracção `diet`. O parser extrai itens extras além da refeição principal. O webhook cria um `DietLog` separado por cada extra (nome: "{refeição} - {item}"), que aparece na secção "Registros Extras" do dashboard e é somado ao total diário.

## Passos de Implementação

---

### Passo 1 — Schema de extracção

**Ficheiro:** `src/schemas/extraction.schema.ts`

Adicionar `ExtraDietItemSchema` e campo `extraItems` ao `DietExtractionSchema`:

```ts
export const ExtraDietItemSchema = z.object({
  name: z.string(),           // "Purê de batata"
  quantity: z.string().nullish(), // "100g" (informativo)
  calories: z.number(),
  protein: z.number(),
  carbs: z.number().nullish(),
  fat: z.number().nullish(),
});

export const DietExtractionSchema = z.object({
  type: z.literal("diet"),
  meal: z.string(),
  calories: z.number().nullish(),
  protein: z.number().nullish(),
  carbs: z.number().nullish(),
  fat: z.number().nullish(),
  description: z.string().nullish(),
  extraItems: z.array(ExtraDietItemSchema).nullish(), // ← NOVO
});
```

Exportar também o tipo: `export type ExtraDietItem = z.infer<typeof ExtraDietItemSchema>;`

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 2 — Parser: tool schema + prompt

**Ficheiro:** `src/agents/parser.agent.ts`

**2a. Adicionar `extraItems` ao `EXTRACTION_TOOL`** (dentro de `input_schema.properties`, após `description`):

```ts
extraItems: {
  type: "array",
  description: "Itens extras consumidos além da refeição principal (ex: '+ 100g de purê'). Apenas para type=diet.",
  items: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nome do item extra" },
      quantity: { type: "string", description: "Quantidade mencionada (ex: '100g')" },
      calories: { type: "number", description: "Calorias estimadas" },
      protein: { type: "number", description: "Proteína em gramas estimada" },
      carbs: { type: "number", description: "Hidratos em gramas estimados" },
      fat: { type: "number", description: "Gordura em gramas estimada" },
    },
    required: ["name", "calories", "protein"],
  },
},
```

**2b. Actualizar `STATIC_SYSTEM_PROMPT`** — adicionar instrução após as REGRAS existentes:

```
- Se o utilizador mencionar itens extras além da refeição principal (ex: "+ 100g de purê", "mais um iogurte"), preencher extraItems com cada item e estimar os seus macros. Os macros da refeição principal mantêm-se inalterados.
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 3 — Webhook: processar extraItems

**Ficheiro:** `src/routes/webhook.ts`

No `case "diet"`, após o bloco que cria/actualiza o DietLog principal (linhas ~259-302), adicionar:

```ts
// Registar itens extras se existirem
if (result.extraItems && result.extraItems.length > 0) {
  for (const extra of result.extraItems) {
    // @ts-ignore
    await prisma.dietLog.create({
      data: {
        userId: user.id,
        meal: `${result.meal} - ${extra.name}`,
        calories: extra.calories,
        protein: extra.protein,
        carbs: extra.carbs ?? null,
        fat: extra.fat ?? null,
        notes: extra.quantity ? `Extra: ${extra.quantity}` : "Item extra",
      },
    });
  }
}
```

O código acima fica entre o bloco do log principal e a linha `responseMessage = await dietAgent.analyzeDietLog(user.id);`.

**Verificação:** `npx tsc --noEmit` sem erros.

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] `npm run test` — testes existentes continuam a passar
- [ ] Enviar "comi o almoço + 100g de purê extra" → bot responde com totais incluindo o extra
- [ ] Dashboard: aparece "Almoço" + "Almoço - Purê de batata" na secção de extras

## Fora de Escopo

- UI no dashboard para editar itens extras
- Parser com múltiplas refeições principais no mesmo registo
- Estimativa automática com base em tabela nutricional

## Package Manager

`package-lock.json` na raiz → npm
