import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas individuais
// ---------------------------------------------------------------------------

export const WorkoutExerciseSchema = z.object({
  exerciseName: z.string(),
  weightPerSide: z.number().nullish(),
  totalWeight: z.number().nullish(),
  reps: z.number(),
  sets: z.number(),
  rpe: z.number().min(1).max(10).nullish(),
  notes: z.string().nullish(),
});

export const WorkoutExtractionSchema = z.object({
  type: z.literal("workout"),
  exercises: z.array(WorkoutExerciseSchema),
});

export const ExtraDietItemSchema = z.object({
  name: z.string(),
  quantity: z.string().nullish(),
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
  extraItems: z.array(ExtraDietItemSchema).nullish(),
});

export const CheckInExtractionSchema = z.object({
  type: z.literal("checkin"),
  mood: z.number().min(1).max(10).nullish(),
  sleepQuality: z.number().min(1).max(10).nullish(),
  energyLevel: z.number().min(1).max(10).nullish(),
  notes: z.string().nullish(),
});

export const UnknownExtractionSchema = z.object({
  type: z.literal("unknown"),
  message: z.string(),
});

export const QuestionExtractionSchema = z.object({
  type: z.literal("question"),
  question: z.string(),
});

// ---------------------------------------------------------------------------
// Union discriminada
// ---------------------------------------------------------------------------

export const ExtractionSchema = z.discriminatedUnion("type", [
  WorkoutExtractionSchema,
  DietExtractionSchema,
  CheckInExtractionSchema,
  QuestionExtractionSchema,
  UnknownExtractionSchema,
]);

// ---------------------------------------------------------------------------
// Tipos TypeScript inferidos
// ---------------------------------------------------------------------------

export type WorkoutExtraction = z.infer<typeof WorkoutExtractionSchema>;
export type ExtraDietItem = z.infer<typeof ExtraDietItemSchema>;
export type DietExtraction = z.infer<typeof DietExtractionSchema>;
export type CheckInExtraction = z.infer<typeof CheckInExtractionSchema>;
export type QuestionExtraction = z.infer<typeof QuestionExtractionSchema>;
export type UnknownExtraction = z.infer<typeof UnknownExtractionSchema>;
export type ExtractionResult = z.infer<typeof ExtractionSchema>;

// ---------------------------------------------------------------------------
// Função helper de parsing
// ---------------------------------------------------------------------------

export function parseExtraction(data: unknown): ExtractionResult {
  return ExtractionSchema.parse(data);
}
