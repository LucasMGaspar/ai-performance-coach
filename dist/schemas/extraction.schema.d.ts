import { z } from "zod";
export declare const WorkoutExerciseSchema: z.ZodObject<{
    exerciseName: z.ZodString;
    weightPerSide: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    totalWeight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    reps: z.ZodNumber;
    sets: z.ZodNumber;
    rpe: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const WorkoutExtractionSchema: z.ZodObject<{
    type: z.ZodLiteral<"workout">;
    exercises: z.ZodArray<z.ZodObject<{
        exerciseName: z.ZodString;
        weightPerSide: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        totalWeight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        reps: z.ZodNumber;
        sets: z.ZodNumber;
        rpe: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DietExtractionSchema: z.ZodObject<{
    type: z.ZodLiteral<"diet">;
    meal: z.ZodString;
    calories: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    protein: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    carbs: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    fat: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const CheckInExtractionSchema: z.ZodObject<{
    type: z.ZodLiteral<"checkin">;
    mood: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    sleepQuality: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    energyLevel: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const UnknownExtractionSchema: z.ZodObject<{
    type: z.ZodLiteral<"unknown">;
    message: z.ZodString;
}, z.core.$strip>;
export declare const QuestionExtractionSchema: z.ZodObject<{
    type: z.ZodLiteral<"question">;
    question: z.ZodString;
}, z.core.$strip>;
export declare const ExtractionSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"workout">;
    exercises: z.ZodArray<z.ZodObject<{
        exerciseName: z.ZodString;
        weightPerSide: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        totalWeight: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        reps: z.ZodNumber;
        sets: z.ZodNumber;
        rpe: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"diet">;
    meal: z.ZodString;
    calories: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    protein: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    carbs: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    fat: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"checkin">;
    mood: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    sleepQuality: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    energyLevel: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"question">;
    question: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"unknown">;
    message: z.ZodString;
}, z.core.$strip>], "type">;
export type WorkoutExtraction = z.infer<typeof WorkoutExtractionSchema>;
export type DietExtraction = z.infer<typeof DietExtractionSchema>;
export type CheckInExtraction = z.infer<typeof CheckInExtractionSchema>;
export type QuestionExtraction = z.infer<typeof QuestionExtractionSchema>;
export type UnknownExtraction = z.infer<typeof UnknownExtractionSchema>;
export type ExtractionResult = z.infer<typeof ExtractionSchema>;
export declare function parseExtraction(data: unknown): ExtractionResult;
//# sourceMappingURL=extraction.schema.d.ts.map