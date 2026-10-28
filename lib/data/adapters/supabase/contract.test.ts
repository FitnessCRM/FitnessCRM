import { createClient } from "@supabase/supabase-js";
import { runWriteContract, type ContractActor } from "../contract/write-contract";
import { createSupabasePorts } from "./ports";

/**
 * Contrato de escritura contra el stack local de Supabase. Necesita las tres variables de abajo (las
 * da `supabase status -o env`); sin ellas la suite se salta. Crea sus cuentas y filas con la clave de
 * servicio, que salta RLS, y las borra al terminar.
 *
 *   SUPABASE_TEST_URL=http://127.0.0.1:54321
 *   SUPABASE_TEST_ANON_KEY=...
 *   SUPABASE_TEST_SERVICE_ROLE_KEY=...
 */
const url = process.env.SUPABASE_TEST_URL ?? "";
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
const PASSWORD = "contrato-1";

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

async function createAccount(email: string): Promise<string> {
  const response = await admin("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password: PASSWORD, email_confirm: true }),
  });
  const body = (await response.json()) as { id?: string; msg?: string };
  if (!response.ok || !body.id) throw new Error(`No se pudo crear ${email}: ${body.msg}`);
  return body.id;
}

async function insertRows(table: string, rows: object[]): Promise<void> {
  const response = await admin(`/rest/v1/${table}`, {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`No se pudo insertar en ${table}: ${await response.text()}`);
}

/**
 * Las líneas de rutina apuntan a la biblioteca sin cascada, así que el borrado del entrenador falla
 * mientras haya rutinas: se quitan antes.
 */
async function clearPlans(trainerId: string): Promise<void> {
  for (const table of ["routine_day_exercises", "routines"]) {
    const response = await admin(`/rest/v1/${table}?trainer_id=eq.${trainerId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(`No se pudo limpiar ${table}: ${await response.text()}`);
  }
}

async function deleteAccount(userId: string): Promise<void> {
  const response = await admin(`/auth/v1/admin/users/${userId}`, { method: "DELETE" });
  if (!response.ok)
    throw new Error(`No se pudo borrar la cuenta ${userId}: ${await response.text()}`);
}

const ready = Boolean(url && anonKey && serviceKey);

runWriteContract(
  "supabase (stack local)",
  async () => {
    const stamp = Date.now().toString(36);
    const trainerEmail = `contrato-entrenadora-${stamp}@hector.test`;
    const otherEmail = `contrato-otro-${stamp}@hector.test`;
    const clientEmail = `contrato-clienta-${stamp}@hector.test`;

    const trainerId = await createAccount(trainerEmail);
    const otherTrainerId = await createAccount(otherEmail);
    const clientUserId = await createAccount(clientEmail);
    const clientId = crypto.randomUUID();

    // Orden de las claves foráneas: entrenadores, clientes y, al final, los perfiles que los apuntan.
    await insertRows("trainers", [
      {
        id: trainerId,
        name: "Entrenadora de contrato",
        email: trainerEmail,
        time_zone: "Europe/Madrid",
      },
      {
        id: otherTrainerId,
        name: "Otro entrenador",
        email: otherEmail,
        time_zone: "Europe/Madrid",
      },
    ]);
    await insertRows("clients", [
      {
        id: clientId,
        trainer_id: trainerId,
        first_name: "Marta",
        last_name: "Contrato",
        email: clientEmail,
        status: "activo",
        start_date: "2026-08-01",
        review_every_days: 7,
        macros_visible: true,
      },
    ]);
    await insertRows("profiles", [
      { user_id: trainerId, role: "trainer", trainer_id: trainerId, client_id: null },
      { user_id: otherTrainerId, role: "trainer", trainer_id: otherTrainerId, client_id: null },
      { user_id: clientUserId, role: "client", trainer_id: trainerId, client_id: clientId },
    ]);

    const ports = createSupabasePorts({
      config: { url, anonKey },
      passwordResetRedirect: "http://localhost:3000/reset-password",
      // Node no tiene cookies: la sesión vive en memoria del propio cliente.
      client: createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    });
    const accounts: Record<ContractActor, string> = {
      trainer: trainerEmail,
      otherTrainer: otherEmail,
      client: clientEmail,
    };

    return {
      ports,
      ids: { trainer: trainerId, otherTrainer: otherTrainerId, client: clientId },
      as: async (actor) => {
        await ports.session.logout();
        await ports.session.login(accounts[actor], PASSWORD);
      },
      dispose: async () => {
        await Promise.all([trainerId, otherTrainerId].map(clearPlans));
        await Promise.all([trainerId, otherTrainerId, clientUserId].map(deleteAccount));
      },
    };
  },
  { enabled: ready },
);
