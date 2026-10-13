import { describe, expect, it } from "vitest";
import { DomainError } from "@/lib/domain";
import { createMockPorts } from "./index";

const TRAINER = "t-adrian";
const MARTA = "c-marta";
const TODAY = "2026-08-29";

describe("client status changes in the in-memory adapter (H6)", () => {
  it("rejects a transition outside the three valid ones", async () => {
    const p = createMockPorts({ today: TODAY });
    await expect(p.clients.updateClient(TRAINER, MARTA, { status: "invitado" })).rejects.toThrow(
      DomainError,
    );
  });

  it("accepts discharge and reactivation", async () => {
    const p = createMockPorts({ today: TODAY });
    const discharged = await p.clients.updateClient(TRAINER, MARTA, { status: "dado_de_baja" });
    expect(discharged.status).toBe("dado_de_baja");
    const back = await p.clients.updateClient(TRAINER, MARTA, { status: "activo" });
    expect(back.status).toBe("activo");
  });
});
