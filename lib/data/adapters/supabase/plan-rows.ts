import {
  macroTargetsSchema,
  menuSchema,
  menuTemplateSchema,
  routineSchema,
  routineTemplateSchema,
  type MacroTargets,
  type Menu,
  type MenuTemplate,
  type Routine,
  type RoutineTemplate,
} from "@/lib/domain";

/** `timestamptz` a ISO con `Z`, como en `catalog-rows.ts`. */
const isoOf = (value: string) => new Date(value).toISOString();

/**
 * Las rutinas y los menús se leen con sus hijos embebidos (días y líneas; comidas y alimentos). Las
 * claves foráneas de las tablas hijas apuntan solo al padre, así que PostgREST los embebe sin ambigüedad.
 */
export const ROUTINE_SELECT = `
  id, trainer_id, client_id, status, name, note, source_template_name, created_at, updated_at,
  routine_days (
    id, day_number, label, position,
    routine_day_exercises (id, exercise_id, position, sets, reps_min, reps_max, rir, rest, note)
  )
`;

export const MENU_SELECT = `
  id, trainer_id, client_id, status, name, day_type, suggested, kcal, protein_g, carbs_g, fat_g,
  note, source_template_name, created_at, updated_at,
  meals (
    id, name, position,
    menu_items (id, name, grams, position, food_id, kcal, protein_g, carbs_g, fat_g)
  )
`;

export const ROUTINE_TEMPLATE_COLUMNS =
  "id, trainer_id, name, description, body, created_at, updated_at";

export const MENU_TEMPLATE_COLUMNS =
  "id, trainer_id, name, description, body, created_at, updated_at";

export const MACRO_TARGETS_COLUMNS =
  "id, trainer_id, client_id, day_type, status, kcal, protein_g, carbs_g, fat_g, created_at, updated_at";

interface RoutineLineRow {
  id: string;
  exercise_id: string;
  position: number;
  sets: number;
  reps_min: number;
  reps_max: number | null;
  rir: string;
  rest: string;
  note: string;
}

interface RoutineDayRow {
  id: string;
  day_number: number;
  label: string;
  position: number;
  routine_day_exercises: RoutineLineRow[];
}

export interface RoutineRow {
  id: string;
  trainer_id: string;
  client_id: string;
  status: string;
  name: string;
  note: string;
  source_template_name: string | null;
  created_at: string;
  updated_at: string;
  routine_days: RoutineDayRow[];
}

interface MenuItemRow {
  id: string;
  name: string;
  grams: number;
  position: number;
  food_id: string | null;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

interface MealRow {
  id: string;
  name: string;
  position: number;
  menu_items: MenuItemRow[];
}

export interface MenuRow {
  id: string;
  trainer_id: string;
  client_id: string;
  status: string;
  name: string;
  day_type: string;
  suggested: boolean;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  note: string;
  source_template_name: string | null;
  created_at: string;
  updated_at: string;
  meals: MealRow[];
}

export interface RoutineTemplateRow {
  id: string;
  trainer_id: string;
  name: string;
  description: string;
  /** `{ note, days }`, con la forma de `RoutineBody` sin el nombre, que va en su columna. */
  body: { note?: string; days?: unknown[] };
  created_at: string;
  updated_at: string;
}

export interface MenuTemplateRow {
  id: string;
  trainer_id: string;
  name: string;
  description: string;
  /** `{ menus }`, con la forma de `MenuTemplateEntry` por menú. */
  body: { menus?: unknown[] };
  created_at: string;
  updated_at: string;
}

export interface MacroTargetsRow {
  id: string;
  trainer_id: string;
  client_id: string;
  day_type: string;
  status: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
  updated_at: string;
}

const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export function routineFromRow(row: RoutineRow): Routine {
  return routineSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    clientId: row.client_id,
    status: row.status,
    name: row.name,
    note: row.note,
    days: [...row.routine_days].sort(byPosition).map((day) => ({
      id: day.id,
      dayNumber: day.day_number,
      label: day.label,
      exercises: [...day.routine_day_exercises].sort(byPosition).map((line) => ({
        id: line.id,
        exerciseId: line.exercise_id,
        prescription: {
          sets: line.sets,
          repsMin: line.reps_min,
          repsMax: line.reps_max,
          rir: line.rir,
          rest: line.rest,
          note: line.note,
        },
      })),
    })),
    sourceTemplateName: row.source_template_name,
    createdAt: isoOf(row.created_at),
    updatedAt: isoOf(row.updated_at),
  });
}

/** Un alimento de la biblioteca lleva su copia congelada (I29); uno de texto libre, ninguna (I30). */
function menuItemFromRow(row: MenuItemRow) {
  const base = { id: row.id, name: row.name, grams: row.grams };
  if (row.food_id === null) return base;
  return {
    ...base,
    foodId: row.food_id,
    composition: {
      kcal: row.kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
    },
  };
}

export function menuFromRow(row: MenuRow): Menu {
  return menuSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    clientId: row.client_id,
    status: row.status,
    name: row.name,
    dayType: row.day_type,
    suggested: row.suggested,
    macros: {
      kcal: row.kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
    },
    meals: [...row.meals].sort(byPosition).map((meal) => ({
      id: meal.id,
      name: meal.name,
      items: [...meal.menu_items].sort(byPosition).map(menuItemFromRow),
    })),
    note: row.note,
    sourceTemplateName: row.source_template_name,
    createdAt: isoOf(row.created_at),
    updatedAt: isoOf(row.updated_at),
  });
}

export function routineTemplateFromRow(row: RoutineTemplateRow): RoutineTemplate {
  return routineTemplateSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    name: row.name,
    description: row.description,
    note: row.body.note ?? "",
    days: row.body.days ?? [],
    createdAt: isoOf(row.created_at),
    updatedAt: isoOf(row.updated_at),
  });
}

export function menuTemplateFromRow(row: MenuTemplateRow): MenuTemplate {
  return menuTemplateSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    name: row.name,
    description: row.description,
    menus: row.body.menus ?? [],
    createdAt: isoOf(row.created_at),
    updatedAt: isoOf(row.updated_at),
  });
}

export function macroTargetsFromRow(row: MacroTargetsRow): MacroTargets {
  return macroTargetsSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    clientId: row.client_id,
    dayType: row.day_type,
    macros: {
      kcal: row.kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
    },
    status: row.status,
    createdAt: isoOf(row.created_at),
    updatedAt: isoOf(row.updated_at),
  });
}
