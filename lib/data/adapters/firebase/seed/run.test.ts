import { describe, expect, it } from "vitest";
import { TRAINER_EMAIL } from "./people";
import {
  runSeed,
  userLinkDifferences,
  type DocPath,
  type SeedAccount,
  type SeedBackend,
  type SeedCredential,
  type SeedRunOptions,
} from "./run";
import { SeedAbort } from "./target";

const pathOf = (p: DocPath) => `${p.collection}/${p.id}`;

/** Firebase en memoria, con lo justo: cuentas, documentos y un `create()` que no sobrescribe. */
function memoryBackend() {
  const accounts = new Map<string, SeedAccount & { password: string }>();
  const docs = new Map<string, Record<string, unknown>>();
  let uid = 0;
  /** Si se pone, el `create()` número `failAt` falla: una siembra que se corta a medias. */
  const state = { creates: 0, failAt: null as number | null };
  const backend: SeedBackend = {
    findAccount: async (email) => accounts.get(email) ?? null,
    createAccount: async (email, password) => {
      if (accounts.has(email)) throw new Error(`La cuenta ${email} ya existe`);
      const account = { uid: `uid-${++uid}`, email, emailVerified: true, password };
      accounts.set(email, account);
      return account;
    },
    readDocs: async (paths) => paths.map((p) => docs.get(pathOf(p)) ?? null),
    createDoc: async (path, data) => {
      if (state.failAt !== null && ++state.creates === state.failAt) throw new Error("red caída");
      if (docs.has(pathOf(path))) return false;
      docs.set(pathOf(path), structuredClone(data));
      return true;
    },
    listIdsByTrainer: async (collection, trainerId) =>
      [...docs]
        .filter(([key, data]) => key.startsWith(`${collection}/`) && data.trainerId === trainerId)
        .map(([key]) => key.slice(collection.length + 1)),
    findTrainerIdsByEmail: async (email) =>
      [...docs]
        .filter(([key, data]) => key.startsWith("trainers/") && data.email === email)
        .map(([key]) => key.slice("trainers/".length)),
  };
  return { backend, accounts, docs, state };
}

function optionsAt(
  iso: string,
  over: Partial<SeedRunOptions> = {},
): SeedRunOptions & { lines: string[]; credentials: SeedCredential[] } {
  const lines: string[] = [];
  let n = 0;
  return {
    apply: false,
    trainerName: "Entrenador de prueba",
    now: () => new Date(iso),
    newPassword: () => `temporal-${++n}`,
    credentials: [],
    log: (line) => lines.push(line),
    lines,
    ...over,
  };
}

const DAY_1 = "2026-10-12T10:00:00.000Z";
const DAY_9 = "2026-10-20T16:30:00.000Z";

describe("siembra · ejecución", () => {
  it("a dry run reads and counts but writes nothing and generates no password", async () => {
    const { backend, accounts, docs } = memoryBackend();
    const options = optionsAt(DAY_1);
    const result = await runSeed(backend, options);
    expect(result.applied).toBe(false);
    expect(result.blockers).toEqual([]);
    expect(result.anchor).toBe("2026-10-12");
    expect(docs.size).toBe(0);
    expect(accounts.size).toBe(0);
    expect(options.credentials).toEqual([]);
    expect(options.lines.join("\n")).toContain("se generarían 3 contraseñas");
  });

  it("apply creates everything once; running it again creates nothing, also days later", async () => {
    const { backend, accounts, docs } = memoryBackend();
    const first = optionsAt(DAY_1, { apply: true });
    const result = await runSeed(backend, first);
    expect(result.applied).toBe(true);
    expect(result.invalid).toEqual([]);
    expect(accounts.size).toBe(3);
    expect(first.credentials.map((c) => c.email)).toEqual([
      TRAINER_EMAIL,
      "daniel2003ml+lucas@gmail.com",
      "daniel2003ml+irene@gmail.com",
    ]);
    // El entrenador nuevo toma como id el uid de su cuenta.
    const trainerUid = accounts.get(TRAINER_EMAIL)!.uid;
    expect(result.trainerId).toBe(trainerUid);
    expect(docs.get(`trainers/${trainerUid}`)).toMatchObject({
      name: "Entrenador de prueba",
      email: TRAINER_EMAIL,
      timeZone: "Europe/Madrid",
    });
    expect(docs.get(`users/${trainerUid}`)).toEqual({
      role: "trainer",
      trainerId: trainerUid,
      clientId: null,
      email: TRAINER_EMAIL,
    });
    // El cliente, con exactamente las cuatro claves que exigen las reglas.
    const lucasUid = accounts.get("daniel2003ml+lucas@gmail.com")!.uid;
    expect(docs.get(`users/${lucasUid}`)).toEqual({
      role: "client",
      trainerId: trainerUid,
      clientId: "seed-lucas",
      email: "daniel2003ml+lucas@gmail.com",
    });

    const before = structuredClone([...docs]);
    for (const iso of [DAY_1, DAY_9]) {
      const again = optionsAt(iso, { apply: true, trainerName: undefined });
      const repeated = await runSeed(backend, again);
      expect(Object.values(repeated.counts).reduce((sum, c) => sum + c.created, 0)).toBe(0);
      expect(repeated.anchor).toBe("2026-10-12");
      expect(again.credentials).toEqual([]);
      expect(again.lines.join("\n")).toContain("Creado: nada. Todo existía ya.");
    }
    expect([...docs]).toEqual(before);
    expect(accounts.size).toBe(3);
  });

  it("cut halfway, it says what was done, keeps the passwords, and a second run completes it", async () => {
    const complete = memoryBackend();
    await runSeed(complete.backend, optionsAt(DAY_1, { apply: true }));

    const { backend, accounts, docs, state } = memoryBackend();
    state.failAt = 120;
    const first = optionsAt(DAY_1, { apply: true });
    await expect(runSeed(backend, first)).rejects.toThrow("red caída");
    expect(first.lines.join("\n")).toContain("Interrumpido");
    // La cuenta del entrenador ya estaba creada: su contraseña no se pierde con el fallo.
    expect(first.credentials.map((c) => c.email)).toEqual([TRAINER_EMAIL]);
    expect(docs.size).toBeLessThan(complete.docs.size);

    state.failAt = null;
    const second = optionsAt(DAY_9, { apply: true });
    const result = await runSeed(backend, second);
    expect(result.invalid).toEqual([]);
    expect(second.credentials.map((c) => c.email)).toEqual([
      "daniel2003ml+lucas@gmail.com",
      "daniel2003ml+irene@gmail.com",
    ]);
    expect(accounts.size).toBe(3);
    // Mismos documentos que la siembra de una pasada (los uid de las cuentas coinciden).
    expect([...docs.keys()].sort()).toEqual([...complete.docs.keys()].sort());
  });

  it("an existing trainer is reused: account, users/{uid}, id and time zone are left as they are", async () => {
    const { backend, accounts, docs } = memoryBackend();
    accounts.set(TRAINER_EMAIL, {
      uid: "uid-real",
      email: TRAINER_EMAIL,
      emailVerified: false,
      password: "la-suya",
    });
    const link = { role: "trainer", trainerId: "t-damaso", name: "sobra" };
    docs.set("users/uid-real", { ...link });
    const trainer = {
      id: "t-damaso",
      name: "H. Dámaso",
      email: TRAINER_EMAIL,
      timeZone: "Atlantic/Canary",
      createdAt: "2026-10-01T09:00:00.000Z",
    };
    docs.set("trainers/t-damaso", { ...trainer });

    const options = optionsAt(DAY_1, {
      apply: true,
      trainerName: undefined,
      timeZone: "Europe/Madrid",
    });
    const result = await runSeed(backend, options);
    expect(result.trainerId).toBe("t-damaso");
    expect(result.timeZone).toBe("Atlantic/Canary");
    expect(accounts.get(TRAINER_EMAIL)).toMatchObject({
      password: "la-suya",
      emailVerified: false,
    });
    expect(docs.get("users/uid-real")).toEqual(link);
    expect(docs.get("trainers/t-damaso")).toEqual(trainer);
    expect(docs.get("clients/seed-lucas")).toMatchObject({ trainerId: "t-damaso" });
    // Solo se generan contraseñas para las cuentas nuevas, y las diferencias de forma se cuentan.
    expect(options.credentials.map((c) => c.email)).not.toContain(TRAINER_EMAIL);
    const output = options.lines.join("\n");
    expect(output).toContain("falta «clientId»");
    expect(output).toContain("falta «email»");
    expect(output).toContain("sobra «name»");
    expect(output).toContain("--time-zone Europe/Madrid se ignora");
  });

  it("a missing trainers/{id} without --trainer-name blocks apply before anything is written", async () => {
    const { backend, accounts, docs } = memoryBackend();
    const dry = await runSeed(backend, optionsAt(DAY_1, { trainerName: undefined }));
    expect(dry.blockers).toHaveLength(1);
    await expect(
      runSeed(backend, optionsAt(DAY_1, { apply: true, trainerName: "  " })),
    ).rejects.toThrow(SeedAbort);
    expect(docs.size).toBe(0);
    expect(accounts.size).toBe(0);
  });

  it("own documents that are not from the seed block apply; the dry run reports them", async () => {
    const { backend, accounts, docs } = memoryBackend();
    accounts.set(TRAINER_EMAIL, {
      uid: "uid-real",
      email: TRAINER_EMAIL,
      emailVerified: true,
      password: "x",
    });
    docs.set("users/uid-real", {
      role: "trainer",
      trainerId: "t-damaso",
      clientId: null,
      email: TRAINER_EMAIL,
    });
    docs.set("exercises/abc123", { id: "abc123", trainerId: "t-damaso" });
    docs.set("exercises/de-otro", { id: "de-otro", trainerId: "t-otro" });
    const size = docs.size;

    const dry = optionsAt(DAY_1);
    const result = await runSeed(backend, dry);
    expect(result.blockers.join("\n")).toContain("exercises 1");
    await expect(runSeed(backend, optionsAt(DAY_1, { apply: true }))).rejects.toThrow(SeedAbort);
    expect(docs.size).toBe(size);
  });

  it("a seed id owned by another trainer is a conflict, never an «already exists»", async () => {
    const { backend, docs } = memoryBackend();
    docs.set("clients/seed-lucas", {
      id: "seed-lucas",
      trainerId: "t-otro",
      startDate: "2026-01-01",
    });
    const size = docs.size;
    const result = await runSeed(backend, optionsAt(DAY_1));
    expect(result.blockers.join("\n")).toContain("clients/seed-lucas");
    expect(result.anchor).toBe("2026-10-12");
    await expect(runSeed(backend, optionsAt(DAY_1, { apply: true }))).rejects.toThrow(SeedAbort);
    expect(docs.size).toBe(size);
  });

  it("a client account already linked to someone else blocks apply", async () => {
    const { backend, accounts, docs } = memoryBackend();
    accounts.set("daniel2003ml+lucas@gmail.com", {
      uid: "uid-lucas",
      email: "daniel2003ml+lucas@gmail.com",
      emailVerified: true,
      password: "x",
    });
    docs.set("users/uid-lucas", {
      role: "client",
      trainerId: "t-otro",
      clientId: "c-9",
      email: "x",
    });
    await expect(runSeed(backend, optionsAt(DAY_1, { apply: true }))).rejects.toThrow(SeedAbort);
    expect(docs.size).toBe(1);
  });

  it("a changed start date breaks the anchor and stops the run", async () => {
    const { backend, docs } = memoryBackend();
    await runSeed(backend, optionsAt(DAY_1, { apply: true }));
    docs.set("clients/seed-irene", { ...docs.get("clients/seed-irene")!, startDate: "2026-08-01" });
    await expect(runSeed(backend, optionsAt(DAY_9, { apply: true }))).rejects.toThrow(SeedAbort);
  });

  it("differences of a users/{uid} list missing, extra and different keys, without extra values", () => {
    expect(
      userLinkDifferences(
        { role: "trainer", trainerId: "t-1", clientId: "", note: "secreto" },
        { role: "trainer", trainerId: "t-1", clientId: null, email: "a@b.c" },
      ),
    ).toEqual(['«clientId» es "" y se esperaba null', "falta «email»", "sobra «note»"]);
  });
});
