import { z } from "zod";

// ---------------------------------------------------------------------------
// Schemas individuais
// ---------------------------------------------------------------------------

export const WorkoutExerciseSchema = z.object({
  exerciseName: z.string(),
  weightPerSide: z.number().optional(),
  totalWeight: z.number().optional(),
  reps: z.number(),
  sets: z.number(),
  rpe: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export const WorkoutExtractionSchema = z.object({
  type: z.literal("workout"),
  exercises: z.array(WorkoutExerciseSchema),
});

export const DietExtractionSchema = z.object({
  type: z.literal("diet"),
  meal: z.string(),
  calories: z.number().optional(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  description: z.string().optional(),
});

export const CheckInExtractionSchema = z.object({
  type: z.literal("checkin"),
  mood: z.number().min(1).max(10).optional(),
  sleepQuality: z.number().min(1).max(10).optional(),
  energyLevel: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),
});

export const UnknownExtractionSchema = z.object({
  type: z.literal("unknown"),
  message: z.string(),
});

// ---------------------------------------------------------------------------
// Union discriminada
// ---------------------------------------------------------------------------

export const ExtractionSchema = z.discriminatedUnion("type", [
  WorkoutExtractionSchema,
  DietExtractionSchema,
  CheckInExtractionSchema,
  UnknownExtractionSchema,
]);

// ---------------------------------------------------------------------------
// Tipos TypeScript inferidos
// ---------------------------------------------------------------------------

export type WorkoutExtraction = z.infer<typeof WorkoutExtractionSchema>;
export type DietExtraction = z.infer<typeof DietExtractionSchema>;
export type CheckInExtraction = z.infer<typeof CheckInExtractionSchema>;
export type UnknownExtraction = z.infer<typeof UnknownExtractionSchema>;
export type ExtractionResult = z.infer<typeof ExtractionSchema>;

// ---------------------------------------------------------------------------
// Função helper de parsing
// ---------------------------------------------------------------------------

export function parseExtraction(data: unknown): ExtractionResult {
  return ExtractionSchema.parse(data);
}
