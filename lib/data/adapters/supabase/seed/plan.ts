import { CLIENT_KEYS, buildTrainer, type ClientKey } from "@/lib/data/seed/people";
import { buildSeedPlan, type SeedPlan } from "@/lib/data/seed/plan";
import type { SeedClock } from "@/lib/data/seed/time";
import type { CivilDate, TimeZone, Trainer } from "@/lib/domain";
import { findPlanViolations, planRowSets } from "../migration/load-catalog-plans";
import { findLogViolations, logRowSets } from "../migration/load-logs";
import { planPeople } from "../migration/people";
import { remapPeople } from "../migration/remap";
import {
  SUPABASE_SEED_IDS,
  normalizeEmail,
  seedClientKey,
  seedClientUserId,
  seedIdPrefix,
  seedTrainerKey,
  seedTrainerUserId,
} from "./ids";

/**
 * La siembra de la demo en filas de Supabase (tarjeta 135). Los datos salen de `lib/data/seed/`,
 * igual que en Firebase; las filas, de las mismas funciones que la carga de la migración
 * (`remapPeople`, `planPeople`, `planRowSets`, `logRowSets`). Es puro: no habla con la red.
 */

export type SeedRow = Record<string, unknown>;

/** Las filas de una tabla, con su clave y con cómo se reconoce qué es del entrenador. */
export interface TableSet {
  table: string;
  /** Columnas de la clave, como las pide `on_conflict`. */
  onConflict: string;
  rows: SeedRow[];
  /**
   * Tablas hijas (días, líneas, comidas, medidas…): se buscan por su padre, no por el entrenador. Sus
   * ids cuelgan del uuid del padre, así que no pueden ser de nadie más.
   */
  parentColumn?: string;
  /** La columna que dice de qué entrenador es la fila. `trainers` lo dice con su propio id. */
  ownerColumn?: string;
}

export interface SeedAccountPlan {
  role: "trainer" | "client";
  userId: string;
  email: string;
  clientKey?: ClientKey;
}

export interface SupabaseSeedInput {
  trainerEmail: string;
  trainerName: string;
  timeZone: TimeZone;
  /** Uno por cliente sembrado y por orden: el primero es de Lucas, el segundo de Irene. */
  clientEmails: readonly string[];
  anchor: CivilDate;
  now: SeedClock["now"];
}

export interface SupabaseSeedPlan {
  trainerUserId: string;
  trainer: Trainer;
  seed: SeedPlan;
  /** El entrenador y cada cliente, por ese orden. */
  accounts: SeedAccountPlan[];
  clientEmails: Record<ClientKey, string>;
  /** En el orden en que se escriben: lo referenciado antes que lo que lo referencia. */
  tables: TableSet[];
}

const CHILD_PARENT: Record<string, string> = {
  routine_days: "routine_id",
  routine_day_exercises: "routine_id",
  meals: "menu_id",
  menu_items: "menu_id",
  review_measurements: "review_id",
  questionnaire_responses: "review_id",
};

/**
 * Cada cliente sembrado es `activo`, y un `activo` siempre tiene cuenta: aceptó su invitación (§7).
 * Por eso hace falta exactamente un correo por cliente.
 */
export const CLIENT_EMAIL_COUNT = CLIENT_KEYS.length;

/** La clave de una fila según `onConflict`: `id`, o `routine_id/id` en las hijas. */
export const rowKey = (set: Pick<TableSet, "onConflict">, row: SeedRow): string =>
  set.onConflict
    .split(",")
    .map((column) => String(row[column]))
    .join("/");

/**
 * El correo de cada cliente, por orden. Quien llama comprueba antes cuántos hay, que son válidos y que
 * no se repiten; aquí solo se vuelve a exigir que haya uno por cliente.
 */
export function assignClientEmails(clientEmails: readonly string[]): Record<ClientKey, string> {
  if (clientEmails.length !== CLIENT_EMAIL_COUNT) {
    throw new Error(`Hace falta un correo por cliente: ${CLIENT_EMAIL_COUNT}.`);
  }
  return Object.fromEntries(
    CLIENT_KEYS.map((key, i) => [key, normalizeEmail(clientEmails[i]!)]),
  ) as Record<ClientKey, string>;
}

export function buildSupabaseSeedPlan(input: SupabaseSeedInput): SupabaseSeedPlan {
  const trainerEmail = normalizeEmail(input.trainerEmail);
  const trainerKey = seedTrainerKey(trainerEmail);
  const trainerUserId = seedTrainerUserId(trainerEmail);
  const clientEmails = assignClientEmails(input.clientEmails);

  const seed = buildSeedPlan({
    trainerId: trainerKey,
    idPrefix: seedIdPrefix(trainerUserId),
    ids: SUPABASE_SEED_IDS,
    clientEmails,
    anchor: input.anchor,
    clock: { timeZone: input.timeZone, now: input.now },
  });
  const trainer = buildTrainer({
    id: trainerKey,
    name: input.trainerName,
    email: trainerEmail,
    timeZone: input.timeZone,
    now: input.now,
  });

  // Entrenador, clientes y perfiles: lo mismo que hace la carga con una exportación de Firebase. Las
  // «cuentas» llevan la clave de origen como uid, y `remapPeople` las convierte en sus uuid.
  const people = planPeople(
    remapPeople({
      trainers: [{ id: trainerKey, data: trainer }],
      clients: Object.values(seed.clients).map((client) => ({ id: client.id, data: client })),
      accounts: [
        { uid: trainerKey, email: trainerEmail },
        ...CLIENT_KEYS.map((key) => ({
          uid: seedClientKey(clientEmails[key]),
          email: clientEmails[key],
        })),
      ],
    }),
  );
  if (people.unlinkedAccountUids.length > 0) {
    throw new Error("Una cuenta de cliente de la siembra no quedó enlazada a su ficha.");
  }

  const planData = {
    exercises: seed.exercises,
    foods: seed.foods,
    measurementTypes: seed.measurementTypes,
    questions: seed.questions,
    routineTemplates: seed.routineTemplates,
    menuTemplates: [seed.menuTemplate],
    routines: Object.values(seed.routines),
    menus: seed.menus,
    macroTargets: seed.macroTargets,
    memberships: seed.memberships,
  };
  const logData = {
    weightLogs: seed.weightLogs,
    reviews: seed.reviews,
    workoutLogs: seed.workoutLogs,
  };
  const problems = [...findPlanViolations(planData), ...findLogViolations(logData)];
  if (problems.length > 0) {
    throw new Error(`La siembra no cumple los invariantes: ${problems.join("; ")}.`);
  }

  const sets: TableSet[] = [
    {
      table: "trainers",
      onConflict: "id",
      rows: people.trainers as unknown as SeedRow[],
      ownerColumn: "id",
    },
    { table: "clients", onConflict: "id", rows: people.clients as unknown as SeedRow[] },
    { table: "profiles", onConflict: "user_id", rows: people.profiles as unknown as SeedRow[] },
    ...[...planRowSets(planData), ...logRowSets(logData)].map((set) => ({
      table: set.table,
      onConflict: set.onConflict,
      rows: set.rows as SeedRow[],
      parentColumn: CHILD_PARENT[set.table],
    })),
  ];
  const tables = sets.map((set) =>
    set.parentColumn || set.ownerColumn ? set : { ...set, ownerColumn: "trainer_id" },
  );

  return {
    trainerUserId,
    trainer,
    seed,
    accounts: [
      { role: "trainer", userId: trainerUserId, email: trainerEmail },
      ...CLIENT_KEYS.map((key) => ({
        role: "client" as const,
        userId: seedClientUserId(clientEmails[key]),
        email: clientEmails[key],
        clientKey: key,
      })),
    ],
    clientEmails,
    tables,
  };
}
