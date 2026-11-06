import { describe, expect, it } from "vitest";
import { seedTrainerUserId } from "./ids";
import type { SeedRow } from "./plan";
import {
  runSeed,
  type AuthUser,
  type Filter,
  type SeedCredential,
  type SeedRunOptions,
  type SupabaseSeedBackend,
} from "./run";
import { SeedAbort } from "./target";

const TRAINER = "entrenador@prueba.test";
const T = seedTrainerUserId(TRAINER);
const READ_BACK_TABLES = [
  "clients",
  "memberships",
  "exercises",
  "foods",
  "measurement_types",
  "questionnaire_questions",
  "routine_templates",
  "menu_templates",
  "routines",
  "menus",
  "macro_targets",
  "weight_logs",
  "workout_logs",
  "reviews",
];

/** Supabase en memoria: tablas como listas de filas, con los filtros y la inserción que usa la siembra. */
class MemoryBackend implements SupabaseSeedBackend {
  users: AuthUser[] = [];
  tables = new Map<string, SeedRow[]>();
  writes = 0;
  /** Falla la próxima inserción en esa tabla, para cortar la siembra a medias. */
  failOn: string | null = null;
  readOnly = false;

  rows(table: string): SeedRow[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  async listAuthUsers() {
    return this.users.map((u) => ({ ...u }));
  }

  async createAuthUser({ id, email }: { id: string; email: string; password: string }) {
    if (this.readOnly) throw new Error("escritura en dry-run");
    this.writes += 1;
    if (this.users.some((u) => u.id === id || u.email === email))
      throw new Error("cuenta repetida");
    this.users.push({ id, email, emailConfirmed: true });
  }

  async select(table: string, _columns: string, filters: readonly Filter[]) {
    return this.rows(table).filter((row) =>
      filters.every(({ column, op, value }) => {
        const cell = String(row[column]);
        if (op === "in") return (value as readonly string[]).includes(cell);
        if (op === "ilike") return cell.toLowerCase() === String(value).toLowerCase();
        return cell === value;
      }),
    );
  }

  async insert(table: string, onConflict: string, rows: readonly SeedRow[]) {
    if (this.readOnly) throw new Error("escritura en dry-run");
    if (this.failOn === table) {
      this.failOn = null;
      throw new Error(`fallo simulado en ${table}`);
    }
    this.writes += 1;
    const key = (row: SeedRow) =>
      onConflict
        .split(",")
        .map((c) => String(row[c]))
        .join("/");
    const stored = this.rows(table);
    const keys = new Set(stored.map(key));
    let created = 0;
    for (const row of rows) {
      if (keys.has(key(row))) continue;
      stored.push({ ...row });
      keys.add(key(row));
      created += 1;
    }
    return created;
  }

  async readBack(trainerUserId: string) {
    const counts: Record<string, number> = {};
    for (const table of READ_BACK_TABLES) {
      counts[table] = this.rows(table).filter((r) => r.trainer_id === trainerUserId).length;
    }
    counts.trainers = this.rows("trainers").filter((r) => r.id === trainerUserId).length;
    counts.profiles = this.rows("profiles").filter((r) => r.trainer_id === trainerUserId).length;
    return { counts, invalid: [] };
  }

  snapshot() {
    return JSON.stringify([this.users, [...this.tables.entries()]]);
  }
}

function options(over: Partial<SeedRunOptions> = {}) {
  const credentials: SeedCredential[] = [];
  const lines: string[] = [];
  let n = 0;
  const opts: SeedRunOptions = {
    apply: true,
    trainerEmail: TRAINER,
    trainerName: "Entrenador de prueba",
    clientEmails: ["uno@prueba.test", "dos@prueba.test"],
    now: () => new Date("2026-11-06T20:00:00.000Z"),
    newPassword: () => `clave-${++n}`,
    credentials,
    log: (line) => lines.push(line),
    ...over,
  };
  return { opts, credentials, lines };
}

const created = (counts: Record<string, { created: number }>) =>
  Object.values(counts).reduce((sum, c) => sum + c.created, 0);

describe("siembra de Supabase · ejecución", () => {
  it("a dry run reads and counts but writes nothing and generates no password", async () => {
    const backend = new MemoryBackend();
    backend.readOnly = true;
    const { opts, credentials } = options({ apply: false });
    const result = await runSeed(backend, opts);
    expect(result.applied).toBe(false);
    expect(result.blockers).toEqual([]);
    expect(backend.writes).toBe(0);
    expect(credentials).toEqual([]);
    expect(result.counts.exercises).toEqual({ planned: 12, existing: 0, created: 0 });
  });

  it("apply creates everything once; running it again creates nothing, also days later", async () => {
    const backend = new MemoryBackend();
    const first = options();
    const result = await runSeed(backend, first.opts);
    expect(result.applied).toBe(true);
    expect(result.invalid).toEqual([]);
    expect(first.credentials.map((c) => c.email)).toEqual([
      TRAINER,
      "uno@prueba.test",
      "dos@prueba.test",
    ]);
    for (const count of Object.values(result.counts)) expect(count.created).toBe(count.planned);
    const before = backend.snapshot();

    const later = options({ now: () => new Date("2026-11-20T08:00:00.000Z") });
    const again = await runSeed(backend, later.opts);
    expect(again.anchor).toBe(result.anchor);
    expect(again.blockers).toEqual([]);
    expect(created(again.counts)).toBe(0);
    for (const count of Object.values(again.counts)) expect(count.existing).toBe(count.planned);
    expect(later.credentials).toEqual([]);
    expect(backend.snapshot()).toBe(before);
  });

  it("cut halfway, it keeps the passwords, and a second run completes what is missing", async () => {
    const backend = new MemoryBackend();
    backend.failOn = "routines";
    const first = options();
    await expect(runSeed(backend, first.opts)).rejects.toThrow(/fallo simulado/);
    expect(first.credentials).toHaveLength(3);
    expect(backend.rows("exercises")).toHaveLength(12);
    expect(backend.rows("routines")).toHaveLength(0);

    const second = options();
    const result = await runSeed(backend, second.opts);
    expect(result.invalid).toEqual([]);
    expect(second.credentials).toEqual([]);
    expect(result.counts.exercises).toMatchObject({ existing: 12, created: 0 });
    expect(result.counts.routines).toMatchObject({ existing: 0, created: 2 });
  });

  it("own data of the trainer that is not from the seed blocks apply, and nothing is written", async () => {
    const backend = new MemoryBackend();
    await runSeed(backend, options().opts);
    backend.rows("exercises").push({ id: "00000000-0000-4000-8000-000000000001", trainer_id: T });
    backend.rows("membership_rates").push({ trainer_id: T, type: "mensual" });
    const before = backend.snapshot();
    const { opts, lines } = options();
    const result = await runSeed(backend, opts);
    expect(result.applied).toBe(false);
    expect(result.blockers.join(" ")).toMatch(/datos propios.*exercises 1.*membership_rates 1/);
    expect(lines.join("\n")).toMatch(/No se escribe nada/);
    expect(backend.snapshot()).toBe(before);
  });

  it("an email that belongs to an account the seed did not create blocks apply", async () => {
    const backend = new MemoryBackend();
    backend.users.push({
      id: "11111111-1111-4111-8111-111111111111",
      email: TRAINER,
      emailConfirmed: true,
    });
    const result = await runSeed(backend, options().opts);
    expect(result.applied).toBe(false);
    expect(result.blockers.join(" ")).toMatch(/ya es de una cuenta que no creó la siembra/);
    expect(backend.writes).toBe(0);

    const client = new MemoryBackend();
    client
      .rows("clients")
      .push({ id: "otro", trainer_id: "otro-entrenador", email: "UNO@prueba.test" });
    const blocked = await runSeed(client, options().opts);
    expect(blocked.blockers.join(" ")).toMatch(
      /uno@prueba.test ya es de un cliente que no es de la siembra/,
    );
    expect(client.writes).toBe(0);
  });

  it("a seed id owned by another trainer is a conflict, never an «already exists»", async () => {
    const backend = new MemoryBackend();
    await runSeed(backend, options({ apply: false }).opts);
    const seeded = new MemoryBackend();
    await runSeed(seeded, options().opts);
    const exercise = seeded.rows("exercises")[0]!;
    backend.rows("exercises").push({ ...exercise, trainer_id: "otro-entrenador" });
    const result = await runSeed(backend, options().opts);
    expect(result.blockers.join(" ")).toMatch(
      /exercises: 1 filas de la siembra son de otro entrenador/,
    );
    expect(backend.writes).toBe(0);
  });

  it("a trainer invitation for the email blocks apply: that is a real account", async () => {
    const backend = new MemoryBackend();
    backend.rows("trainer_invitations").push({ email: TRAINER, status: "invitado" });
    const result = await runSeed(backend, options().opts);
    expect(result.blockers.join(" ")).toMatch(/invitación de entrenador/);
    expect(backend.writes).toBe(0);
  });

  it("with one email, Irene is a client without account; three emails or repeated ones abort", async () => {
    const backend = new MemoryBackend();
    const { opts, credentials } = options({ clientEmails: ["uno@prueba.test"] });
    const result = await runSeed(backend, opts);
    expect(result.invalid).toEqual([]);
    expect(credentials.map((c) => c.email)).toEqual([TRAINER, "uno@prueba.test"]);
    expect(backend.rows("clients").map((c) => c.email)).toEqual([
      "uno@prueba.test",
      `irene.soto+${T.slice(0, 8)}@demo.invalid`,
    ]);
    expect(backend.rows("profiles")).toHaveLength(2);

    const three = ["a@prueba.test", "b@prueba.test", "c@prueba.test"];
    for (const clientEmails of [
      three,
      ["a@prueba.test", "A@prueba.test"],
      [TRAINER],
      ["no-es-correo"],
    ]) {
      await expect(
        runSeed(new MemoryBackend(), options({ clientEmails }).opts),
      ).rejects.toBeInstanceOf(SeedAbort);
    }
  });

  it("running again with another email for a seeded client is blocked: emails are not changed", async () => {
    const backend = new MemoryBackend();
    await runSeed(backend, options({ clientEmails: ["uno@prueba.test"] }).opts);
    const result = await runSeed(
      backend,
      options({ clientEmails: ["uno@prueba.test", "dos@prueba.test"] }).opts,
    );
    expect(result.blockers.join(" ")).toMatch(
      /La ficha de Irene ya está sembrada con el correo .*demo.invalid/,
    );
  });

  it("a missing trainer row without --trainer-name blocks apply; an existing one keeps its time zone", async () => {
    const backend = new MemoryBackend();
    const blocked = await runSeed(backend, options({ trainerName: undefined }).opts);
    expect(blocked.blockers.join(" ")).toMatch(/--trainer-name/);
    expect(backend.writes).toBe(0);

    await runSeed(backend, options({ timeZone: "Atlantic/Canary" }).opts);
    const { opts, lines } = options({ trainerName: undefined, timeZone: "America/Mexico_City" });
    const again = await runSeed(backend, opts);
    expect(again.timeZone).toBe("Atlantic/Canary");
    expect(again.blockers).toEqual([]);
    expect(lines.join("\n")).toMatch(/--time-zone America\/Mexico_City se ignora/);
  });

  it("a changed start date breaks the anchor and stops the run", async () => {
    const backend = new MemoryBackend();
    await runSeed(backend, options().opts);
    backend.rows("clients")[0]!.start_date = "2026-01-01";
    await expect(runSeed(backend, options().opts)).rejects.toThrow(/misma ancla/);
  });
});
