import { describe, expect, it } from "vitest";
import { createRestSeedBackend } from "./rest-backend";
import { runSeed, type SeedCredential } from "./run";
import { resolveTarget } from "./target";

/**
 * La siembra entera contra el stack local de Supabase: escribe, repite sin duplicar, relee como la app
 * y entra con las cuentas creadas. Necesita las variables de abajo (las da `supabase status -o env`);
 * sin ellas se salta. Usa correos únicos y lo borra todo al terminar.
 *
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321
 *   SUPABASE_TEST_ANON_KEY=...
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=...
 */
const url = process.env.SUPABASE_TEST_URL ?? "";
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const ready = Boolean(url && anonKey && serviceKey);

const admin = (path: string, init: RequestInit = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!res.ok || !body.access_token) throw new Error(`No entra ${email}: HTTP ${res.status}`);
  return body.access_token;
}

async function readAs(token: string, table: string): Promise<{ id: string }[]> {
  const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`No se lee ${table}: HTTP ${res.status}`);
  return (await res.json()) as { id: string }[];
}

/** Las series y las líneas de rutina apuntan a la biblioteca sin cascada: se quitan antes. */
async function cleanUp(trainerId: string, userIds: string[]): Promise<void> {
  for (const table of ["workout_logs", "routine_day_exercises", "routines"]) {
    await admin(`/rest/v1/${table}?trainer_id=eq.${trainerId}`, { method: "DELETE" });
  }
  for (const id of userIds) await admin(`/auth/v1/admin/users/${id}`, { method: "DELETE" });
}

describe.skipIf(!ready)("siembra de Supabase · stack local", () => {
  it("seeds, repeats without duplicating, reads back like the app, and the accounts can sign in", async () => {
    const stamp = Date.now().toString(36);
    const trainerEmail = `siembra-entrenador-${stamp}@hector.test`;
    const clientEmail = `siembra-cliente-${stamp}@hector.test`;
    const target = resolveTarget({
      remote: false,
      env: { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey },
    });
    const backend = createRestSeedBackend(target);
    const run = (apply: boolean, credentials: SeedCredential[] = []) =>
      runSeed(backend, {
        apply,
        trainerEmail,
        trainerName: "Entrenador de la siembra",
        clientEmails: [clientEmail],
        now: () => new Date(),
        newPassword: () => `Siembra-${stamp}-1a`,
        credentials,
        log: () => {},
      });

    const dry = await run(false);
    expect(dry.blockers).toEqual([]);
    expect(Object.values(dry.counts).every((c) => c.existing === 0)).toBe(true);

    const credentials: SeedCredential[] = [];
    const first = await run(true, credentials);
    const userIds = [first.trainerUserId];
    try {
      expect(first.invalid).toEqual([]);
      for (const count of Object.values(first.counts)) expect(count.created).toBe(count.planned);
      expect(credentials.map((c) => c.email)).toEqual([trainerEmail, clientEmail]);
      const users = await backend.listAuthUsers();
      const client = users.find((u) => u.email === clientEmail)!;
      userIds.push(client.id);
      expect(users.find((u) => u.email === trainerEmail)!.emailConfirmed).toBe(true);
      expect(client.emailConfirmed).toBe(true);

      const again = await run(true);
      expect(again.blockers).toEqual([]);
      expect(again.invalid).toEqual([]);
      expect(Object.values(again.counts).every((c) => c.created === 0)).toBe(true);

      // El token lleva el rol y el inquilino del perfil: cada uno ve lo suyo y nada más.
      const trainerToken = await signIn(trainerEmail, credentials[0]!.password);
      expect(await readAs(trainerToken, "exercises")).toHaveLength(12);
      expect(await readAs(trainerToken, "clients")).toHaveLength(2);
      const clientToken = await signIn(clientEmail, credentials[1]!.password);
      expect(await readAs(clientToken, "clients")).toHaveLength(1);
    } finally {
      await cleanUp(first.trainerUserId, userIds);
    }
  }, 120_000);
});
