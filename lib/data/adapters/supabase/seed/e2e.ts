import { createClient } from "@supabase/supabase-js";
import { assertLocalUrl } from "../migration/rest";
import { createSupabasePorts } from "../ports";

/**
 * Semilla de las pruebas de humo (`pnpm test:e2e`, tarjeta 130), solo contra la instancia local de
 * Supabase. Es el único código de las pruebas que habla con el SDK, por eso vive en el adaptador.
 *
 * Cada ejecución borra lo que dejó la anterior (las cuentas de `E2E_DOMAIN` y lo que cuelga de ellas)
 * y siembra un entrenador con dos ejercicios y una plantilla de rutina, y un cliente `activo` de ese
 * entrenador. Todo es sintético: correos de un dominio reservado, contraseñas de prueba de la
 * instancia local, ningún dato real.
 */

/** Dominio reservado para pruebas (RFC 2606): ningún correo de aquí llega a nadie. */
export const E2E_DOMAIN = "e2e.hector.test";

export const E2E_ACCOUNTS = {
  trainer: { email: `entrenador@${E2E_DOMAIN}`, password: "e2e-entrenador-1" },
  client: { email: `cliente@${E2E_DOMAIN}`, password: "e2e-cliente-1" },
} as const;

export const E2E_TEMPLATE_NAME = "Plantilla de humo · Torso";

export interface E2eTarget {
  url: string;
  anonKey: string;
  serviceKey: string;
}

export interface E2eSeed {
  trainerId: string;
  clientId: string;
  clientName: string;
  templateId: string;
}

function adminFetch(target: E2eTarget) {
  return (path: string, init: RequestInit = {}) =>
    fetch(`${target.url}${path}`, {
      ...init,
      headers: {
        apikey: target.serviceKey,
        Authorization: `Bearer ${target.serviceKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
}

async function ok(response: Response, what: string): Promise<Response> {
  if (!response.ok) throw new Error(`${what}: ${response.status} ${await response.text()}`);
  return response;
}

/** Borra las cuentas de pruebas y lo que cuelga de ellas, fotos de Storage incluidas. */
async function clean(target: E2eTarget): Promise<void> {
  const admin = adminFetch(target);
  const listed = await ok(
    await admin("/auth/v1/admin/users?per_page=1000"),
    "No se pudieron listar las cuentas",
  );
  const { users } = (await listed.json()) as { users: { id: string; email?: string }[] };
  const ours = users.filter((u) => u.email?.endsWith(`@${E2E_DOMAIN}`));
  const trainers = (await (
    await ok(
      await admin(`/rest/v1/trainers?select=id&email=like.*%40${E2E_DOMAIN}`),
      "No se pudieron leer los entrenadores",
    )
  ).json()) as { id: string }[];

  for (const { id } of trainers) {
    // Las líneas de rutina apuntan a la biblioteca sin cascada: se quitan antes que el entrenador.
    for (const table of ["routine_day_exercises", "routines"]) {
      await ok(
        await admin(`/rest/v1/${table}?trainer_id=eq.${id}`, { method: "DELETE" }),
        `No se pudo limpiar ${table}`,
      );
    }
    const objects = await ok(
      await admin(`/storage/v1/object/list/review-photos`, {
        method: "POST",
        body: JSON.stringify({ prefix: `${id}/`, limit: 1000 }),
      }),
      "No se pudieron listar las fotos",
    );
    // La lista es por carpetas: se borran las fotos de cada revisión de cada cliente.
    const clients = (await objects.json()) as { name: string }[];
    for (const client of clients) {
      const reviews = (await (
        await admin(`/storage/v1/object/list/review-photos`, {
          method: "POST",
          body: JSON.stringify({ prefix: `${id}/${client.name}/`, limit: 1000 }),
        })
      ).json()) as { name: string }[];
      for (const review of reviews) {
        const prefix = `${id}/${client.name}/${review.name}/`;
        const files = (await (
          await admin(`/storage/v1/object/list/review-photos`, {
            method: "POST",
            body: JSON.stringify({ prefix, limit: 1000 }),
          })
        ).json()) as { name: string }[];
        if (files.length > 0) {
          await admin(`/storage/v1/object/review-photos`, {
            method: "DELETE",
            body: JSON.stringify({ prefixes: files.map((f) => `${prefix}${f.name}`) }),
          });
        }
      }
    }
  }
  for (const { id } of ours) {
    await ok(await admin(`/auth/v1/admin/users/${id}`, { method: "DELETE" }), "No se pudo borrar");
  }
}

async function createAccount(target: E2eTarget, email: string, password: string): Promise<string> {
  const response = await ok(
    await adminFetch(target)("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true }),
    }),
    `No se pudo crear la cuenta de pruebas ${email}`,
  );
  return ((await response.json()) as { id: string }).id;
}

async function insertRows(target: E2eTarget, table: string, rows: object[]): Promise<void> {
  await ok(
    await adminFetch(target)(`/rest/v1/${table}`, {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rows),
    }),
    `No se pudo insertar en ${table}`,
  );
}

export async function seedE2e(target: E2eTarget): Promise<E2eSeed> {
  assertLocalUrl(target.url);
  await clean(target);

  const trainerId = await createAccount(
    target,
    E2E_ACCOUNTS.trainer.email,
    E2E_ACCOUNTS.trainer.password,
  );
  const clientUserId = await createAccount(
    target,
    E2E_ACCOUNTS.client.email,
    E2E_ACCOUNTS.client.password,
  );
  const clientId = crypto.randomUUID();
  // Alta hace tres semanas: el cliente tiene semana en curso y puede abrir su revisión.
  const startDate = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10);

  await insertRows(target, "trainers", [
    {
      id: trainerId,
      name: "Entrenador de humo",
      email: E2E_ACCOUNTS.trainer.email,
      time_zone: "Europe/Madrid",
    },
  ]);
  await insertRows(target, "clients", [
    {
      id: clientId,
      trainer_id: trainerId,
      first_name: "Cliente",
      last_name: "De humo",
      email: E2E_ACCOUNTS.client.email,
      status: "activo",
      start_date: startDate,
      review_every_days: 7,
      macros_visible: true,
    },
  ]);
  await insertRows(target, "profiles", [
    { user_id: trainerId, role: "trainer", trainer_id: trainerId, client_id: null },
    { user_id: clientUserId, role: "client", trainer_id: trainerId, client_id: clientId },
  ]);

  // La biblioteca y la plantilla, por los puertos: valen las mismas reglas que en la app.
  const ports = createSupabasePorts({
    config: { url: target.url, anonKey: target.anonKey },
    passwordResetRedirect: "http://127.0.0.1:3000/reset-password",
    client: createClient(target.url, target.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  });
  await ports.session.login(E2E_ACCOUNTS.trainer.email, E2E_ACCOUNTS.trainer.password);
  const exercise = (name: string) =>
    ports.exercises.createExercise({
      trainerId,
      name,
      muscleGroup: "",
      equipment: "",
      videoUrl: null,
      description: "",
    });
  const [press, row] = [await exercise("Press de humo"), await exercise("Remo de humo")];
  const prescription = { sets: 3, repsMin: 8, repsMax: 10, rir: "2", rest: "2 min", note: "" };
  const template = await ports.templates.saveRoutineTemplate({
    trainerId,
    name: E2E_TEMPLATE_NAME,
    description: "",
    note: "",
    days: [
      {
        id: crypto.randomUUID(),
        dayNumber: 1,
        label: "Torso",
        exercises: [
          { id: crypto.randomUUID(), exerciseId: press.id, prescription },
          { id: crypto.randomUUID(), exerciseId: row.id, prescription },
        ],
      },
    ],
  });
  await ports.session.logout();

  return { trainerId, clientId, clientName: "Cliente De humo", templateId: template.id };
}
