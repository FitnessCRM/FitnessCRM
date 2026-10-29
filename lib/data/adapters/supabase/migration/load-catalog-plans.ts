import type { ZodType } from "zod";
import {
  exerciseSchema,
  foodSchema,
  macroTargetsSchema,
  measurementTypeSchema,
  membershipSchema,
  menuSchema,
  menuTemplateSchema,
  questionnaireQuestionSchema,
  routineSchema,
  routineTemplateSchema,
  type Exercise,
  type Food,
  type MacroTargets,
  type MeasurementType,
  type Membership,
  type Menu,
  type MenuTemplate,
  type QuestionnaireQuestion,
  type Routine,
  type RoutineTemplate,
} from "@/lib/domain";
import type { ExportedDocument } from "./people";
import { assertLocalUrl, upsertRows, type LoadTarget } from "./rest";
import {
  exerciseRow,
  foodRow,
  macroTargetsRow,
  measurementTypeRow,
  membershipRow,
  menuRows,
  menuTemplateRow,
  questionRow,
  routineRows,
  routineTemplateRow,
} from "./to-rows";

/**
 * Catálogos y planes (tarjeta 119, Fase 8): ejercicios, alimentos, tipos de medida, preguntas,
 * plantillas, rutinas, menús, objetivos de macros y membresías. Cada colección se valida con su
 * esquema del dominio antes de escribir nada, y los ficheros se escriben en orden de dependencia.
 */

export const PLAN_COLLECTIONS = [
  "exercises",
  "foods",
  "measurementTypes",
  "questions",
  "routineTemplates",
  "menuTemplates",
  "routines",
  "menus",
  "macroTargets",
  "memberships",
] as const;

export type PlanCollection = (typeof PLAN_COLLECTIONS)[number];

export interface PlanData {
  exercises: Exercise[];
  foods: Food[];
  measurementTypes: MeasurementType[];
  questions: QuestionnaireQuestion[];
  routineTemplates: RoutineTemplate[];
  menuTemplates: MenuTemplate[];
  routines: Routine[];
  menus: Menu[];
  macroTargets: MacroTargets[];
  memberships: Membership[];
}

/**
 * Valida cada documento con su esquema. El error nombra solo la colección y el id: nunca los datos.
 */
export function parseCollection<T>(
  name: string,
  documents: ExportedDocument[],
  schema: ZodType<T>,
): T[] {
  return documents.map((doc) => {
    const result = schema.safeParse(doc.data);
    if (!result.success) {
      throw new Error(`El documento ${doc.id} de ${name} no cumple el esquema del dominio.`);
    }
    return result.data;
  });
}

export function parsePlanData(documents: Record<PlanCollection, ExportedDocument[]>): PlanData {
  return {
    exercises: parseCollection("exercises", documents.exercises, exerciseSchema),
    foods: parseCollection("foods", documents.foods, foodSchema),
    measurementTypes: parseCollection(
      "measurementTypes",
      documents.measurementTypes,
      measurementTypeSchema,
    ),
    questions: parseCollection("questions", documents.questions, questionnaireQuestionSchema),
    routineTemplates: parseCollection(
      "routineTemplates",
      documents.routineTemplates,
      routineTemplateSchema,
    ),
    menuTemplates: parseCollection("menuTemplates", documents.menuTemplates, menuTemplateSchema),
    routines: parseCollection("routines", documents.routines, routineSchema),
    menus: parseCollection("menus", documents.menus, menuSchema),
    macroTargets: parseCollection("macroTargets", documents.macroTargets, macroTargetsSchema),
    memberships: parseCollection("memberships", documents.memberships, membershipSchema),
  };
}

const countBy = <T>(items: T[], key: (item: T) => string): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
};

/**
 * Los invariantes de un solo activo que la base de datos también impone (I4 y la unicidad de los
 * menús sugeridos). Se comprueban antes de escribir para que el fallo salga con su causa, no como un
 * error de constraint a mitad de carga.
 */
export function findPlanViolations(data: PlanData): string[] {
  const problems: string[] = [];
  const check = (label: string, counts: Map<string, number>) => {
    for (const [key, count] of counts) {
      if (count > 1) problems.push(`${label} ${key}: ${count} a la vez`);
    }
  };
  check(
    "rutinas activas del cliente",
    countBy(
      data.routines.filter((routine) => routine.status === "activo"),
      (routine) => routine.clientId,
    ),
  );
  check(
    "menús sugeridos activos del cliente y día",
    countBy(
      data.menus.filter((menu) => menu.status === "activo" && menu.suggested),
      (menu) => `${menu.clientId}/${menu.dayType}`,
    ),
  );
  check(
    "objetivos de macros activos del cliente y día",
    countBy(
      data.macroTargets.filter((target) => target.status === "activo"),
      (target) => `${target.clientId}/${target.dayType}`,
    ),
  );
  return problems;
}

/** Filas por tabla, en el orden en que se escriben: primero lo que otras tablas referencian. */
export function planRowSets(data: PlanData) {
  const routines = data.routines.map(routineRows);
  const menus = data.menus.map(menuRows);
  return [
    { table: "exercises", onConflict: "id", rows: data.exercises.map(exerciseRow) },
    { table: "foods", onConflict: "id", rows: data.foods.map(foodRow) },
    {
      table: "measurement_types",
      onConflict: "id",
      rows: data.measurementTypes.map(measurementTypeRow),
    },
    {
      table: "questionnaire_questions",
      onConflict: "id",
      rows: data.questions.map(questionRow),
    },
    {
      table: "routine_templates",
      onConflict: "id",
      rows: data.routineTemplates.map(routineTemplateRow),
    },
    { table: "menu_templates", onConflict: "id", rows: data.menuTemplates.map(menuTemplateRow) },
    { table: "routines", onConflict: "id", rows: routines.map((r) => r.routine) },
    { table: "routine_days", onConflict: "routine_id,id", rows: routines.flatMap((r) => r.days) },
    {
      table: "routine_day_exercises",
      onConflict: "routine_id,id",
      rows: routines.flatMap((r) => r.lines),
    },
    { table: "menus", onConflict: "id", rows: menus.map((m) => m.menu) },
    { table: "meals", onConflict: "menu_id,id", rows: menus.flatMap((m) => m.meals) },
    { table: "menu_items", onConflict: "menu_id,id", rows: menus.flatMap((m) => m.items) },
    { table: "macro_targets", onConflict: "id", rows: data.macroTargets.map(macroTargetsRow) },
    { table: "memberships", onConflict: "id", rows: data.memberships.map(membershipRow) },
  ];
}

/** Escribe catálogos y planes. Devuelve las filas enviadas por tabla. */
export async function loadCatalogAndPlans(
  data: PlanData,
  target: LoadTarget,
): Promise<Record<string, number>> {
  assertLocalUrl(target.url);
  const problems = findPlanViolations(data);
  if (problems.length > 0) {
    throw new Error(`Hay planes que no cumplen los invariantes: ${problems.join("; ")}.`);
  }

  const counts: Record<string, number> = {};
  for (const set of planRowSets(data)) {
    await upsertRows(target, set.table, set.onConflict, set.rows);
    counts[set.table] = set.rows.length;
  }
  return counts;
}
