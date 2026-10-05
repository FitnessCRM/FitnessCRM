import { doc, setDoc, type Firestore } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ClientTrackingFilter, MembershipQuery } from "@/lib/data/ports";
import { createDemoState, createMockPorts, type MockState } from "../mock";
import { CLIENT_IDS, TRAINER_ID } from "../mock/demo-data/common";
import { createClientPort } from "./clients";
import { createFirestore } from "./config";
import { createFirebaseContext, type FirebaseContext } from "./context";
import { COLLECTIONS } from "./helpers";
import { createMembershipPort } from "./memberships";

/**
 * Contra el emulador de Firestore (`pnpm test:firebase`). La mitad de los tests son de paridad: la
 * misma consulta contra el adaptador en memoria y contra este, sembrados con los mismos datos de
 * demo, tienen que dar el mismo resultado. El mock es la referencia de lo que los puertos prometen.
 */
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const TODAY = "2026-10-03";
const NOW = "2026-10-03T10:00:00.000Z";
const STRANGER = "t-otra";

describe.skipIf(!emulatorHost)("adaptador de Firebase · clientes y membresías", () => {
  let db: Firestore;
  let ctx: FirebaseContext;
  let state: MockState;

  beforeAll(() => {
    const [host = "127.0.0.1", port = "8080"] = (emulatorHost as string).split(":");
    db = createFirestore(
      { projectId: "demo-hector" },
      { appName: "firebase-clients-test", emulator: { host, port: Number(port) } },
    );
  });

  beforeEach(async () => {
    // Vaciar el emulador: otros archivos y otros tests han dejado clientes del mismo entrenador.
    await fetch(
      `http://${emulatorHost}/emulator/v1/projects/demo-hector/databases/(default)/documents`,
      { method: "DELETE" },
    );
    ctx = createFirebaseContext(db, { now: () => NOW });
    state = createDemoState(TODAY);
    // Un cliente que aún no ha entrado, para que el filtro «invitado» no salga vacío.
    const invited = state.clients.find((c) => c.id === CLIENT_IDS.sara);
    if (invited) invited.status = "invitado";
    const seed = (name: string, items: { id: string }[]) =>
      Promise.all(items.map((item) => setDoc(doc(db, name, item.id), item)));
    await seed(COLLECTIONS.trainers, state.trainers);
    await seed(COLLECTIONS.clients, state.clients);
    await seed(COLLECTIONS.memberships, state.memberships);
    await seed(COLLECTIONS.routines, state.routines);
    await seed(COLLECTIONS.reviews, state.reviews);
  });

  const mock = () => createMockPorts({ state: structuredClone(state), today: TODAY });

  describe("clientes", () => {
    it("lists the same clients as the reference", async () => {
      const byId = <T extends { id: string }>(items: T[]) =>
        [...items].sort((a, b) => a.id.localeCompare(b.id));
      const clients = createClientPort(ctx);
      expect(byId(await clients.listClients(TRAINER_ID))).toEqual(
        byId(await mock().clients.listClients(TRAINER_ID)),
      );
      expect(await clients.listClients(STRANGER)).toEqual([]);
    });

    it("tracking pages match the reference, for every filter and page", async () => {
      const clients = createClientPort(ctx);
      const reference = mock().clients;
      const filters: ClientTrackingFilter[] = ["todos", "invitado", "activo", "dado_de_baja"];
      for (const filter of filters) {
        for (const page of [0, 1, 2]) {
          const query = { filter, today: TODAY, page, pageSize: 2 };
          expect(
            await clients.listClientsTracking(TRAINER_ID, query),
            `${filter} p${page}`,
          ).toEqual(await reference.listClientsTracking(TRAINER_ID, query));
        }
      }
      // Que la paridad no sea trivial: la demo tiene datos de verdad en cada corte.
      const everyone = await clients.listClientsTracking(TRAINER_ID, {
        filter: "todos",
        today: TODAY,
        page: 0,
        pageSize: 8,
      });
      expect(everyone.rows.length).toBeGreaterThan(3);
      expect(everyone.counts.invitado).toBe(1);
      expect(everyone.rows.some((r) => r.newReviewWeek !== null)).toBe(true);
      expect(everyone.rows.some((r) => r.lastReviewAt !== null)).toBe(true);
      expect(everyone.rows.some((r) => r.routineName !== null)).toBe(true);
      expect(everyone.rows.some((r) => r.membership !== null)).toBe(true);
      const one = {
        filter: "todos" as const,
        clientId: CLIENT_IDS.marta,
        today: TODAY,
        page: 0,
        pageSize: 8,
      };
      expect(await clients.listClientsTracking(TRAINER_ID, one)).toEqual(
        await reference.listClientsTracking(TRAINER_ID, one),
      );
    });

    it("a stranger sees an empty portfolio", async () => {
      const page = await createClientPort(ctx).listClientsTracking(STRANGER, {
        filter: "todos",
        today: TODAY,
        page: 0,
        pageSize: 8,
      });
      expect(page.rows).toEqual([]);
      expect(page.counts.todos).toBe(0);
    });

    it("getClient answers only for its own trainer", async () => {
      const clients = createClientPort(ctx);
      expect((await clients.getClient(TRAINER_ID, CLIENT_IDS.marta))?.id).toBe(CLIENT_IDS.marta);
      expect(await clients.getClient(STRANGER, CLIENT_IDS.marta)).toBeNull();
      expect(await clients.getClient(TRAINER_ID, "no-existe")).toBeNull();
    });

    it("a new client is always invited, whatever the input says", async () => {
      const clients = createClientPort(ctx);
      const base = state.clients.find((c) => c.id === CLIENT_IDS.marta)!;
      const input = Object.fromEntries(
        Object.entries(base).filter(([key]) => !["id", "createdAt", "status"].includes(key)),
      ) as Omit<typeof base, "id" | "createdAt" | "status">;
      const created = await clients.createClient({ ...input, email: "nueva@email.com" });
      expect(created.status).toBe("invitado");
      expect(created.id).not.toBe(CLIENT_IDS.marta);
      expect(created.createdAt).toBe(NOW);
      expect((await clients.getClient(TRAINER_ID, created.id))?.email).toBe("nueva@email.com");
    });

    it("an update keeps the identity and a foreign client cannot be updated", async () => {
      const clients = createClientPort(ctx);
      const updated = await clients.updateClient(TRAINER_ID, CLIENT_IDS.marta, {
        goal: "Fuerza",
        // La identidad no se cambia ni aunque se mande.
        ...({ trainerId: STRANGER, id: "otro" } as object),
      });
      expect(updated).toMatchObject({
        id: CLIENT_IDS.marta,
        trainerId: TRAINER_ID,
        goal: "Fuerza",
      });
      await expect(
        clients.updateClient(STRANGER, CLIENT_IDS.marta, { goal: "x" }),
      ).rejects.toMatchObject({ code: "not_found" });
    });
  });

  describe("membresías", () => {
    it("the table pages match the reference, for every filter, page and client", async () => {
      const memberships = createMembershipPort(ctx);
      const reference = mock().memberships;
      for (const filter of ["all", "unpaid", "expiring"] as const) {
        for (const page of [0, 1]) {
          const query: MembershipQuery = { filter, today: TODAY, page, pageSize: 3 };
          expect(
            await memberships.listMembershipsWithClients(TRAINER_ID, query),
            `${filter} p${page}`,
          ).toEqual(await reference.listMembershipsWithClients(TRAINER_ID, query));
        }
      }
      const whole = await memberships.listMembershipsWithClients(TRAINER_ID, {
        filter: "all",
        today: TODAY,
        page: 0,
        pageSize: 50,
      });
      expect(whole.rows.length).toBeGreaterThan(3);
      expect(whole.counts.unpaid).toBeGreaterThan(0);
      const one: MembershipQuery = {
        filter: "all",
        clientId: CLIENT_IDS.marta,
        today: TODAY,
        page: 0,
        pageSize: 8,
      };
      expect(await memberships.listMembershipsWithClients(TRAINER_ID, one)).toEqual(
        await reference.listMembershipsWithClients(TRAINER_ID, one),
      );
    });

    it("lists a whole portfolio or one client's history, latest first", async () => {
      const memberships = createMembershipPort(ctx);
      const reference = mock().memberships;
      const key = (m: { startDate: string; id: string }) => `${m.startDate}|${m.id}`;
      const sorted = <T extends { startDate: string; id: string }>(items: T[]) =>
        [...items].sort((a, b) => key(a).localeCompare(key(b)));
      expect(sorted(await memberships.listMemberships(TRAINER_ID))).toEqual(
        sorted(await reference.listMemberships(TRAINER_ID)),
      );
      const history = await memberships.listClientMemberships(TRAINER_ID, CLIENT_IDS.marta);
      expect(history.map((m) => m.startDate)).toEqual(
        [...history.map((m) => m.startDate)].sort().reverse(),
      );
      expect(await memberships.listClientMemberships(STRANGER, CLIENT_IDS.marta)).toEqual([]);
    });

    it("creates for an own client only and keeps the identity on update", async () => {
      const memberships = createMembershipPort(ctx);
      const base = {
        trainerId: TRAINER_ID,
        clientId: CLIENT_IDS.marta,
        type: "mensual" as const,
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        paymentStatus: "no_pagada" as const,
      };
      const created = await memberships.createMembership(base);
      expect(created.createdAt).toBe(NOW);
      await expect(
        memberships.createMembership({ ...base, trainerId: STRANGER }),
      ).rejects.toMatchObject({ code: "not_found" });

      const updated = await memberships.updateMembership(TRAINER_ID, created.id, {
        paymentStatus: "pagada",
        ...({ clientId: CLIENT_IDS.jorge, trainerId: STRANGER, id: "otra" } as object),
      });
      expect(updated).toMatchObject({
        id: created.id,
        trainerId: TRAINER_ID,
        clientId: CLIENT_IDS.marta,
        paymentStatus: "pagada",
      });
      await expect(
        memberships.updateMembership(STRANGER, created.id, { paymentStatus: "no_pagada" }),
      ).rejects.toMatchObject({ code: "not_found" });
    });
  });
});
