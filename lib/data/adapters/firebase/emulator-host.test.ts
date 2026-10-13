import { describe, expect, it } from "vitest";
import { parseEmulatorHost } from "./ports";

describe("parseEmulatorHost (tarjeta 95)", () => {
  it("uses the port that comes with the host", () => {
    expect(parseEmulatorHost("127.0.0.1:8181", 8080)).toEqual({ host: "127.0.0.1", port: 8181 });
  });

  it("falls back to the emulator's default port when the host has none", () => {
    expect(parseEmulatorHost("127.0.0.1", 8080)).toEqual({ host: "127.0.0.1", port: 8080 });
  });
});
