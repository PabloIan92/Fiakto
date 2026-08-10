import { describe, expect, it } from "vitest";

import { calculateAge, isAdult } from "@/src/domain/profile";

describe("calculateAge", () => {
  it("counts a full year once the birthday already happened this year", () => {
    expect(calculateAge("2000-01-01", new Date("2026-06-15T00:00:00Z"))).toBe(26);
  });

  it("does not count the year yet if the birthday hasn't happened this year", () => {
    expect(calculateAge("2000-12-31", new Date("2026-06-15T00:00:00Z"))).toBe(25);
  });

  it("counts the birthday itself as already turning that age", () => {
    expect(calculateAge("2008-08-10", new Date("2026-08-10T00:00:00Z"))).toBe(18);
  });
});

describe("isAdult", () => {
  it("is true for someone who is exactly 18", () => {
    expect(isAdult("2008-08-10", new Date("2026-08-10T00:00:00Z"))).toBe(true);
  });

  it("is false the day before turning 18", () => {
    expect(isAdult("2008-08-10", new Date("2026-08-09T00:00:00Z"))).toBe(false);
  });

  it("is false for a young child", () => {
    expect(isAdult("2020-01-01", new Date("2026-06-15T00:00:00Z"))).toBe(false);
  });
});
