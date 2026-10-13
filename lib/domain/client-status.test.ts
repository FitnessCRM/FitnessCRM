import { describe, expect, it } from "vitest";
import { canChangeClientStatus } from "./client-status";

describe("client status transitions (H6, §7)", () => {
  it("allows the three transitions in the domain", () => {
    expect(canChangeClientStatus("invitado", "activo")).toBe(true);
    expect(canChangeClientStatus("activo", "dado_de_baja")).toBe(true);
    expect(canChangeClientStatus("dado_de_baja", "activo")).toBe(true);
  });

  it("rejects any other change, including discharging an unaccepted invitation", () => {
    expect(canChangeClientStatus("dado_de_baja", "invitado")).toBe(false);
    expect(canChangeClientStatus("activo", "invitado")).toBe(false);
    expect(canChangeClientStatus("invitado", "dado_de_baja")).toBe(false);
  });

  it("treats the same status as no change", () => {
    expect(canChangeClientStatus("activo", "activo")).toBe(true);
  });
});
