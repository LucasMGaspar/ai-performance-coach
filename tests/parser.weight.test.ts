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
