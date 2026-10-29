import type { ExportedAccount, PeoplePlan } from "./people";
import { assertLocalUrl, serviceHeaders, upsertRows, type LoadTarget } from "./rest";

/**
 * Carga de entrenadores, clientes y perfiles en Supabase, con `fetch` (sin SDK).
 *
 * Contraseñas de prueba: las cuentas que ya existen en la instancia local (creadas sin contraseña en
 * una carga anterior, al perderse la de Firebase) reciben `admin123` para entrenadores y `cliente123`
 * para clientes. Las cuentas nuevas se crean sin contraseña y la eligen sus dueños por correo. Son
 * valores de desarrollo: el cargador solo escribe contra localhost (`assertLocalUrl`).
 */

export { assertLocalUrl };

export const DEV_PASSWORDS = { trainer: "admin123", client: "cliente123" } as const;

export interface LoadReport {
  authUsersCreated: number;
  authUsersSkipped: number;
  passwordsSet: number;
  trainers: number;
  clients: number;
  profiles: number;
}

export async function loadPeople(
  plan: PeoplePlan,
  accounts: ExportedAccount[],
  target: LoadTarget,
): Promise<LoadReport> {
  assertLocalUrl(target.url);
  const send = target.fetch ?? fetch;
  const headers = serviceHeaders(target.serviceKey);

  const roleByUid = new Map(plan.profiles.map((profile) => [profile.user_id, profile.role]));
  const trainerById = new Map(plan.trainers.map((row) => [row.id, row]));
  let authUsersCreated = 0;
  let authUsersSkipped = 0;
  let passwordsSet = 0;

  for (const account of accounts) {
    const role = roleByUid.get(account.uid);
    if (role === undefined) continue;
    const trainer = trainerById.get(account.uid);
    const email = account.email ?? trainer?.email;
    if (!email) throw new Error(`La cuenta ${account.uid} no tiene correo.`);

    const existing = await send(`${target.url}/auth/v1/admin/users/${account.uid}`, { headers });
    if (existing.ok) {
      const password = role === "trainer" ? DEV_PASSWORDS.trainer : DEV_PASSWORDS.client;
      const updated = await send(`${target.url}/auth/v1/admin/users/${account.uid}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ password }),
      });
      if (!updated.ok) {
        throw new Error(`Auth ${updated.status} al poner la contraseña de ${account.uid}.`);
      }
      authUsersSkipped += 1;
      passwordsSet += 1;
      continue;
    }
    if (existing.status !== 404) {
      throw new Error(`Auth ${existing.status} al buscar la cuenta ${account.uid}.`);
    }
    const created = await send(`${target.url}/auth/v1/admin/users`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: account.uid,
        email,
        email_confirm: true,
        user_metadata: {},
        app_metadata: {},
      }),
    });
    if (!created.ok) {
      throw new Error(`Auth ${created.status} al crear la cuenta ${account.uid}.`);
    }
    authUsersCreated += 1;
  }

  await upsertRows(target, "trainers", "id", plan.trainers);
  await upsertRows(target, "clients", "id", plan.clients);
  await upsertRows(target, "profiles", "user_id", plan.profiles);

  return {
    authUsersCreated,
    authUsersSkipped,
    passwordsSet,
    trainers: plan.trainers.length,
    clients: plan.clients.length,
    profiles: plan.profiles.length,
  };
}
