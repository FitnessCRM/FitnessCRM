import { describe, expect, it } from "vitest";
import { parseWholeNumberInput } from "./format";

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
