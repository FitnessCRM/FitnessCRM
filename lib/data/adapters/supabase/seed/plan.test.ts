import { describe, expect, it } from "vitest";
import { buildSupabaseSeedPlan, rowKey, type SupabaseSeedInput } from "./plan";
import { seedClientUserId, seedTrainerUserId } from "./ids";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const input = (over: Partial<SupabaseSeedInput> = {}): SupabaseSeedInput => ({
  trainerEmail: "Entrenador@Prueba.test",
  trainerName: "Entrenador de prueba",
  timeZone: "Europe/Madrid",
  clientEmails: ["uno@prueba.test", "dos@prueba.test"],
  anchor: "2026-11-06",
  now: "2026-11-06T20:00:00.000Z",
  ...over,
});

const countOf = (plan: ReturnType<typeof buildSupabaseSeedPlan>, table: string) =>
  plan.tables.find((t) => t.table === table)!.rows.length;

describe("siembra de Supabase · plan", () => {
  const plan = buildSupabaseSeedPlan(input());

  it("has the same amounts as the Firebase seed, plus the trainer, its clients and their profiles", () => {
    expect(countOf(plan, "trainers")).toBe(1);
    expect(countOf(plan, "clients")).toBe(2);
    expect(countOf(plan, "profiles")).toBe(3);
    expect(countOf(plan, "exercises")).toBe(12);
    expect(countOf(plan, "foods")).toBe(15);
    expect(countOf(plan, "measurement_types")).toBe(8);
    expect(countOf(plan, "questionnaire_questions")).toBe(5);
    expect(countOf(plan, "routine_templates")).toBe(2);
    expect(countOf(plan, "menu_templates")).toBe(1);
    expect(countOf(plan, "memberships")).toBe(3);
    expect(new Set(plan.seed.reviews.map((r) => r.status))).toEqual(
      new Set(["borrador", "enviada", "vista", "revisada"]),
    );
    expect(plan.seed.reviews.every((r) => r.media.length === 0)).toBe(true);
  });

  it("the trainer's uuid is its account, its row and its profile; every id is a v5 uuid", () => {
    const trainerId = seedTrainerUserId("entrenador@prueba.test");
    expect(plan.trainerUserId).toBe(trainerId);
    expect(plan.tables.find((t) => t.table === "trainers")!.rows[0]).toMatchObject({
      id: trainerId,
      email: "entrenador@prueba.test",
      name: "Entrenador de prueba",
      time_zone: "Europe/Madrid",
    });
    for (const set of plan.tables) {
      for (const row of set.rows) {
        for (const column of set.onConflict.split(",")) expect(row[column]).toMatch(UUID);
        if (set.ownerColumn === "trainer_id") expect(row.trainer_id).toBe(trainerId);
      }
      const keys = set.rows.map((row) => rowKey(set, row));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("each given email is an active client with an account and a client profile", () => {
    expect(plan.accounts).toEqual([
      { role: "trainer", userId: plan.trainerUserId, email: "entrenador@prueba.test" },
      {
        role: "client",
        userId: seedClientUserId("uno@prueba.test"),
        email: "uno@prueba.test",
        clientKey: "lucas",
      },
      {
        role: "client",
        userId: seedClientUserId("dos@prueba.test"),
        email: "dos@prueba.test",
        clientKey: "irene",
      },
    ]);
    const clients = plan.tables.find((t) => t.table === "clients")!.rows;
    expect(clients.map((c) => [c.email, c.status])).toEqual([
      ["uno@prueba.test", "activo"],
      ["dos@prueba.test", "activo"],
    ]);
    const profiles = plan.tables.find((t) => t.table === "profiles")!.rows;
    expect(
      profiles
        .filter((p) => p.role === "client")
        .map((p) => p.client_id)
        .sort(),
    ).toEqual(clients.map((c) => c.id).sort());
  });

  it("needs exactly one email per seeded client: an active client always has an account (§7)", () => {
    for (const clientEmails of [
      [],
      ["uno@prueba.test"],
      ["uno@prueba.test", "dos@prueba.test", "tres@prueba.test"],
    ]) {
      expect(() => buildSupabaseSeedPlan(input({ clientEmails }))).toThrow(/un correo por cliente/);
    }
  });

  it("cloned routines and menus keep the uuid of the template they come from", () => {
    const templates = new Set([
      ...plan.tables.find((t) => t.table === "routine_templates")!.rows.map((r) => r.id),
      ...plan.tables.find((t) => t.table === "menu_templates")!.rows.map((r) => r.id),
    ]);
    for (const table of ["routines", "menus"]) {
      for (const row of plan.tables.find((t) => t.table === table)!.rows) {
        expect(templates.has(row.source_template_id)).toBe(true);
      }
    }
  });

  it("is deterministic, and two trainers share no id", () => {
    const keysOf = (p: typeof plan) =>
      p.tables.flatMap((set) => set.rows.map((row) => `${set.table}/${rowKey(set, row)}`));
    expect(buildSupabaseSeedPlan(input()).tables).toEqual(plan.tables);
    const other = buildSupabaseSeedPlan(
      input({
        trainerEmail: "otro@prueba.test",
        clientEmails: ["tres@prueba.test", "cuatro@prueba.test"],
      }),
    );
    const mine = new Set(keysOf(plan));
    expect(keysOf(other).filter((key) => mine.has(key))).toEqual([]);
  });
});
