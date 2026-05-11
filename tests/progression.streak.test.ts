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
