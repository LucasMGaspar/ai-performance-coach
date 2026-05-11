# Plano: Coach Agent v2 com Tool Use Anthropic
Data: 2026-05-11
Branch: feat/coach-agent-v2

## Contexto

O `CoachAgent.analyzeWorkout` actual é 100% determinístico — compara volume com o treino anterior e devolve uma string com base em RPE. Não há chamada a Claude, não há detecção de plateau, não há contexto de dieta ou bem-estar.

Objectivo: substituir `analyzeWorkout` por um agente Claude com tool use que acede ao histórico real do utilizador antes de gerar feedback personalizado.

Padrão async: o webhook envia uma confirmação rápida imediatamente (evita timeout WhatsApp) e depois o agente Claude envia a análise como segunda mensagem.

## Objectivo

- `analyzeWorkout` chama Claude `claude-sonnet-4-6` com 5 tools disponíveis
- Claude decide quais tools invocar (get_exercise_history, compute_e1rm, detect_plateau, get_diet_summary, get_checkin_history)
- Output: 1-3 frases naturais em PT-BR + 1 insight accionável, formato WhatsApp
- Webhook envia confirmação rápida sincronamente; análise Claude chega como segunda mensagem (fire-and-forget)
- `analyzeDiet` e `generateMotivationalCheckIn` permanecem inalterados

## Passos de Implementação

---

### Passo 1 — Adicionar queries ao `rag.service.ts`

**Ficheiro:** `src/services/rag.service.ts`

**O que muda:**

1. Adicionar interface local `DailyCheckIn` antes da classe:
```ts
interface DailyCheckIn {
  id: string;
  userId: string;
  date: Date;
  mood: number;
  sleepQuality: number;
  energyLevel: number;
  notes: string | null;
}
```

2. Adicionar método `getLastNWorkouts(userId, exerciseId, n)`:
```ts
async getLastNWorkouts(
  userId: string,
  exerciseId: string,
  n: number
): Promise<WorkoutLog[]> {
  const logs = await prisma.workoutLog.findMany({
    where: { userId, exerciseId },
    orderBy: { date: "desc" },
    take: n,
    select: {
      id: true, userId: true, exerciseId: true, date: true,
      weightKg: true, reps: true, sets: true, rpe: true, volume: true, rawInput: true,
    },
  });
  return logs as WorkoutLog[];
}
```

3. Adicionar método `getCheckinHistory(userId, days)`:
```ts
async getCheckinHistory(userId: string, days: number): Promise<DailyCheckIn[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const logs = await prisma.dailyCheckIn.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "desc" },
    select: {
      id: true, userId: true, date: true,
      mood: true, sleepQuality: true, energyLevel: true, notes: true,
    },
  });
  return logs as DailyCheckIn[];
}
```

4. Adicionar método `getDietSummaryDays(userId, days)`:
```ts
async getDietSummaryDays(
  userId: string,
  days: number
): Promise<{ calories: number; protein: number; mealsLogged: string[] }> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const logs = await prisma.dietLog.findMany({
    where: { userId, date: { gte: since } },
    select: { meal: true, calories: true, protein: true },
  });
  const calories = logs.reduce((s: number, l: { calories: number }) => s + l.calories, 0);
  const protein = logs.reduce((s: number, l: { protein: number }) => s + l.protein, 0);
  const mealsLogged = logs.map((l: { meal: string }) => l.meal);
  return { calories, protein, mealsLogged };
}
```

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 2 — Reescrever `coach.agent.ts` com tool use

**Ficheiro:** `src/agents/coach.agent.ts`

**O que muda:**

1. Adicionar imports no topo:
```ts
import Anthropic from "@anthropic-ai/sdk";
import { anthropicClient } from "../lib/anthropic";
import { logger } from "../lib/logger";
```

2. Adicionar constante `COACH_SYSTEM_PROMPT` antes da classe:
```ts
const COACH_SYSTEM_PROMPT = `Você é um coach de Strength & Conditioning especializado em protocolos de 80 dias. Analise o treino registado e forneça feedback personalizado em português do Brasil.

Processo de raciocínio:
1. Consulte o histórico do exercício (get_exercise_history) para ver progressão
2. Calcule E1RM (compute_e1rm) com os dados actuais para quantificar força
3. Verifique plateau (detect_plateau) se houver histórico suficiente
4. Se RPE alto ou volume baixo, verifique bem-estar recente (get_checkin_history, 3 dias)
5. Se relevante para a progressão, consulte dieta recente (get_diet_summary, 1 dia)

Output:
- 1-3 frases naturais, tom de coach directo
- 1 insight accionável específico (ex: "Na próxima sessão tente 82,5kg" ou "Sono baixo — priorize recuperação antes de aumentar carga")
- Formato WhatsApp: sem markdown, máximo 4 linhas, use emojis com moderação`;
```

3. Adicionar constante `COACH_TOOLS` antes da classe:
```ts
const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_exercise_history",
    description: "Get the last N workout sessions for a specific exercise for this user",
    input_schema: {
      type: "object" as const,
      properties: {
        exerciseId: { type: "string", description: "Exercise ID" },
        n: { type: "number", description: "Number of past sessions to retrieve (max 10)" },
      },
      required: ["exerciseId", "n"],
    },
  },
  {
    name: "get_diet_summary",
    description: "Get diet summary (calories, protein, meals) for the last N days",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "get_checkin_history",
    description: "Get daily check-in history (mood, sleep quality, energy level) for the last N days",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "compute_e1rm",
    description: "Compute estimated 1-rep max using Epley formula: weight * (1 + reps/30)",
    input_schema: {
      type: "object" as const,
      properties: {
        weightKg: { type: "number", description: "Weight lifted in kg" },
        reps: { type: "number", description: "Number of repetitions" },
      },
      required: ["weightKg", "reps"],
    },
  },
  {
    name: "detect_plateau",
    description: "Detect if athlete is in a plateau: 3+ sessions with no weight or volume progression",
    input_schema: {
      type: "object" as const,
      properties: {
        exerciseId: { type: "string", description: "Exercise ID to check" },
      },
      required: ["exerciseId"],
    },
  },
];
```

4. Adicionar método privado `executeTool` na classe:
```ts
private async executeTool(
  userId: string,
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case "get_exercise_history": {
      const { exerciseId, n } = input as { exerciseId: string; n: number };
      return ragService.getLastNWorkouts(userId, exerciseId, Math.min(n, 10));
    }
    case "get_diet_summary": {
      const { days } = input as { days: number };
      return ragService.getDietSummaryDays(userId, days);
    }
    case "get_checkin_history": {
      const { days } = input as { days: number };
      return ragService.getCheckinHistory(userId, days);
    }
    case "compute_e1rm": {
      const { weightKg, reps } = input as { weightKg: number; reps: number };
      return { e1rm: +(weightKg * (1 + reps / 30)).toFixed(1) };
    }
    case "detect_plateau": {
      const { exerciseId } = input as { exerciseId: string };
      const logs = await ragService.getLastNWorkouts(userId, exerciseId, 5);
      if (logs.length < 3) return { plateau: false, reason: "insufficient_history" };
      const last3 = logs.slice(0, 3);
      const noWeightProgress = last3.every((l) => l.weightKg <= last3[last3.length - 1].weightKg);
      const noVolumeProgress = last3.every((l) => l.volume <= last3[last3.length - 1].volume);
      return {
        plateau: noWeightProgress && noVolumeProgress,
        sessions_checked: last3.length,
        weights: last3.map((l) => l.weightKg),
        volumes: last3.map((l) => l.volume),
      };
    }
    default:
      return { error: `unknown tool: ${toolName}` };
  }
}
```

5. Substituir `analyzeWorkout` pelo método com tool use (remover `generateProgressionSuggestion`):
```ts
async analyzeWorkout(
  userId: string,
  currentLog: WorkoutLogData
): Promise<string> {
  const userMessage = `Treino registado: ${currentLog.exerciseName}, ${currentLog.weightKg}kg × ${currentLog.reps} reps × ${currentLog.sets} séries${currentLog.rpe != null ? `, RPE ${currentLog.rpe}` : ""}. Volume total: ${currentLog.volume}kg. exerciseId=${currentLog.exerciseId}`;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < 6; i++) {
    const response = await anthropicClient.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: COACH_SYSTEM_PROMPT,
      tools: COACH_TOOLS,
      messages,
    });

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock?.type === "text" ? textBlock.text : "Treino registado!";
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        const result = await this.executeTool(userId, block.name, block.input as Record<string, unknown>);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  return "Treino registado!";
}
```

6. Manter `analyzeDiet` e `generateMotivationalCheckIn` sem alterações.

7. Remover o método privado `generateProgressionSuggestion` (substituído pelo loop de tool use acima).

**Nota:** A interface local `WorkoutLog` e a import de `prisma` já não são necessárias no coach.agent.ts após esta migração — remover ambas para evitar dependência directa ao DB. O coach acede ao DB exclusivamente via `ragService`.

**Verificação:** `npx tsc --noEmit` sem erros.

---

### Passo 3 — Padrão async dois mensagens em `webhook.ts`

**Ficheiro:** `src/routes/webhook.ts`

**O que muda (apenas no `case "workout"`):**

Substituir o bloco actual (linhas ~186-204) onde se chama `coachAgent.analyzeWorkout` por:

1. Construir `quickConfirmation` imediatamente após o loop de exercícios (sem esperar Claude):
```ts
// Montar confirmação rápida com os exercícios registados
const confirmedLines: string[] = [];
for (const exercise of result.exercises) {
  if (unrecognizedExercises.includes(exercise.exerciseName)) continue;
  const prBadge = /* isPR para este exercício */ ""; // ver nota abaixo
  const line = `${prBadge}${exercise.exerciseName}: ${exercise.totalWeight ?? 0}kg × ${exercise.reps} × ${exercise.sets}`;
  confirmedLines.push(line);
}
const quickConfirmation = confirmedLines.length > 0
  ? `✅ Registrado!\n${confirmedLines.join("\n")}`
  : "✅ Registrado!";
responseMessage = quickConfirmation;
```

2. Disparar análise Claude como fire-and-forget **após** acumular `responseMessage`:
```ts
// Fire-and-forget: análise Claude como segunda mensagem
if (algumRegistado) {
  setImmediate(async () => {
    try {
      for (const exercise of result.exercises) {
        if (unrecognizedExercises.includes(exercise.exerciseName)) continue;
        const catalogEntry = catalog.find(/* mesma lógica de lookup */);
        if (!catalogEntry) continue;
        const resolvedExerciseId = catalogEntry.id;
        const analysis = await coachAgent.analyzeWorkout(user.id, {
          exerciseName: exercise.exerciseName,
          exerciseId: resolvedExerciseId,
          weightKg: exercise.totalWeight ?? 0,
          reps: exercise.reps,
          sets: exercise.sets,
          rpe: exercise.rpe ?? undefined,
          volume: (exercise.totalWeight ?? 0) * exercise.reps * exercise.sets,
        });
        await wapiService.sendTextMessage(phone, analysis);
      }
    } catch (err) {
      logger.error({ phone, err }, "coach agent async error");
    }
  });
}
```

**Nota sobre PR badge:** o loop atual chama `progressionService.updatePR` e obtém `isPR` por exercício. Para o padrão async, manter o PR check no loop síncrono (já existe), guardá-lo num `Map<exerciseName, boolean>`, e usá-lo na construção da `quickConfirmation`.

**Resultado final no webhook:**
- Mensagem 1 (síncrona, imediata): `"✅ Registrado!\nSupino: 80kg × 8 × 4"` (com `🏆 *NOVO RECORDE PESSOAL!* 🏆` se PR)
- Mensagem 2 (async, segundos depois): análise Claude com insight accionável

**Verificação:** `npx tsc --noEmit` sem erros.

---

## Verificação Final

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npm run build` passa
- [ ] `npm run test` — 22/22 PASS (testes existentes não afectados)
- [ ] Inspecção manual: coach.agent.ts tem tool use loop + 5 tools + system prompt
- [ ] Inspecção manual: webhook.ts não tem `await coachAgent.analyzeWorkout` no path síncrono

## Fora de Escopo

- Testes unitários para o tool use loop (requer mock de anthropicClient)
- Cache de respostas do coach (Redis)
- `analyzeDiet` com Claude (fica determinístico)
- `generateMotivationalCheckIn` com Claude (fica com frases hard-coded)
- Fallback para coach determinístico se Claude falhar (o `return "Treino registado!"` já serve)

## Package Manager

npm — `package-lock.json` na raiz.
