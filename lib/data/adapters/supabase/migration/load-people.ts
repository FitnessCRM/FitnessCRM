import type { ExportedAccount, PeoplePlan } from "./people";
import { assertLocalUrl, serviceHeaders, upsertRows, type LoadTarget } from "./rest";

/**
 * Carga de entrenadores, clientes y perfiles en Supabase, con `fetch` (sin SDK). Las cuentas se
 * crean sin contraseña: cada persona restablece la suya por correo, como se decidió el 29-10-2026.
 */

export { assertLocalUrl };

export interface LoadReport {
  authUsersCreated: number;
  authUsersSkipped: number;
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

  const linked = new Set(plan.profiles.map((profile) => profile.user_id));
  const trainerById = new Map(plan.trainers.map((row) => [row.id, row]));
  let authUsersCreated = 0;
  let authUsersSkipped = 0;

  for (const account of accounts) {
    if (!linked.has(account.uid)) continue;
    const trainer = trainerById.get(account.uid);
    const email = account.email ?? trainer?.email;
    if (!email) throw new Error(`La cuenta ${account.uid} no tiene correo.`);

    const existing = await send(`${target.url}/auth/v1/admin/users/${account.uid}`, { headers });
    if (existing.ok) {
      authUsersSkipped += 1;
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
    trainers: plan.trainers.length,
    clients: plan.clients.length,
    profiles: plan.profiles.length,
  };
}
