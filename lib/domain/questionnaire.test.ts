import { describe, expect, it } from "vitest";
import { question } from "./__tests__/fixtures";
import { canChangeQuestionFormat, canUpdateQuestion, formatsAreEqual } from "./questionnaire";

describe("I15 · question format immutability", () => {
  it("allows changing the format while there are no responses", () => {
    expect(canChangeQuestionFormat(question(), false)).toBe(true);
  });

  it("forbids changing the format once a response exists", () => {
    expect(canChangeQuestionFormat(question(), true)).toBe(false);
  });

  it("the prompt is always editable, even with responses", () => {
    const q = question();
    expect(
      canUpdateQuestion(q, { prompt: "Energía (1 = nula, 5 = máxima)", format: q.format }, true),
    ).toBe(true);
  });

  it("scale limits are part of the format: widening 1-5 to 1-10 is a format change", () => {
    const q = question();
    const wider = { prompt: q.prompt, format: { kind: "escala", min: 1, max: 10 } as const };
    expect(canUpdateQuestion(q, wider, false)).toBe(true);
    expect(canUpdateQuestion(q, wider, true)).toBe(false);
  });

  it("switching escala ↔ texto is a format change", () => {
    const q = question();
    expect(canUpdateQuestion(q, { prompt: q.prompt, format: { kind: "texto" } }, true)).toBe(false);
  });
});

describe("formatsAreEqual", () => {
  it("compares kind and, for scales, the limits", () => {
    expect(formatsAreEqual({ kind: "texto" }, { kind: "texto" })).toBe(true);
    expect(
      formatsAreEqual({ kind: "escala", min: 1, max: 5 }, { kind: "escala", min: 1, max: 5 }),
    ).toBe(true);
    expect(
      formatsAreEqual({ kind: "escala", min: 1, max: 5 }, { kind: "escala", min: 0, max: 5 }),
    ).toBe(false);
    expect(formatsAreEqual({ kind: "escala", min: 1, max: 5 }, { kind: "texto" })).toBe(false);
  });
});
