import { describe, expect, it } from "vitest";
import { civilDateOf, parseWholeNumberInput } from "./format";

describe("civilDateOf (E10)", () => {
  it("takes the day in the trainer's time zone, not in UTC", () => {
    // 00:30 en Madrid del 30-09 son las 22:30Z del 29-09: `slice(0, 10)` diría 29.
    expect(civilDateOf("2026-09-29T22:30:00Z", "Europe/Madrid")).toBe("2026-09-30");
    expect(civilDateOf("2026-09-29T22:30:00Z", "UTC")).toBe("2026-09-29");
  });
});

describe("parseWholeNumberInput", () => {
  it("reads a number written only with digits", () => {
    expect(parseWholeNumberInput("2400")).toBe(2400);
    expect(parseWholeNumberInput(" 2400 ")).toBe(2400);
  });

  it("gives NaN with a dot, a comma, a sign or nothing: «2.000» is never 2", () => {
    for (const raw of ["2.400", "2,4", "2.000", "", "-2400", "+2400", "2400.5", "2 400"]) {
      expect(parseWholeNumberInput(raw)).toBeNaN();
    }
  });
});
