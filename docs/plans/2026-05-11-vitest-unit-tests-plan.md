# Plano: Suite de Testes com Vitest
Data: 2026-05-11
Branch: chore/vitest-unit-tests

## Contexto

O projecto não tem nenhum teste. A lógica de negócio mais crítica está em funções privadas
ou acoplada ao DB — impossível testar sem refactoring mínimo.

Ficheiros alvo:
- `src/schemas/extraction.schema.ts` — `parseExtraction` já é exportada; zero refactoring necessário
- `src/services/progression.service.ts` — `toDayStart` é `private static`; lógica de streak embutida em `updateStreak` (chama prisma)
- `src/agents/parser.agent.ts` — `applyWeightPerSideRule` é `private` na classe

Para testar sem DB/Redis/Anthropic, os dois últimos precisam de extrair a lógica pura como funções exportadas.

## Objectivo

- `npm run test` corre 3 suites de testes unitários sem DB, sem Redis, sem Anthropic
- Cobrir os casos críticos: streak (consecutivo, quebrado, mesmo dia, primeiro log), peso "de cada lado" (com barra, sem barra, sem weightPerSide), parseExtraction (tipos válidos, tipos inválidos, validações Zod)
- Zero mocks — lógica testada é 100% pura

## Passos de Implementação

### Passo 1 — Instalar Vitest

```bash
npm install --save-dev vitest
```

**Verificação:** `vitest` em `devDependencies` no `package.json`.

---

### Passo 2 — Criar `vitest.config.ts`

**Ficheiro:** `vitest.config.ts` (raiz do projecto)

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

Sem `globals: true` — os testes importam `describe`, `it`, `expect` explicitamente de `"vitest"`.

---

### Passo 3 — Adicionar script `test` ao `package.json`

Adicionar ao objecto `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

---

### Passo 4 — Exportar helpers puros de `progression.service.ts`

**Ficheiro:** `src/services/progression.service.ts`

**O que muda:**
1. Converter `private static toDayStart` em função exportada de módulo:
   ```ts
   // antes (linha 48):
   private static toDayStart(d: Date): Date {
     return new Date(d.toISOString().split("T")[0] + "T00:00:00.000Z");
   }
   ```
   ```ts
   // depois — função de módulo exportada + método estático delega para ela:
   export function toDayStart(d: Date): Date {
     return new Date(d.toISOString().split("T")[0] + "T00:00:00.000Z");
   }
   ```
   Actualizar referências internas de `ProgressionService.toDayStart(x)` para `toDayStart(x)`.

2. Adicionar função exportada pura `calcNewStreak` **antes** da classe:
   ```ts
   export function calcNewStreak(
     now: Date,
     lastLog: Date | null,
     currentStreak: number
   ): number {
     if (!lastLog) return 1;
     const diffInDays = Math.round(
       (toDayStart(now).getTime() - toDayStart(lastLog).getTime()) /
         (1000 * 60 * 60 * 24)
     );
     if (diffInDays === 1) return currentStreak + 1;
     if (diffInDays > 1) return 1;
     return currentStreak; // mesmo dia
   }
   ```

3. Actualizar `updateStreak` para usar `calcNewStreak`:
   ```ts
   // substituir o bloco if/else de streak (linhas 64-81) por:
   const newStreak = calcNewStreak(now, lastLog, user.streakCount);
   ```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 5 — Exportar `applyWeightPerSideRule` de `parser.agent.ts`

**Ficheiro:** `src/agents/parser.agent.ts`

**O que muda:**
1. Extrair o método privado como função exportada de módulo, logo após os imports e antes de `EXTRACTION_TOOL`:
   ```ts
   export function applyWeightPerSideRule(
     result: ExtractionResult,
     catalog: { name: string; aliases: string[]; barWeightKg: number | null }[]
   ): ExtractionResult {
     if (result.type !== "workout") return result;
     const exercises = result.exercises.map((exercise) => {
       if (exercise.weightPerSide == null) return exercise;
       const weightPerSide = exercise.weightPerSide;
       const nameLower = exercise.exerciseName.toLowerCase();
       const catalogEntry = catalog.find((entry) => {
         const entryNameLower = entry.name.toLowerCase();
         if (entryNameLower.includes(nameLower) || nameLower.includes(entryNameLower)) return true;
         return entry.aliases.some((alias) => {
           const aliasLower = alias.toLowerCase();
           return aliasLower.includes(nameLower) || nameLower.includes(aliasLower);
         });
       });
       const totalWeight =
         catalogEntry?.barWeightKg != null
           ? weightPerSide * 2 + catalogEntry.barWeightKg
           : weightPerSide * 2;
       const { weightPerSide: _removed, ...rest } = exercise;
       return { ...rest, totalWeight };
     });
     return { ...result, exercises };
   }
   ```

2. O método privado da classe passa a delegar:
   ```ts
   private applyWeightPerSideRule(
     result: ExtractionResult,
     catalog: ExerciseCatalog[]
   ): ExtractionResult {
     return applyWeightPerSideRule(result, catalog);
   }
   ```

**Nota:** O parâmetro `catalog` da função exportada usa tipo estrutural mínimo
`{ name: string; aliases: string[]; barWeightKg: number | null }[]`
em vez de `ExerciseCatalog[]` do Prisma — evita dependência de `@prisma/client` nos testes.
`ExerciseCatalog` satisfaz este tipo, por isso a delegação compila sem cast.

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 6 — Criar testes

**Directório:** `tests/` (raiz do projecto, fora de `src/`)

#### `tests/extraction.schema.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { parseExtraction } from "../src/schemas/extraction.schema";

describe("parseExtraction", () => {
  it("parses valid workout", () => {
    const result = parseExtraction({
      type: "workout",
      exercises: [{ exerciseName: "Supino", reps: 8, sets: 4 }],
    });
    expect(result.type).toBe("workout");
  });

  it("parses valid diet", () => {
    const result = parseExtraction({ type: "diet", meal: "Almoço", calories: 500 });
    expect(result.type).toBe("diet");
  });

  it("parses valid checkin", () => {
    const result = parseExtraction({ type: "checkin", mood: 8 });
    expect(result.type).toBe("checkin");
  });

  it("parses valid question", () => {
    const result = parseExtraction({ type: "question", question: "qual minha dieta?" });
    expect(result.type).toBe("question");
  });

  it("parses valid unknown with message", () => {
    const result = parseExtraction({ type: "unknown", message: "não entendido" });
    expect(result.type).toBe("unknown");
  });

  it("throws on unknown type string", () => {
    expect(() => parseExtraction({ type: "invalid" })).toThrow();
  });

  it("throws on workout without exercises array", () => {
    expect(() => parseExtraction({ type: "workout" })).toThrow();
  });

  it("throws on mood out of range (11)", () => {
    expect(() => parseExtraction({ type: "checkin", mood: 11 })).toThrow();
  });

  it("throws on rpe out of range (0)", () => {
    expect(() =>
      parseExtraction({
        type: "workout",
        exercises: [{ exerciseName: "Supino", reps: 8, sets: 4, rpe: 0 }],
      })
    ).toThrow();
  });
});
```

#### `tests/progression.streak.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { toDayStart, calcNewStreak } from "../src/services/progression.service";

describe("toDayStart", () => {
  it("truncates datetime to midnight UTC", () => {
    const d = new Date("2024-01-15T14:30:00.000Z");
    expect(toDayStart(d).toISOString()).toBe("2024-01-15T00:00:00.000Z");
  });

  it("midnight stays midnight", () => {
    const d = new Date("2024-01-15T00:00:00.000Z");
    expect(toDayStart(d).toISOString()).toBe("2024-01-15T00:00:00.000Z");
  });
});

describe("calcNewStreak", () => {
  const now = new Date("2024-01-15T10:00:00.000Z");

  it("first ever log — streak starts at 1", () => {
    expect(calcNewStreak(now, null, 0)).toBe(1);
  });

  it("consecutive day — increments streak", () => {
    const yesterday = new Date("2024-01-14T22:00:00.000Z");
    expect(calcNewStreak(now, yesterday, 5)).toBe(6);
  });

  it("same day (morning + evening) — streak unchanged", () => {
    const sameDay = new Date("2024-01-15T06:00:00.000Z");
    expect(calcNewStreak(now, sameDay, 5)).toBe(5);
  });

  it("gap of 2 days — streak resets to 1", () => {
    const twoDaysAgo = new Date("2024-01-13T10:00:00.000Z");
    expect(calcNewStreak(now, twoDaysAgo, 7)).toBe(1);
  });

  it("gap of 10 days — streak resets to 1", () => {
    const tenDaysAgo = new Date("2024-01-05T10:00:00.000Z");
    expect(calcNewStreak(now, tenDaysAgo, 20)).toBe(1);
  });
});
```

#### `tests/parser.weight.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { applyWeightPerSideRule } from "../src/agents/parser.agent";

const catalog = [
  { name: "Supino Reto", aliases: ["supino", "bench press"], barWeightKg: 20 },
  { name: "Leg Press", aliases: ["leg press"], barWeightKg: null },
];

describe("applyWeightPerSideRule", () => {
  it("passes through non-workout types unchanged", () => {
    const input = { type: "diet" as const, meal: "Almoço" };
    expect(applyWeightPerSideRule(input, catalog)).toEqual(input);
  });

  it("calculates total weight with bar when exercise found in catalog", () => {
    const input = {
      type: "workout" as const,
      exercises: [{ exerciseName: "supino", weightPerSide: 40, reps: 8, sets: 4 }],
    };
    const result = applyWeightPerSideRule(input, catalog);
    if (result.type !== "workout") throw new Error("expected workout");
    expect(result.exercises[0].totalWeight).toBe(100); // 40*2 + 20
    expect(result.exercises[0].weightPerSide).toBeUndefined();
  });

  it("calculates total weight without bar when exercise not in catalog", () => {
    const input = {
      type: "workout" as const,
      exercises: [{ exerciseName: "Rosca Direta", weightPerSide: 15, reps: 12, sets: 3 }],
    };
    const result = applyWeightPerSideRule(input, catalog);
    if (result.type !== "workout") throw new Error("expected workout");
    expect(result.exercises[0].totalWeight).toBe(30); // 15*2
  });

  it("calculates total weight without bar when barWeightKg is null", () => {
    const input = {
      type: "workout" as const,
      exercises: [{ exerciseName: "leg press", weightPerSide: 50, reps: 10, sets: 4 }],
    };
    const result = applyWeightPerSideRule(input, catalog);
    if (result.type !== "workout") throw new Error("expected workout");
    expect(result.exercises[0].totalWeight).toBe(100); // 50*2, sem barra
  });

  it("leaves exercise unchanged when weightPerSide is null", () => {
    const input = {
      type: "workout" as const,
      exercises: [{ exerciseName: "Supino", totalWeight: 90, reps: 8, sets: 4 }],
    };
    const result = applyWeightPerSideRule(input, catalog);
    if (result.type !== "workout") throw new Error("expected workout");
    expect(result.exercises[0].totalWeight).toBe(90);
  });

  it("matches by alias (case-insensitive)", () => {
    const input = {
      type: "workout" as const,
      exercises: [{ exerciseName: "Bench Press", weightPerSide: 30, reps: 6, sets: 5 }],
    };
    const result = applyWeightPerSideRule(input, catalog);
    if (result.type !== "workout") throw new Error("expected workout");
    expect(result.exercises[0].totalWeight).toBe(80); // 30*2 + 20
  });
});
```

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] `npm run test` — todos os testes passam (sem DB, sem API keys)
- [ ] `grep -r "console\." src/ --include="*.ts" | grep -v config.ts` — nenhum resultado

## Fora de Escopo

- Integration tests com Prisma test DB
- Mocking de Anthropic para testar agentes end-to-end
- Evals (dataset de mensagens reais com extracção esperada)
- `calculateTDEE` e `isConfirmation` de onboarding.agent.ts (útil mas secundário)
- Coverage report (`@vitest/coverage-v8`)

## Package Manager

npm — `package-lock.json` na raiz.
