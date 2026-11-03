import { describe, expect, it } from "vitest";
import {
  assertClientEmailChange,
  changesClientEmail,
  isClientEmailTaken,
  normalizeEmail,
} from "./client-email";

describe("I31 · the client email is unique and only changes while invited", () => {
  const clients = [
    { id: "c1", email: "Marta@Example.com " },
    { id: "c2", email: "luis@example.com" },
  ];

  it("compares emails trimmed and case-insensitively", () => {
    expect(normalizeEmail("  Marta@Example.COM ")).toBe("marta@example.com");
    expect(isClientEmailTaken("marta@example.com", clients)).toBe(true);
    expect(isClientEmailTaken("nueva@example.com", clients)).toBe(false);
  });

  it("a client does not collide with itself when edited", () => {
    expect(isClientEmailTaken("marta@example.com", clients, "c1")).toBe(false);
    expect(isClientEmailTaken("luis@example.com", clients, "c1")).toBe(true);
  });

  it("lets the email change only while the client is invited", () => {
    const invited = { email: "a@example.com", status: "invitado" as const };
    expect(() => assertClientEmailChange(invited, "b@example.com")).not.toThrow();
    for (const status of ["activo", "dado_de_baja"] as const) {
      expect(() => assertClientEmailChange({ ...invited, status }, "b@example.com")).toThrow(
        expect.objectContaining({ code: "client.email_locked" }),
      );
      // Same email with other case or spaces is not a change.
      expect(() => assertClientEmailChange({ ...invited, status }, " A@example.com")).not.toThrow();
      expect(() => assertClientEmailChange({ ...invited, status }, undefined)).not.toThrow();
    }
    expect(changesClientEmail(invited, "A@EXAMPLE.com")).toBe(false);
  });
});
