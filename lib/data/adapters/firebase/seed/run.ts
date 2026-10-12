import {
  civilDateInTimeZone,
  civilDateSchema,
  timeZoneSchema,
  trainerSchema,
  type CivilDate,
  type TimeZone,
} from "@/lib/domain";
import { COLLECTIONS } from "../helpers";
import { isSeedId } from "./ids";
import {
  CLIENT_KEYS,
  CLIENT_SPECS,
  DEFAULT_TIME_ZONE,
  TRAINER_EMAIL,
  anchorFromStartDate,
  buildTrainer,
  clientUserLink,
  trainerUserLink,
  type ClientKey,
  type UserLink,
} from "./people";
import { SEED_COLLECTIONS, buildSeedPlan, type SeedDoc, type SeedPlan } from "./plan";
import { SeedAbort } from "./target";

/** `users/{uid}`: fuera de `COLLECTIONS` porque no es un agregado del dominio (§12). */
const USERS = "users";

/** Mientras la cuenta del entrenador no existe, nada puede ser suyo todavía. */
const PENDING_TRAINER_ID = "(uid de la cuenta nueva)";

/** Escrituras simultáneas dentro de una colección. */
const WRITE_BATCH = 20;

export interface SeedAccount {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export interface DocPath {
  collection: string;
  id: string;
}

/**
 * Lo que la siembra necesita de Firebase. `admin.ts` lo implementa con el SDK de administración;
 * los tests, en memoria. Solo lee y crea: no hay forma de sobrescribir ni de borrar.
 */
export interface SeedBackend {
  findAccount(email: string): Promise<SeedAccount | null>;
  /** Cuenta nueva con el correo ya verificado. */
  createAccount(email: string, password: string): Promise<SeedAccount>;
  /** Los documentos pedidos, en el mismo orden; `null` el que no existe. */
  readDocs(paths: readonly DocPath[]): Promise<(Record<string, unknown> | null)[]>;
  /** `create()`: `false` si el documento ya existía, que no se toca. */
  createDoc(path: DocPath, data: Record<string, unknown>): Promise<boolean>;
  listIdsByTrainer(collection: string, trainerId: string): Promise<string[]>;
  findTrainerIdsByEmail(email: string): Promise<string[]>;
}

/** Contraseña temporal de una cuenta creada en esta ejecución. */
export interface SeedCredential {
  email: string;
  password: string;
}

export interface SeedRunOptions {
  /** `false`: solo lee y cuenta. `true`: además crea lo que falta. */
  apply: boolean;
  /** Nombre del entrenador, solo si falta `trainers/{id}`. */
  trainerName?: string;
  /** Zona del entrenador, solo si falta `trainers/{id}`. */
  timeZone?: string;
  now: () => Date;
  newPassword: () => string;
  /**
   * Aquí se apunta la contraseña de cada cuenta en cuanto se crea, para que quien llama pueda
   * enseñarlas aunque la siembra falle después: una cuenta creada no se puede volver a crear.
   */
  credentials: SeedCredential[];
  log: (line: string) => void;
}

export interface CollectionCount {
  planned: number;
  existing: number;
  created: number;
}

export interface SeedResult {
  applied: boolean;
  trainerId: string | null;
  anchor: CivilDate;
  timeZone: TimeZone;
  /** Lo que impide `--apply`. En dry-run se enseña y no detiene el informe. */
  blockers: string[];
  counts: Record<string, CollectionCount>;
  /** Documentos releídos tras escribir que no pasan su esquema. Vacío si todo va bien. */
  invalid: string[];
}

const pathOf = ({ collection, id }: DocPath) => `${collection}/${id}`;

/**
 * En qué se aparta un `users/{uid}` de la forma esperada. Se cuentan las claves que faltan, las que
 * sobran (sin su valor) y las que valen otra cosa. Solo informa: un `users/{uid}` no se modifica.
 */
export function userLinkDifferences(actual: Record<string, unknown>, expected: UserLink): string[] {
  const differences: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    if (!(key in actual)) differences.push(`falta «${key}»`);
    else if (actual[key] !== value) {
      differences.push(
        `«${key}» es ${JSON.stringify(actual[key])} y se esperaba ${JSON.stringify(value)}`,
      );
    }
  }
  for (const key of Object.keys(actual)) {
    if (!(key in expected)) differences.push(`sobra «${key}»`);
  }
  return differences;
}

async function inBatches<T>(items: readonly T[], run: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += WRITE_BATCH) {
    const settled = await Promise.allSettled(items.slice(i, i + WRITE_BATCH).map(run));
    const failed = settled.find((s) => s.status === "rejected");
    if (failed) throw failed.reason;
  }
}

/**
 * La siembra, de principio a fin. Primero lo mira todo —cuentas, documentos, de quién es cada
 * cosa— y decide; solo con `apply` y sin bloqueos escribe, y solo con `create()`: lo que existe se
 * cuenta y se salta. Si falla a medias, volver a ejecutarla completa lo que falte.
 */
export async function runSeed(backend: SeedBackend, options: SeedRunOptions): Promise<SeedResult> {
  const { log } = options;
  const now = options.now();
  const blockers: string[] = [];

  /* ---------- Entrenador ---------- */

  log(`Entrenador ${TRAINER_EMAIL}`);
  let trainerAccount = await backend.findAccount(TRAINER_EMAIL);
  log(
    trainerAccount
      ? `  Cuenta de Auth: existe (uid ${trainerAccount.uid}, correo verificado: ${trainerAccount.emailVerified ? "sí" : "no"}). No se toca.`
      : "  Cuenta de Auth: no existe. Por crear, con una contraseña temporal.",
  );

  const [trainerLink] = trainerAccount
    ? await backend.readDocs([{ collection: USERS, id: trainerAccount.uid }])
    : [null];
  let trainerId: string | null = null;
  if (trainerLink) {
    if (trainerLink.role !== "trainer" || typeof trainerLink.trainerId !== "string") {
      throw new SeedAbort(
        `users/${trainerAccount!.uid} existe pero no es de un entrenador (role ${JSON.stringify(trainerLink.role)}).`,
      );
    }
    trainerId = trainerLink.trainerId;
    const differences = userLinkDifferences(trainerLink, trainerUserLink(trainerId, TRAINER_EMAIL));
    log(
      differences.length === 0
        ? "  users/{uid}: existe, con la forma esperada { role, trainerId, clientId: null, email }."
        : `  users/{uid}: existe, con diferencias que no se modifican: ${differences.join("; ")}.`,
    );
  } else {
    const sameEmail = await backend.findTrainerIdsByEmail(TRAINER_EMAIL);
    if (sameEmail.length > 1) {
      throw new SeedAbort(
        `Hay ${sameEmail.length} documentos en trainers con el correo ${TRAINER_EMAIL}: ${sameEmail.join(", ")}. No se elige uno.`,
      );
    }
    trainerId = sameEmail[0] ?? trainerAccount?.uid ?? null;
    log(
      sameEmail[0]
        ? `  users/{uid}: falta. Por crear, apuntando al entrenador ${sameEmail[0]}, que ya existe con ese correo.`
        : "  users/{uid}: falta. Por crear; el id del entrenador será el uid de su cuenta.",
    );
  }

  const [trainerDoc] = trainerId
    ? await backend.readDocs([{ collection: COLLECTIONS.trainers, id: trainerId }])
    : [null];
  let timeZone: TimeZone;
  if (trainerDoc) {
    const parsed = trainerSchema.safeParse({ ...trainerDoc, id: trainerId });
    if (!parsed.success) {
      throw new SeedAbort(
        `trainers/${trainerId} existe pero no pasa el esquema del dominio (${parsed.error.issues
          .map((issue) => issue.path.join("."))
          .join(", ")}). La app tampoco podría leerlo.`,
      );
    }
    timeZone = parsed.data.timeZone;
    log(`  trainers/${trainerId}: existe (zona ${timeZone}). No se toca.`);
    if (options.timeZone && options.timeZone !== timeZone) {
      log(`  Aviso: --time-zone ${options.timeZone} se ignora; manda la zona que ya tiene.`);
    }
    if (parsed.data.email !== TRAINER_EMAIL) {
      log(`  Aviso: su correo en trainers/${trainerId} no es ${TRAINER_EMAIL}.`);
    }
  } else {
    const requested = timeZoneSchema.safeParse(options.timeZone ?? DEFAULT_TIME_ZONE);
    if (!requested.success) {
      throw new SeedAbort(`«${options.timeZone}» no es una zona horaria IANA.`);
    }
    timeZone = requested.data;
    log(`  trainers/{id}: falta. Por crear, con la zona ${timeZone}.`);
    if (!options.trainerName?.trim()) {
      blockers.push("Falta trainers/{id} y no se ha dado --trainer-name: el nombre no se inventa.");
    }
  }

  /* ---------- Documentos propios que no son de la siembra ---------- */

  if (trainerId) {
    const foreign: string[] = [];
    for (const collection of SEED_COLLECTIONS) {
      const ids = await backend.listIdsByTrainer(collection, trainerId);
      const own = ids.filter((id) => !isSeedId(id)).length;
      if (own > 0) foreign.push(`${collection} ${own}`);
    }
    if (foreign.length > 0) {
      log(`Documentos propios que no son de la siembra: ${foreign.join(", ")}.`);
      blockers.push(
        `El entrenador ya tiene documentos propios que no son de la siembra (${foreign.join(", ")}).`,
      );
    } else {
      log("Documentos propios que no son de la siembra: ninguno.");
    }
  }

  /* ---------- Ancla de fechas ---------- */

  const today = civilDateInTimeZone(now, timeZone);
  const clientIds = CLIENT_KEYS.map((key) => ({
    collection: COLLECTIONS.clients,
    id: CLIENT_SPECS[key].id,
  }));
  const seededClients = await backend.readDocs(clientIds);
  const anchors = new Map<ClientKey, CivilDate>();
  seededClients.forEach((data, i) => {
    const key = CLIENT_KEYS[i]!;
    // Un cliente de otro entrenador con ese id es un conflicto, y sale más abajo como tal.
    if (!data || data.trainerId !== trainerId) return;
    const startDate = civilDateSchema.safeParse(data.startDate);
    if (!startDate.success) {
      throw new SeedAbort(`clients/${CLIENT_SPECS[key].id} existe con una fecha de alta ilegible.`);
    }
    anchors.set(key, anchorFromStartDate(key, startDate.data));
  });
  const distinct = [...new Set(anchors.values())];
  if (distinct.length > 1) {
    throw new SeedAbort(
      `Los clientes ya sembrados no dan la misma ancla (${[...anchors].map(([k, a]) => `${k}: ${a}`).join(", ")}): ` +
        "alguien cambió una fecha de alta. No se puede completar la siembra sin duplicar.",
    );
  }
  const anchor = distinct[0] ?? today;
  if (anchor > today) {
    throw new SeedAbort(`El ancla ${anchor} es posterior a hoy (${today}) en ${timeZone}.`);
  }
  log(`Zona horaria: ${timeZone}`);
  log(
    distinct[0]
      ? `Ancla de fechas: ${anchor} (deducida de los clientes ya sembrados; hoy es ${today}).`
      : `Ancla de fechas: ${anchor} (hoy en ${timeZone}).`,
  );

  /* ---------- Plan y lo que ya existe ---------- */

  const planFor = (id: string): SeedPlan =>
    buildSeedPlan({ trainerId: id, anchor, clock: { timeZone, now: now.toISOString() } });
  let plan = planFor(trainerId ?? PENDING_TRAINER_ID);

  const counts: Record<string, CollectionCount> = {};
  for (const collection of SEED_COLLECTIONS) {
    counts[collection] = { planned: 0, existing: 0, created: 0 };
  }
  const present = await backend.readDocs(plan.docs);
  const missing = new Set<string>();
  const conflicts: string[] = [];
  plan.docs.forEach((doc, i) => {
    const count = counts[doc.collection]!;
    count.planned++;
    const data = present[i];
    if (!data) missing.add(pathOf(doc));
    // Los ids son globales entre entrenadores: uno ocupado por otro no es «ya existe».
    else if (data.trainerId !== trainerId) conflicts.push(pathOf(doc));
    else count.existing++;
  });
  if (conflicts.length > 0) {
    blockers.push(
      `${conflicts.length} documentos con id de siembra son de otro entrenador: ${conflicts.slice(0, 5).join(", ")}${conflicts.length > 5 ? "…" : ""}.`,
    );
  }

  /* ---------- Clientes: cuenta y users/{uid} ---------- */

  log("Clientes");
  const clientAccounts = new Map<ClientKey, { account: SeedAccount | null; linked: boolean }>();
  for (const key of CLIENT_KEYS) {
    const client = plan.clients[key];
    const account = await backend.findAccount(client.email);
    const [link] = account
      ? await backend.readDocs([{ collection: USERS, id: account.uid }])
      : [null];
    const name = `${client.firstName} ${client.lastName} <${client.email}>`;
    if (!account) {
      log(`  ${name}: sin cuenta. Por crear, con correo verificado y contraseña temporal.`);
    } else if (!link) {
      log(`  ${name}: la cuenta existe (no se toca); falta su users/{uid}, por crear.`);
    } else {
      const expected = clientUserLink(client);
      const same =
        link.role === expected.role &&
        link.trainerId === expected.trainerId &&
        link.clientId === expected.clientId;
      const differences = userLinkDifferences(link, expected);
      if (!same) {
        blockers.push(
          `La cuenta de ${client.email} ya está enlazada a otra persona (users/${account.uid}).`,
        );
        log(`  ${name}: la cuenta existe y su users/{uid} apunta a otra persona.`);
      } else {
        log(
          differences.length === 0
            ? `  ${name}: la cuenta y su users/{uid} existen. No se tocan.`
            : `  ${name}: la cuenta y su users/{uid} existen, con diferencias que no se modifican: ${differences.join("; ")}.`,
        );
      }
    }
    clientAccounts.set(key, { account, linked: Boolean(link) });
  }

  /* ---------- Informe ---------- */

  log("Documentos            plan  existen  faltan");
  let planned = 0;
  let existing = 0;
  for (const collection of SEED_COLLECTIONS) {
    const count = counts[collection]!;
    planned += count.planned;
    existing += count.existing;
    log(
      `  ${collection.padEnd(18)} ${String(count.planned).padStart(5)} ${String(count.existing).padStart(8)} ${String(count.planned - count.existing).padStart(7)}`,
    );
  }
  log(
    `  ${"total".padEnd(18)} ${String(planned).padStart(5)} ${String(existing).padStart(8)} ${String(planned - existing).padStart(7)}`,
  );
  const accountsToCreate =
    (trainerAccount ? 0 : 1) + [...clientAccounts.values()].filter((c) => !c.account).length;
  const linksToCreate =
    (trainerLink ? 0 : 1) + [...clientAccounts.values()].filter((c) => !c.linked).length;
  log(
    `Además, por crear: ${trainerDoc ? 0 : 1} en trainers, ${linksToCreate} en users y ${accountsToCreate} cuentas de Auth.`,
  );

  const result: SeedResult = {
    applied: false,
    trainerId,
    anchor,
    timeZone,
    blockers,
    counts,
    invalid: [],
  };

  if (!options.apply) {
    if (accountsToCreate > 0) {
      log(`Con --apply se generarían ${accountsToCreate} contraseñas temporales.`);
    }
    log(
      blockers.length === 0
        ? "Bloqueos para --apply: ninguno."
        : `Bloqueos para --apply:\n${blockers.map((b) => `  - ${b}`).join("\n")}`,
    );
    log("Dry-run: no se ha escrito nada.");
    return result;
  }
  if (blockers.length > 0) {
    throw new SeedAbort(
      `No se escribe nada. Bloqueos:\n${blockers.map((b) => `  - ${b}`).join("\n")}`,
    );
  }

  /* ---------- Escritura ---------- */

  const createAccount = async (email: string): Promise<SeedAccount> => {
    const password = options.newPassword();
    const account = await backend.createAccount(email, password);
    options.credentials.push({ email, password });
    return account;
  };
  let extras = 0;
  const createExtra = async (path: DocPath, data: Record<string, unknown>) => {
    if (await backend.createDoc(path, data)) extras++;
  };

  try {
    // La cuenta del entrenador va primero solo si de ella sale su id; su `users/{uid}`, lo último:
    // hasta entonces no puede entrar a ver una siembra a medias.
    if (!trainerAccount) trainerAccount = await createAccount(TRAINER_EMAIL);
    if (!trainerId) {
      trainerId = trainerAccount.uid;
      plan = planFor(trainerId);
    }
    result.trainerId = trainerId;
    if (!trainerDoc) {
      const trainer = buildTrainer({
        id: trainerId,
        name: options.trainerName!.trim(),
        email: TRAINER_EMAIL,
        timeZone,
        now: now.toISOString(),
      });
      await createExtra({ collection: COLLECTIONS.trainers, id: trainerId }, trainer);
    }

    for (const collection of SEED_COLLECTIONS) {
      const pending = plan.docs.filter(
        (doc) => doc.collection === collection && missing.has(pathOf(doc)),
      );
      await inBatches(pending, async (doc) => {
        // El SDK de administración salta las reglas: lo único que valida es el esquema del dominio.
        doc.schema.parse(doc.data);
        const count = counts[collection]!;
        if (await backend.createDoc(doc, doc.data)) count.created++;
        else count.existing++;
      });
    }

    for (const key of CLIENT_KEYS) {
      const client = plan.clients[key];
      const state = clientAccounts.get(key)!;
      const account = state.account ?? (await createAccount(client.email));
      if (!state.linked) {
        await createExtra({ collection: USERS, id: account.uid }, { ...clientUserLink(client) });
      }
    }
    if (!trainerLink) {
      await createExtra(
        { collection: USERS, id: trainerAccount.uid },
        { ...trainerUserLink(trainerId, TRAINER_EMAIL) },
      );
    }
  } catch (error) {
    const done = SEED_COLLECTIONS.map((c) => `${c} ${counts[c]!.created}`).join(", ");
    log(
      `Interrumpido. Creado hasta aquí: ${done}; otros ${extras}; cuentas ${options.credentials.length}.`,
    );
    log("Vuelve a ejecutar con --apply para completar lo que falta: lo ya creado se salta.");
    throw error;
  }

  const created = SEED_COLLECTIONS.reduce((sum, c) => sum + counts[c]!.created, 0);
  log(
    created + extras + options.credentials.length === 0
      ? "Creado: nada. Todo existía ya."
      : `Creado: ${created} documentos de la siembra, ${extras} en trainers y users, ${options.credentials.length} cuentas de Auth.`,
  );
  for (const collection of SEED_COLLECTIONS) {
    const count = counts[collection]!;
    if (count.created > 0) log(`  ${collection}: ${count.created}`);
  }

  /* ---------- Relectura ---------- */

  result.applied = true;
  result.invalid = await verify(backend, plan, trainerId);
  log(
    result.invalid.length === 0
      ? `Releídos ${plan.docs.length + 1} documentos: todos pasan su esquema.`
      : `Releídos ${plan.docs.length + 1} documentos; NO pasan su esquema: ${result.invalid.join(", ")}.`,
  );
  return result;
}

/**
 * Relee lo sembrado y lo vuelve a parsear con el esquema del dominio, como hará la app al leerlo.
 * Vale también para lo que ya existía: si alguien lo dejó ilegible, mejor saberlo aquí.
 */
async function verify(backend: SeedBackend, plan: SeedPlan, trainerId: string): Promise<string[]> {
  const invalid: string[] = [];
  const stored = await backend.readDocs(plan.docs);
  plan.docs.forEach((doc: SeedDoc, i) => {
    const data = stored[i];
    if (!data || !doc.schema.safeParse({ ...data, id: doc.id }).success) invalid.push(pathOf(doc));
  });
  const [trainer] = await backend.readDocs([{ collection: COLLECTIONS.trainers, id: trainerId }]);
  if (!trainer || !trainerSchema.safeParse({ ...trainer, id: trainerId }).success) {
    invalid.push(`${COLLECTIONS.trainers}/${trainerId}`);
  }
  return invalid;
}
