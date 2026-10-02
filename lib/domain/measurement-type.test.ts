import { describe, expect, it } from "vitest";
import { canUpdateMeasurementType } from "./measurement-type";

describe("I26 · a measurement type's unit is locked from its first measurement", () => {
  const type = { unit: "cm" };

  it("lets the label change always", () => {
    expect(canUpdateMeasurementType(type, { label: "Otra", unit: "cm" }, true)).toBe(true);
  });

  it("lets the unit change only while nothing has been measured", () => {
    expect(canUpdateMeasurementType(type, { label: "Cuello", unit: "mm" }, false)).toBe(true);
    expect(canUpdateMeasurementType(type, { label: "Cuello", unit: "mm" }, true)).toBe(false);
  });
});
