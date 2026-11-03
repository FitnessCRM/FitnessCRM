import { describe, expect, it } from "vitest";
import {
  assertConsentAccepted,
  assertErasable,
  CONSENT_VERSION,
  confirmsClientName,
} from "./consent";
import { clientSchema } from "./schemas";

describe("I33 · consent is accepted before the account is activated", () => {
  it("accepts only the current version", () => {
    expect(assertConsentAccepted(CONSENT_VERSION)).toBe(CONSENT_VERSION);
    for (const other of [undefined, "", "2020-01-01"]) {
      expect(() => assertConsentAccepted(other)).toThrow(
        expect.objectContaining({ code: "invitation.consent_required" }),
      );
    }
  });

  it("reads clients from before the decision with no consent", () => {
    const client = clientSchema.parse({
      id: "c",
      trainerId: "t",
      firstName: "Marta",
      lastName: "Ruiz",
      email: "marta@example.com",
      phone: "",
      goal: "",
      level: "",
      initialNotes: "",
      status: "activo",
      startDate: "2026-01-05",
      reviewCadence: { everyDays: 7 },
      createdAt: "2026-01-05T10:00:00.000Z",
    });
    expect(client.consentVersion).toBeNull();
    expect(client.consentAcceptedAt).toBeNull();
  });
});

describe("E11 · erasing a client on request", () => {
  it("only erases a discharged client", () => {
    expect(() => assertErasable({ status: "dado_de_baja" })).not.toThrow();
    for (const status of ["invitado", "activo"] as const) {
      expect(() => assertErasable({ status })).toThrow(
        expect.objectContaining({ code: "client.not_discharged" }),
      );
    }
  });

  it("is confirmed by typing the client's full name", () => {
    const client = { firstName: "Marta", lastName: "Ruiz Gómez" };
    expect(confirmsClientName(client, "Marta Ruiz Gómez")).toBe(true);
    expect(confirmsClientName(client, "  marta   ruiz gómez ")).toBe(true);
    expect(confirmsClientName(client, "Marta")).toBe(false);
    expect(confirmsClientName({ firstName: "", lastName: "" }, "")).toBe(false);
  });
});
