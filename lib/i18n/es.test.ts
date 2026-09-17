import { describe, expect, it } from "vitest";
import { APP_NAME } from "./es";

describe("APP_NAME", () => {
  it("is a non-empty brand name", () => {
    expect(APP_NAME.trim().length).toBeGreaterThan(0);
  });
});
