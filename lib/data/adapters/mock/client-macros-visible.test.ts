import { describe, expect, it } from "vitest";
import { createDemoState } from "./store";
import { createMockPorts } from "./index";

const TRAINER = "t-adrian";
const MARTA = "c-marta";
const JORGE = "c-jorge";
const TODAY = "2026-08-29";

/** La sesión de demo navega el área de cliente como Marta (I11, tarjeta 113). */
function setup() {
  const state = createDemoState(TODAY);
  return { state, p: createMockPorts({ state, today: TODAY }) };
}

describe("the session's client shows or hides their kcal and macros (I11)", () => {
  it("flips the flag both ways and leaves the rest of the record alone", async () => {
    const { p } = setup();
    const before = await p.clients.getClient(TRAINER, MARTA);
    const hidden = await p.clients.setMacrosVisible(MARTA, false);
    expect(hidden).toEqual({ ...before, macrosVisible: false });
    expect((await p.clients.getClient(TRAINER, MARTA))?.macrosVisible).toBe(false);
    expect((await p.clients.setMacrosVisible(MARTA, true)).macrosVisible).toBe(true);
  });

  it("sets it on a record that never had the field", async () => {
    const { state, p } = setup();
    const marta = state.clients.find((c) => c.id === MARTA)!;
    delete (marta as { macrosVisible?: boolean }).macrosVisible;
    expect((await p.clients.setMacrosVisible(MARTA, false)).macrosVisible).toBe(false);
  });

  it("a client who is not the session's is not found, and nothing changes", async () => {
    const { p } = setup();
    await expect(p.clients.setMacrosVisible(JORGE, false)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(p.clients.setMacrosVisible("no-existe", false)).rejects.toMatchObject({
      code: "not_found",
    });
    expect((await p.clients.getClient(TRAINER, JORGE))?.macrosVisible).toBe(true);
  });

  it("an invited or unsubscribed record cannot change it", async () => {
    for (const status of ["invitado", "dado_de_baja"] as const) {
      const { state, p } = setup();
      state.clients.find((c) => c.id === MARTA)!.status = status;
      await expect(p.clients.setMacrosVisible(MARTA, false)).rejects.toMatchObject({
        code: "not_found",
      });
      expect(state.clients.find((c) => c.id === MARTA)!.macrosVisible).toBe(true);
    }
  });

  it("the last write wins, whoever makes it", async () => {
    const { p } = setup();
    await p.clients.updateClient(TRAINER, MARTA, { macrosVisible: false });
    expect((await p.clients.setMacrosVisible(MARTA, true)).macrosVisible).toBe(true);
    await p.clients.updateClient(TRAINER, MARTA, { macrosVisible: false });
    expect((await p.clients.getClient(TRAINER, MARTA))?.macrosVisible).toBe(false);
  });
});
