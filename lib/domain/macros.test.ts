import { describe, expect, it } from "vitest";
import { derivedKcal } from "./macros";

describe("derivedKcal", () => {
  it("applies 4/4/9 to the demo training day", () => {
    expect(derivedKcal({ proteinG: 165, carbsG: 260, fatG: 72 })).toBe(2348);
  });

  it("is zero for empty macros and rounds fractional grams", () => {
    expect(derivedKcal({ proteinG: 0, carbsG: 0, fatG: 0 })).toBe(0);
    expect(derivedKcal({ proteinG: 0.5, carbsG: 0, fatG: 0.1 })).toBe(3);
  });
});
