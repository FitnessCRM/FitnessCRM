import { describe, expect, it } from "vitest";
import { responseFormatSchema } from "./questionnaire";

describe("scale limits (H5)", () => {
  it("rejects a negative minimum", () => {
    expect(responseFormatSchema.safeParse({ kind: "escala", min: -1, max: 5 }).success).toBe(false);
  });

  it("accepts a minimum of zero", () => {
    expect(responseFormatSchema.safeParse({ kind: "escala", min: 0, max: 10 }).success).toBe(true);
  });

  it("has no fixed cap on the maximum", () => {
    expect(responseFormatSchema.safeParse({ kind: "escala", min: 1, max: 1000 }).success).toBe(
      true,
    );
  });
});
