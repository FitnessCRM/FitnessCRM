import { describe, expect, it } from "vitest";
import { canonicalText, foldText } from "./text";

describe("foldText", () => {
  it("ignores case, accents and repeated spaces", () => {
    expect(foldText("  Pierna ")).toBe("pierna");
    expect(foldText("TRACCIÓN")).toBe("traccion");
    expect(foldText("peso  corporal")).toBe("peso corporal");
  });

  it("keeps different words apart", () => {
    expect(foldText("Piernas")).not.toBe(foldText("Pierna"));
  });
});

describe("canonicalText", () => {
  const known = ["Pierna", "Empuje", "Tracción"];

  it("adopts the spelling already in use", () => {
    expect(canonicalText("pierna", known)).toBe("Pierna");
    expect(canonicalText("  TRACCION ", known)).toBe("Tracción");
  });

  it("keeps a genuinely new value, just tidied up", () => {
    expect(canonicalText("  Core  fuerte ", known)).toBe("Core fuerte");
    expect(canonicalText("Piernas", known)).toBe("Piernas");
  });

  it("leaves an empty value empty", () => {
    expect(canonicalText("   ", known)).toBe("");
  });

  it("takes the first match when the catalogue already disagrees with itself", () => {
    expect(canonicalText("pierna", ["Pierna", "PIERNA"])).toBe("Pierna");
  });
});
