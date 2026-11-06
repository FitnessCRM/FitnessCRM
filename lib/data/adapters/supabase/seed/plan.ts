import { CLIENT_KEYS, CLIENT_SPECS, buildTrainer, type ClientKey } from "@/lib/data/seed/people";
import { buildSeedPlan, type SeedPlan } from "@/lib/data/seed/plan";
import type { SeedClock } from "@/lib/data/seed/time";
import type { CivilDate, TimeZone, Trainer } from "@/lib/domain";
import { entityIdFor } from "../migration/ids";
import { findPlanViolations, planRowSets } from "../migration/load-catalog-plans";
import { findLogViolations, logRowSets } from "../migration/load-logs";
import { planPeople } from "../migration/people";
import { remapPeople } from "../migration/remap";
import {
  SUPABASE_SEED_IDS,
  normalizeEmail,
  placeholderEmail,
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
  /** Por orden: el primero es de Lucas, el segundo de Irene. */
  clientEmails: readonly string[];
  anchor: CivilDate;
  now: SeedClock["now"];
}

export interface SupabaseSeedPlan {
  trainerUserId: string;
  trainer: Trainer;
  seed: SeedPlan;
  /** El entrenador y los clientes con correo, por ese orden. */
  accounts: SeedAccountPlan[];
  clientEmails: Record<ClientKey, string>;
  /** Clientes sin correo: ficha `activo` sin cuenta ni perfil. */
  clientsWithoutAccount: ClientKey[];
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

export const MAX_CLIENT_EMAILS = CLIENT_KEYS.length;

/** La clave de una fila según `onConflict`: `id`, o `routine_id/id` en las hijas. */
export const rowKey = (set: Pick<TableSet, "onConflict">, row: SeedRow): string =>
  set.onConflict
    .split(",")
    .map((column) => String(row[column]))
    .join("/");

/**
 * El correo de cada cliente: los dados, por orden, y para los que falten uno que no entrega
 * (`placeholderEmail`). Quien llama comprueba antes cuántos hay y que no se repiten.
 */
export function assignClientEmails(
  clientEmails: readonly string[],
  trainerUserId: string,
): Record<ClientKey, string> {
  return Object.fromEntries(
    CLIENT_KEYS.map((key, i) => {
      const given = clientEmails[i];
      const spec = CLIENT_SPECS[key];
      return [
        key,
        given
          ? normalizeEmail(given)
          : placeholderEmail(spec.firstName, spec.lastName, trainerUserId),
      ];
    }),
  ) as Record<ClientKey, string>;
}

export function buildSupabaseSeedPlan(input: SupabaseSeedInput): SupabaseSeedPlan {
  const trainerEmail = normalizeEmail(input.trainerEmail);
  const trainerKey = seedTrainerKey(trainerEmail);
  const trainerUserId = seedTrainerUserId(trainerEmail);
  const clientEmails = assignClientEmails(input.clientEmails, trainerUserId);
  const withAccount = CLIENT_KEYS.filter((_, i) => Boolean(input.clientEmails[i]));

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
        ...withAccount.map((key) => ({
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

  // Las rutinas y los menús clonados guardan de qué plantilla vienen (E8, §4). `to-rows` de la
  // migración todavía no escribe esa columna, así que la siembra la añade: sin ella, la plantilla no
  // contaría a los clientes que la usan.
  const routineTemplateOf = new Map(
    planData.routines.map((r) => [
      entityIdFor("routine", r.id),
      r.sourceTemplateId ? entityIdFor("routine-template", r.sourceTemplateId) : null,
    ]),
  );
  const menuTemplateOf = new Map(
    planData.menus.map((m) => [
      entityIdFor("menu", m.id),
      m.sourceTemplateId ? entityIdFor("menu-template", m.sourceTemplateId) : null,
    ]),
  );
  const withSourceTemplate = (set: { table: string; rows: object[] }): SeedRow[] => {
    const of =
      set.table === "routines" ? routineTemplateOf : set.table === "menus" ? menuTemplateOf : null;
    return set.rows.map((row) => {
      const plain = row as SeedRow;
      return of ? { ...plain, source_template_id: of.get(String(plain.id)) ?? null } : plain;
    });
  };

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
      rows: withSourceTemplate(set),
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
      ...withAccount.map((key) => ({
        role: "client" as const,
        userId: seedClientUserId(clientEmails[key]),
        email: clientEmails[key],
        clientKey: key,
      })),
    ],
    clientEmails,
    clientsWithoutAccount: CLIENT_KEYS.filter((key) => !withAccount.includes(key)),
    tables,
  };
}
