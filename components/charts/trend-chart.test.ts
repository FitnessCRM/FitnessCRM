import { describe, expect, it } from "vitest";
import { isIsolated, type TrendPoint } from "./trend-points";

describe("isIsolated (tarjeta 70: un valor sin vecinas no desaparece)", () => {
  const data: TrendPoint[] = [
    { label: "S1", kg: null },
    { label: "S2", kg: 70 },
    { label: "S3", kg: null },
    { label: "S4", kg: 71 },
    { label: "S5", kg: 71.5 },
  ];

  it("is true for a value with a gap on both sides", () => {
    expect(isIsolated(data, "kg", 1)).toBe(true);
  });

  it("is false when a neighbouring week has a value", () => {
    expect(isIsolated(data, "kg", 3)).toBe(false);
  });

  it("is false for a gap, which is never drawn", () => {
    expect(isIsolated(data, "kg", 0)).toBe(false);
  });

  it("is true for the only value of a series", () => {
    const single: TrendPoint[] = [{ label: "1 ago", kg: 63.4 }];
    expect(isIsolated(single, "kg", 0)).toBe(true);
  });

  it("is false for an index outside the data", () => {
    expect(isIsolated(data, "kg", 9)).toBe(false);
  });
});
