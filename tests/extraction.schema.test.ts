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
