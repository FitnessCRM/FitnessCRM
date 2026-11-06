import {
  CLIENT_KEYS,
  CLIENT_SPECS,
  DEFAULT_TIME_ZONE,
  anchorFromStartDate,
  seedClientId,
  type ClientKey,
} from "@/lib/data/seed/people";
import {
  civilDateInTimeZone,
  civilDateSchema,
  emailSchema,
  timeZoneSchema,
  type CivilDate,
  type TimeZone,
} from "@/lib/domain";
import { clientIdFor } from "../migration/ids";
import {
  normalizeEmail,
  placeholderEmail,
  seedClientUserId,
  seedIdPrefix,
  seedTrainerUserId,
} from "./ids";
import {
  MAX_CLIENT_EMAILS,
  buildSupabaseSeedPlan,
  rowKey,
  type SeedRow,
  type SupabaseSeedPlan,
} from "./plan";
import { SeedAbort } from "./target";

/**
 * La siembra de la demo en Supabase (tarjeta 135): decide qué falta, y con `apply` lo crea. Habla
 * con Supabase solo a través de `SupabaseSeedBackend`, que `rest-backend.ts` implementa con la API
 * REST y la de administración de Auth, y los tests en memoria.
 */

export interface AuthUser {
  id: string;
  email: string | null;
  emailConfirmed: boolean;
}

/** Filtros de PostgREST que usa la siembra: igualdad, pertenencia y `ilike` sin comodines. */
export interface Filter {
  column: string;
  op: "eq" | "in" | "ilike";
  value: string | readonly string[];
}

export interface ReadBack {
  /** Filas releídas por tabla que pasan por los conversores del adaptador y su esquema. */
  counts: Record<string, number>;
  /** Filas que no se pudieron convertir, por tabla e id. Vacío si todo va bien. */
  invalid: string[];
}

/** Lo que la siembra necesita de Supabase. Solo lee y crea: no hay forma de sobrescribir ni borrar. */
export interface SupabaseSeedBackend {
  listAuthUsers(): Promise<AuthUser[]>;
  /** Cuenta nueva con ese id, el correo ya confirmado y sin enviar ningún correo. */
  createAuthUser(input: { id: string; email: string; password: string }): Promise<void>;
  select(table: string, columns: string, filters: readonly Filter[]): Promise<SeedRow[]>;
  /** Inserta y deja como están las filas que ya existen por su clave. Devuelve cuántas creó. */
  insert(table: string, onConflict: string, rows: readonly SeedRow[]): Promise<number>;
  /** Relee lo del entrenador como lo lee la app. */
  readBack(trainerUserId: string): Promise<ReadBack>;
}

export interface SeedCredential {
  email: string;
  password: string;
}

export interface SeedRunOptions {
  apply: boolean;
  trainerEmail: string;
  /** Obligatorio solo si falta la fila del entrenador. */
  trainerName?: string;
  /** Solo si falta la fila del entrenador; si existe, manda la suya. */
  timeZone?: string;
  /** Por orden: Lucas, Irene. Los que falten se siembran sin cuenta. */
  clientEmails: readonly string[];
  now: () => Date;
  newPassword: () => string;
  /** Se apunta cada contraseña en cuanto se crea su cuenta, para enseñarlas aunque algo falle luego. */
  credentials: SeedCredential[];
  log: (line: string) => void;
}

export interface TableCount {
  planned: number;
  existing: number;
  created: number;
}

export interface SeedResult {
  applied: boolean;
  trainerUserId: string;
  anchor: CivilDate;
  timeZone: TimeZone;
  /** Lo que impide `apply`. En dry-run se enseña y no detiene el informe. */
  blockers: string[];
  counts: Record<string, TableCount>;
  /** Lo que tras escribir no cuadra o no se puede leer. Vacío si todo va bien. */
  invalid: string[];
}

/** Tablas del entrenador que la siembra no escribe: cualquier fila suya es un dato propio. */
const OWNED_NOT_SEEDED = ["membership_rates", "trainer_payment_accounts"] as const;

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

function parseEmail(raw: string, label: string): string {
  const parsed = emailSchema.safeParse(normalizeEmail(raw));
  if (!parsed.success) throw new SeedAbort(`${label} «${raw}» no es un correo válido.`);
  return parsed.data;
}

export async function runSeed(
  backend: SupabaseSeedBackend,
  options: SeedRunOptions,
): Promise<SeedResult> {
  const { log } = options;
  const now = options.now();
  const blockers: string[] = [];

  /* ---------- Correos ---------- */

  const trainerEmail = parseEmail(options.trainerEmail, "--trainer-email");
  const clientEmails = options.clientEmails.map((email) => parseEmail(email, "--client-email"));
  if (clientEmails.length > MAX_CLIENT_EMAILS) {
    throw new SeedAbort(
      `La siembra tiene ${MAX_CLIENT_EMAILS} clientes (${CLIENT_KEYS.map((k) => CLIENT_SPECS[k].firstName).join(" y ")}) y se han dado ${clientEmails.length} correos.`,
    );
  }
  if (unique(clientEmails).length !== clientEmails.length) {
    throw new SeedAbort("Hay un --client-email repetido.");
  }
  if (clientEmails.includes(trainerEmail)) {
    throw new SeedAbort("Un --client-email es el mismo correo que el del entrenador.");
  }

  const trainerUserId = seedTrainerUserId(trainerEmail);
  const prefix = seedIdPrefix(trainerUserId);
  const plannedClientIds = Object.fromEntries(
    CLIENT_KEYS.map((key) => [key, clientIdFor(seedClientId(prefix, key))]),
  ) as Record<ClientKey, string>;
  const assignedEmails = Object.fromEntries(
    CLIENT_KEYS.map((key, i) => [
      key,
      clientEmails[i] ??
        placeholderEmail(CLIENT_SPECS[key].firstName, CLIENT_SPECS[key].lastName, trainerUserId),
    ]),
  ) as Record<ClientKey, string>;

  log(`Entrenador ${trainerEmail} (cuenta ${trainerUserId})`);
  CLIENT_KEYS.forEach((key, i) => {
    const spec = CLIENT_SPECS[key];
    log(
      clientEmails[i]
        ? `Cliente ${spec.firstName} ${spec.lastName}: ${assignedEmails[key]}, con cuenta.`
        : `Cliente ${spec.firstName} ${spec.lastName}: sin correo dado; ficha sin cuenta con ${assignedEmails[key]}.`,
    );
  });

  /* ---------- Cuentas de Auth ---------- */

  const users = await backend.listAuthUsers();
  const userById = new Map(users.map((user) => [user.id, user]));
  const userByEmail = new Map(
    users.filter((user) => user.email).map((user) => [normalizeEmail(user.email!), user]),
  );
  const plannedAccounts = [
    { label: "entrenador", email: trainerEmail, userId: trainerUserId },
    ...clientEmails.map((email, i) => ({
      label: CLIENT_SPECS[CLIENT_KEYS[i]!].firstName,
      email,
      userId: seedClientUserId(email),
    })),
  ];
  for (const account of plannedAccounts) {
    const owner = userByEmail.get(account.email);
    const atId = userById.get(account.userId);
    if (owner && owner.id !== account.userId) {
      blockers.push(
        `El correo ${account.email} ya es de una cuenta que no creó la siembra (${owner.id}): no se toca.`,
      );
    } else if (atId && normalizeEmail(atId.email ?? "") !== account.email) {
      blockers.push(`La cuenta ${account.userId} existe con otro correo: no se toca.`);
    } else if (atId) {
      log(
        `  Cuenta de ${account.label}: existe (correo confirmado: ${atId.emailConfirmed ? "sí" : "no"}). No se toca.`,
      );
    } else {
      log(`  Cuenta de ${account.label}: no existe. Por crear, con una contraseña temporal.`);
    }
  }

  /* ---------- Entrenador ---------- */

  const [trainerRow] = await backend.select("trainers", "id,name,email,time_zone", [
    { column: "id", op: "eq", value: trainerUserId },
  ]);
  let timeZone: TimeZone;
  let trainerName: string;
  if (trainerRow) {
    timeZone = timeZoneSchema.parse(trainerRow.time_zone);
    trainerName = String(trainerRow.name);
    log(`  Fila de trainers: existe (zona ${timeZone}). No se toca.`);
    if (options.timeZone && options.timeZone !== timeZone) {
      log(`  Aviso: --time-zone ${options.timeZone} se ignora; manda la zona que ya tiene.`);
    }
  } else {
    const requested = timeZoneSchema.safeParse(options.timeZone ?? DEFAULT_TIME_ZONE);
    if (!requested.success)
      throw new SeedAbort(`«${options.timeZone}» no es una zona horaria IANA.`);
    timeZone = requested.data;
    trainerName = options.trainerName?.trim() ?? "";
    log(`  Fila de trainers: falta. Por crear, con la zona ${timeZone}.`);
    if (!trainerName) {
      blockers.push(
        "Falta la fila del entrenador y no se ha dado --trainer-name: el nombre no se inventa.",
      );
      trainerName = "(falta --trainer-name)";
    }
  }

  const otherTrainers = (
    await backend.select("trainers", "id", [{ column: "email", op: "ilike", value: trainerEmail }])
  ).filter((row) => row.id !== trainerUserId);
  if (otherTrainers.length > 0) {
    blockers.push(`Ya hay otro entrenador con el correo ${trainerEmail}: no se toca.`);
  }
  const invitations = await backend.select("trainer_invitations", "email", [
    { column: "email", op: "eq", value: trainerEmail },
  ]);
  if (invitations.length > 0) {
    blockers.push(
      `Hay una invitación de entrenador para ${trainerEmail}: es una cuenta real, no de la siembra.`,
    );
  }

  /* ---------- Clientes ya sembrados y ancla de fechas ---------- */

  const seededClients = await backend.select("clients", "id,trainer_id,email,start_date", [
    { column: "id", op: "in", value: Object.values(plannedClientIds) },
  ]);
  const anchors = new Map<ClientKey, CivilDate>();
  for (const key of CLIENT_KEYS) {
    const row = seededClients.find((r) => r.id === plannedClientIds[key]);
    if (!row) continue;
    if (row.trainer_id !== trainerUserId) {
      blockers.push(`El cliente ${plannedClientIds[key]} de la siembra es de otro entrenador.`);
      continue;
    }
    if (normalizeEmail(String(row.email)) !== assignedEmails[key]) {
      blockers.push(
        `La ficha de ${CLIENT_SPECS[key].firstName} ya está sembrada con el correo ${String(row.email)}, y ahora se pide ${assignedEmails[key]}: la siembra no cambia correos.`,
      );
    }
    const startDate = civilDateSchema.safeParse(row.start_date);
    if (!startDate.success)
      throw new SeedAbort(`El cliente ${String(row.id)} tiene una fecha de alta ilegible.`);
    anchors.set(key, anchorFromStartDate(key, startDate.data));
  }
  const distinct = unique([...anchors.values()]);
  if (distinct.length > 1) {
    throw new SeedAbort(
      "Los clientes ya sembrados no dan la misma ancla: alguien cambió una fecha de alta. No se puede completar la siembra sin duplicar.",
    );
  }
  const today = civilDateInTimeZone(now.toISOString(), timeZone);
  const anchor = distinct[0] ?? today;
  log(
    distinct[0]
      ? `Ancla de fechas: ${anchor} (deducida de los clientes ya sembrados; hoy es ${today}).`
      : `Ancla de fechas: ${anchor} (hoy en ${timeZone}).`,
  );

  for (const key of CLIENT_KEYS) {
    const others = (
      await backend.select("clients", "id", [
        { column: "email", op: "ilike", value: assignedEmails[key] },
      ])
    ).filter((row) => row.id !== plannedClientIds[key]);
    if (others.length > 0) {
      blockers.push(
        `El correo ${assignedEmails[key]} ya es de un cliente que no es de la siembra.`,
      );
    }
  }

  /* ---------- Plan y lo que ya existe ---------- */

  const plan: SupabaseSeedPlan = buildSupabaseSeedPlan({
    trainerEmail,
    trainerName,
    timeZone,
    clientEmails,
    anchor,
    now: now.toISOString(),
  });

  const counts: Record<string, TableCount> = {};
  const existingKeys = new Map<string, Set<string>>();
  const foreign: string[] = [];
  for (const set of plan.tables) {
    let existing: SeedRow[];
    if (set.parentColumn) {
      const parents = unique(set.rows.map((row) => String(row[set.parentColumn!])));
      existing = await backend.select(set.table, set.onConflict, [
        { column: set.parentColumn, op: "in", value: parents },
      ]);
    } else {
      const keyColumn = set.onConflict;
      const owner = set.ownerColumn!;
      const planned = set.rows.map((row) => String(row[keyColumn]));
      const found = await backend.select(set.table, unique([keyColumn, owner]).join(","), [
        { column: keyColumn, op: "in", value: planned },
      ]);
      const conflicts = found.filter((row) => row[owner] !== trainerUserId);
      if (conflicts.length > 0) {
        blockers.push(
          `${set.table}: ${conflicts.length} filas de la siembra son de otro entrenador.`,
        );
      }
      existing = found.filter((row) => row[owner] === trainerUserId);
      const plannedSet = new Set(planned);
      const own = await backend.select(set.table, keyColumn, [
        { column: owner, op: "eq", value: trainerUserId },
      ]);
      const notSeeded = own.filter((row) => !plannedSet.has(String(row[keyColumn]))).length;
      if (notSeeded > 0) foreign.push(`${set.table} ${notSeeded}`);
    }
    const keys = new Set(existing.map((row) => rowKey(set, row)));
    existingKeys.set(set.table, keys);
    counts[set.table] = { planned: set.rows.length, existing: keys.size, created: 0 };
  }
  for (const table of OWNED_NOT_SEEDED) {
    const own = await backend.select(table, "trainer_id", [
      { column: "trainer_id", op: "eq", value: trainerUserId },
    ]);
    if (own.length > 0) foreign.push(`${table} ${own.length}`);
  }
  if (foreign.length > 0) {
    log(`Datos propios que no son de la siembra: ${foreign.join(", ")}.`);
    blockers.push(
      `El entrenador ya tiene datos propios que no son de la siembra (${foreign.join(", ")}).`,
    );
  } else {
    log("Datos propios que no son de la siembra: ninguno.");
  }

  log("");
  log("Tabla                       en el plan   ya existen   por crear");
  for (const [table, count] of Object.entries(counts)) {
    log(
      `${table.padEnd(28)}${String(count.planned).padStart(10)}${String(count.existing).padStart(13)}${String(count.planned - count.existing).padStart(12)}`,
    );
  }
  log("");

  const result: SeedResult = {
    applied: false,
    trainerUserId,
    anchor,
    timeZone,
    blockers,
    counts,
    invalid: [],
  };

  if (blockers.length > 0) {
    log(
      options.apply
        ? "No se escribe nada. Impide la siembra:"
        : "Con --apply no se escribiría nada. Lo impide:",
    );
    for (const blocker of blockers) log(`  - ${blocker}`);
    return result;
  }
  if (!options.apply) {
    log("Dry-run: no se ha escrito nada. Con --apply se crea lo que falta.");
    return result;
  }

  /* ---------- Escritura: solo lo que falta ---------- */

  for (const account of plan.accounts) {
    if (userById.has(account.userId)) continue;
    const password = options.newPassword();
    await backend.createAuthUser({ id: account.userId, email: account.email, password });
    options.credentials.push({ email: account.email, password });
    log(`Cuenta creada: ${account.email}.`);
  }

  for (const set of plan.tables) {
    const keys = existingKeys.get(set.table)!;
    const missing = set.rows.filter((row) => !keys.has(rowKey(set, row)));
    if (missing.length === 0) continue;
    const created = await backend.insert(set.table, set.onConflict, missing);
    counts[set.table]!.created = created;
    if (created !== missing.length) {
      result.invalid.push(
        `${set.table}: faltaban ${missing.length} filas y se crearon ${created}; alguien escribió a la vez.`,
      );
    }
    log(`${set.table}: ${created} creadas.`);
  }
  result.applied = true;

  /* ---------- Relectura ---------- */

  const back = await backend.readBack(trainerUserId);
  result.invalid.push(...back.invalid);
  for (const [table, count] of Object.entries(counts)) {
    const read = back.counts[table];
    if (read !== undefined && read !== count.planned) {
      result.invalid.push(`${table}: se releen ${read} filas y el plan tiene ${count.planned}.`);
    }
  }
  log(
    result.invalid.length === 0
      ? "Releído como lo lee la app: todo cuadra y pasa su esquema."
      : `Releído; NO cuadra: ${result.invalid.join(" ")}`,
  );
  return result;
}
