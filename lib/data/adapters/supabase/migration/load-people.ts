import type { ExportedAccount, PeoplePlan } from "./people";

/**
 * Carga de entrenadores, clientes y perfiles en Supabase por la API REST y la de Auth, con `fetch`
 * (sin SDK: el SDK de Supabase solo se importa desde `lib/data/adapters/supabase/`). Las cuentas se
 * crean sin contraseña: cada persona restablece la suya por correo, como se decidió el 29-10-2026.
 */

export interface LoadTarget {
  /** Base de la API, p. ej. `http://127.0.0.1:54321`. Pasa por `assertLocalUrl` antes de usarla. */
  url: string;
  /** Clave de servicio: salta RLS, así que nunca se imprime ni se guarda. */
  serviceKey: string;
  fetch?: typeof fetch;
}

export interface LoadReport {
  authUsersCreated: number;
  authUsersSkipped: number;
  trainers: number;
  clients: number;
  profiles: number;
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

/** Solo se carga contra la instancia local. Subir a producción es otra decisión, no un parámetro. */
export function assertLocalUrl(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("La URL de Supabase no es válida.");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`La carga solo corre contra la instancia local, y «${host}» no lo es.`);
  }
}

export async function loadPeople(
  plan: PeoplePlan,
  accounts: ExportedAccount[],
  target: LoadTarget,
): Promise<LoadReport> {
  assertLocalUrl(target.url);
  const send = target.fetch ?? fetch;
  const headers = {
    apikey: target.serviceKey,
    Authorization: `Bearer ${target.serviceKey}`,
    "Content-Type": "application/json",
  };

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

  await upsert(send, target, "trainers", "id", plan.trainers, headers);
  await upsert(send, target, "clients", "id", plan.clients, headers);
  await upsert(send, target, "profiles", "user_id", plan.profiles, headers);

  return {
    authUsersCreated,
    authUsersSkipped,
    trainers: plan.trainers.length,
    clients: plan.clients.length,
    profiles: plan.profiles.length,
  };
}

async function upsert(
  send: typeof fetch,
  target: LoadTarget,
  table: string,
  key: string,
  rows: object[],
  headers: Record<string, string>,
): Promise<void> {
  if (rows.length === 0) return;
  const res = await send(`${target.url}/rest/v1/${table}?on_conflict=${key}`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`REST ${res.status} al escribir ${table}.`);
}
