import {
  EXERCISE_COLUMNS,
  FOOD_COLUMNS,
  MEASUREMENT_TYPE_COLUMNS,
  QUESTION_COLUMNS,
  exerciseFromRow,
  foodFromRow,
  measurementTypeFromRow,
  questionFromRow,
  type ExerciseRow,
  type FoodRow,
  type MeasurementTypeRow,
  type QuestionRow,
} from "../catalog-rows";
import { insertRows, serviceHeaders } from "../migration/rest";
import {
  MACRO_TARGETS_COLUMNS,
  MENU_SELECT,
  MENU_TEMPLATE_COLUMNS,
  ROUTINE_SELECT,
  ROUTINE_TEMPLATE_COLUMNS,
  macroTargetsFromRow,
  menuFromRow,
  menuTemplateFromRow,
  routineFromRow,
  routineTemplateFromRow,
  type MacroTargetsRow,
  type MenuRow,
  type MenuTemplateRow,
  type RoutineRow,
  type RoutineTemplateRow,
} from "../plan-rows";
import {
  REVIEW_SELECT,
  WEIGHT_LOG_COLUMNS,
  WORKOUT_LOG_COLUMNS,
  reviewFromRow,
  weightLogFromRow,
  workoutLogFromRow,
  type ReviewRow,
  type WeightLogRow,
  type WorkoutLogRow,
} from "../review-rows";
import {
  CLIENT_COLUMNS,
  MEMBERSHIP_COLUMNS,
  clientFromRow,
  membershipFromRow,
  type ClientRow,
  type MembershipRow,
} from "../rows";
import type { AuthUser, Filter, ReadBack, SupabaseSeedBackend } from "./run";
import type { SeedTarget } from "./target";
import type { SeedRow } from "./plan";

/**
 * `SupabaseSeedBackend` con `fetch`, como la carga de la migración: la API REST (PostgREST) para las
 * tablas y la de administración de Auth para las cuentas, con la clave de servicio. Sin SDK.
 */

/** Valores por petición en un filtro `in`: mantiene la URL corta. */
const IN_CHUNK = 100;
/** Filas por página al leer. PostgREST corta por defecto en 1000. */
const PAGE = 1000;

/** Lo que la app lee de cada tabla, con el mismo `select` y el mismo conversor que el adaptador. */
const READ_BACK: { table: string; select: string; fromRow: (row: never) => unknown }[] = [
  { table: "clients", select: CLIENT_COLUMNS, fromRow: (r: ClientRow) => clientFromRow(r) },
  {
    table: "memberships",
    select: MEMBERSHIP_COLUMNS,
    fromRow: (r: MembershipRow) => membershipFromRow(r),
  },
  { table: "exercises", select: EXERCISE_COLUMNS, fromRow: (r: ExerciseRow) => exerciseFromRow(r) },
  { table: "foods", select: FOOD_COLUMNS, fromRow: (r: FoodRow) => foodFromRow(r) },
  {
    table: "measurement_types",
    select: MEASUREMENT_TYPE_COLUMNS,
    fromRow: (r: MeasurementTypeRow) => measurementTypeFromRow(r),
  },
  {
    table: "questionnaire_questions",
    select: QUESTION_COLUMNS,
    fromRow: (r: QuestionRow) => questionFromRow(r),
  },
  {
    table: "routine_templates",
    select: ROUTINE_TEMPLATE_COLUMNS,
    fromRow: (r: RoutineTemplateRow) => routineTemplateFromRow(r),
  },
  {
    table: "menu_templates",
    select: MENU_TEMPLATE_COLUMNS,
    fromRow: (r: MenuTemplateRow) => menuTemplateFromRow(r),
  },
  { table: "routines", select: ROUTINE_SELECT, fromRow: (r: RoutineRow) => routineFromRow(r) },
  { table: "menus", select: MENU_SELECT, fromRow: (r: MenuRow) => menuFromRow(r) },
  {
    table: "macro_targets",
    select: MACRO_TARGETS_COLUMNS,
    fromRow: (r: MacroTargetsRow) => macroTargetsFromRow(r),
  },
  {
    table: "weight_logs",
    select: WEIGHT_LOG_COLUMNS,
    fromRow: (r: WeightLogRow) => weightLogFromRow(r),
  },
  {
    table: "workout_logs",
    select: WORKOUT_LOG_COLUMNS,
    fromRow: (r: WorkoutLogRow) => workoutLogFromRow(r),
  },
  { table: "reviews", select: REVIEW_SELECT, fromRow: (r: ReviewRow) => reviewFromRow(r) },
];

const compact = (select: string) => select.replace(/\s+/g, "");

/** Un valor dentro de `in.(…)`, entre comillas para que comas y paréntesis no rompan la lista. */
const quoted = (value: string) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

function filterParam({ column, op, value }: Filter): string {
  if (op === "in") {
    const values = value as readonly string[];
    return `${column}=in.(${values.map((v) => encodeURIComponent(quoted(v))).join(",")})`;
  }
  return `${column}=${op}.${encodeURIComponent(String(value))}`;
}

async function failure(res: Response, what: string): Promise<Error> {
  let detail = "";
  try {
    const body = (await res.json()) as {
      code?: unknown;
      message?: unknown;
      msg?: unknown;
      error_code?: unknown;
    };
    const parts = [body.code ?? body.error_code, body.message ?? body.msg].filter(
      (part): part is string => typeof part === "string",
    );
    if (parts.length > 0) detail = ` (${parts.join(": ")})`;
  } catch {
    // Sin cuerpo legible: basta con el código.
  }
  return new Error(`${what}: HTTP ${res.status}${detail}.`);
}

export function createRestSeedBackend(target: SeedTarget): SupabaseSeedBackend {
  const send = target.fetch ?? fetch;
  const headers = serviceHeaders(target.serviceKey);

  /** Todas las filas que cumplen los filtros, por páginas. Un `in` largo se parte en varias consultas. */
  async function select(
    table: string,
    columns: string,
    filters: readonly Filter[],
  ): Promise<SeedRow[]> {
    const big = filters.find(
      (f) => f.op === "in" && (f.value as readonly string[]).length > IN_CHUNK,
    );
    if (big) {
      const values = big.value as readonly string[];
      const rows: SeedRow[] = [];
      for (let i = 0; i < values.length; i += IN_CHUNK) {
        const chunk = { ...big, value: values.slice(i, i + IN_CHUNK) };
        rows.push(
          ...(await select(
            table,
            columns,
            filters.map((f) => (f === big ? chunk : f)),
          )),
        );
      }
      return rows;
    }
    if (filters.some((f) => f.op === "in" && (f.value as readonly string[]).length === 0))
      return [];

    const order = compact(columns).split(",")[0]!.split("(")[0];
    const rows: SeedRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      const query = [
        `select=${encodeURIComponent(compact(columns))}`,
        ...filters.map(filterParam),
        `order=${order}`,
        `limit=${PAGE}`,
        `offset=${offset}`,
      ].join("&");
      const res = await send(`${target.url}/rest/v1/${table}?${query}`, { headers });
      if (!res.ok) throw await failure(res, `Al leer ${table}`);
      const page = (await res.json()) as SeedRow[];
      rows.push(...page);
      if (page.length < PAGE) return rows;
    }
  }

  return {
    async listAuthUsers(): Promise<AuthUser[]> {
      const users: AuthUser[] = [];
      for (let page = 1; ; page += 1) {
        const res = await send(`${target.url}/auth/v1/admin/users?page=${page}&per_page=${PAGE}`, {
          headers,
        });
        if (!res.ok) throw await failure(res, "Al listar las cuentas de Auth");
        const body = (await res.json()) as {
          users?: { id: string; email?: string | null; email_confirmed_at?: string | null }[];
        };
        const batch = body.users ?? [];
        users.push(
          ...batch.map((u) => ({
            id: u.id,
            email: u.email ?? null,
            emailConfirmed: Boolean(u.email_confirmed_at),
          })),
        );
        if (batch.length < PAGE) return users;
      }
    },

    async createAuthUser({ id, email, password }) {
      // `email_confirm` deja el correo confirmado. Crear por la API de administración no envía nada:
      // solo invitar o generar un enlace lo haría.
      const res = await send(`${target.url}/auth/v1/admin/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id,
          email,
          password,
          email_confirm: true,
          user_metadata: {},
          app_metadata: {},
        }),
      });
      if (!res.ok) throw await failure(res, `Al crear la cuenta de ${email}`);
    },

    select,

    insert: (table, onConflict, rows) => insertRows(target, table, onConflict, [...rows]),

    async readBack(trainerUserId): Promise<ReadBack> {
      const counts: Record<string, number> = {};
      const invalid: string[] = [];
      const byTrainer: Filter = { column: "trainer_id", op: "eq", value: trainerUserId };
      for (const { table, select: columns, fromRow } of READ_BACK) {
        const rows = await select(table, columns, [byTrainer]);
        let ok = 0;
        for (const row of rows) {
          try {
            fromRow(row as never);
            ok += 1;
          } catch {
            invalid.push(`${table}/${String(row.id)} no pasa su esquema`);
          }
        }
        counts[table] = ok;
      }
      counts.trainers = (
        await select("trainers", "id", [{ column: "id", op: "eq", value: trainerUserId }])
      ).length;
      counts.profiles = (await select("profiles", "user_id", [byTrainer])).length;
      return { counts, invalid };
    },
  };
}
