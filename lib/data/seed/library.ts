import {
  addCivilDays,
  assertExercisesInLibrary,
  createFoodItem,
  exerciseSchema,
  foodSchema,
  measurementTypeSchema,
  menuTemplateSchema,
  questionnaireQuestionSchema,
  routineTemplateSchema,
  type CivilDate,
  type Exercise,
  type Food,
  type Macros,
  type Meal,
  type MeasurementType,
  type MenuTemplate,
  type MenuTemplateEntry,
  type QuestionnaireQuestion,
  type ResponseFormat,
  type RoutineDay,
  type RoutineTemplate,
} from "@/lib/domain";
import { slug } from "./ids";
import { at, type SeedClock } from "./time";

/**
 * Los ids que cada backend compone a su manera. En Firestore, un pesaje, una serie y una revisión
 * llevan como id su clave compuesta (cliente y fecha, cliente y semana…), y la siembra tiene que
 * caer sobre esos mismos documentos.
 */
export interface SeedIdFormats {
  weightLog: (clientId: string, date: CivilDate) => string;
  workoutLog: (
    clientId: string,
    routineDayExerciseId: string,
    date: CivilDate,
    setNumber: number,
  ) => string;
  review: (clientId: string, weekNumber: number) => string;
}

/** Lo que hace falta para construir cualquier dato de la siembra. */
export interface SeedContext {
  trainerId: string;
  /**
   * Prefijo de todos los ids sembrados. Firebase usa `SEED_PREFIX`; un backend que siembre a varios
   * entrenadores lo hace único por entrenador, para que sus ids no choquen.
   */
  idPrefix: string;
  ids: SeedIdFormats;
  /** El «hoy» de la siembra en la zona del entrenador: todas las fechas son relativas a él. */
  anchor: CivilDate;
  clock: SeedClock;
}

/** La biblioteca existía antes que los clientes: el más antiguo se dio de alta hace 63 días. */
const LIBRARY_AGE_DAYS = 90;
/** Lo último que el entrenador añadió a sus catálogos: ayer, después de abrirse las revisiones. */
const RECENT_AGE_DAYS = 1;

const daysAgo = (ctx: SeedContext, days: number): CivilDate => addCivilDays(ctx.anchor, -days);

/* ---------- Ejercicios ---------- */

type ExerciseRow = [
  key: string,
  name: string,
  muscleGroup: string,
  equipment: string,
  desc?: string,
];

const EXERCISE_ROWS = [
  [
    "squat",
    "Sentadilla trasera",
    "Pierna",
    "barra",
    "Barra apoyada en el trapecio y bajada controlada hasta romper la paralela.",
  ],
  ["bench", "Press banca", "Empuje", "barra"],
  ["pullup", "Dominadas", "Tracción", "peso corporal"],
  ["rdl", "Peso muerto rumano", "Pierna", "barra"],
  ["bulgarian", "Zancada búlgara", "Pierna", "mancuernas"],
  ["row", "Remo con barra", "Tracción", "barra"],
  ["legPress", "Prensa inclinada", "Pierna", "máquina"],
  ["legCurl", "Curl femoral tumbado", "Pierna", "máquina"],
  ["ohp", "Press militar", "Empuje", "barra"],
  ["inclineDb", "Press inclinado con mancuernas", "Empuje", "mancuernas"],
  ["latPulldown", "Jalón al pecho", "Tracción", "polea"],
  [
    "lateralRaise",
    "Elevaciones laterales",
    "Empuje",
    "mancuernas",
    "Codos algo flexionados; sube hasta la altura del hombro sin balanceo.",
  ],
] as const satisfies readonly ExerciseRow[];

export type ExerciseKey = (typeof EXERCISE_ROWS)[number][0];

const exerciseId = (prefix: string, name: string) => `${prefix}ex-${slug(name)}`;

/** Id de cada ejercicio por su clave: es lo que usan las plantillas y los entrenos registrados. */
export const exerciseIds = (prefix: string) =>
  Object.fromEntries(EXERCISE_ROWS.map(([key, name]) => [key, exerciseId(prefix, name)])) as Record<
    ExerciseKey,
    string
  >;

/** Doce ejercicios activos. Sin vídeo: un enlace inventado no lleva a ningún sitio (I20). */
export function buildExercises(ctx: SeedContext): Exercise[] {
  const createdAt = at(ctx.clock, daysAgo(ctx, LIBRARY_AGE_DAYS), "10:00");
  return (EXERCISE_ROWS as readonly ExerciseRow[]).map(([, name, muscleGroup, equipment, desc]) =>
    exerciseSchema.parse({
      id: exerciseId(ctx.idPrefix, name),
      trainerId: ctx.trainerId,
      name,
      muscleGroup,
      equipment,
      videoUrl: null,
      description: desc ?? "",
      status: "activo",
      createdAt,
    }),
  );
}

/* ---------- Alimentos propios ---------- */

type FoodRow = [
  key: string,
  name: string,
  kcal: number,
  proteinG: number,
  carbsG: number,
  fatG: number,
];

/** Composición por 100 g, con un decimal como mucho (§5). */
const FOOD_ROWS = [
  ["oats", "Copos de avena", 372, 13.5, 58.7, 7],
  ["eggWhites", "Claras de huevo", 52, 10.9, 0.7, 0.2],
  ["egg", "Huevo entero", 143, 12.6, 0.7, 9.5],
  ["banana", "Plátano", 94, 1.2, 20, 0.3],
  ["rice", "Arroz basmati (en seco)", 354, 8, 77, 0.9],
  ["chicken", "Pechuga de pollo", 113, 23, 0, 1.9],
  ["oliveOil", "Aceite de oliva", 899, 0, 0, 99.9],
  ["potato", "Patata cocida", 77, 1.9, 16, 0.1],
  ["hake", "Merluza", 71, 15.9, 0, 0.9],
  ["yogurt", "Yogur griego 0%", 59, 10.3, 3.6, 0.4],
  ["walnuts", "Nueces", 654, 15.2, 13.7, 65.2],
  ["bread", "Pan integral", 247, 13, 41, 3.4],
  ["tuna", "Atún al natural", 116, 25.5, 0, 1],
  ["salmon", "Salmón", 208, 20.4, 0, 13.4],
  ["pasta", "Pasta (en seco)", 359, 12.5, 71, 1.5],
] as const satisfies readonly FoodRow[];

export type FoodKey = (typeof FOOD_ROWS)[number][0];

/**
 * Quince alimentos propios, `pendiente` de publicar: es el estado real de cualquier alimento creado
 * con Firebase mientras el catálogo común no responde (§7, §12, tarjeta 90). Sembrarlos como
 * `publicado` sería falso, y además nunca llegarían al catálogo: la app solo publica lo pendiente.
 */
export function buildFoods(ctx: SeedContext): Food[] {
  const createdAt = at(ctx.clock, daysAgo(ctx, LIBRARY_AGE_DAYS), "10:30");
  return (FOOD_ROWS as readonly FoodRow[]).map(([, name, kcal, proteinG, carbsG, fatG]) =>
    foodSchema.parse({
      id: `${ctx.idPrefix}food-${slug(name)}`,
      trainerId: ctx.trainerId,
      name,
      composition: { kcal, proteinG, carbsG, fatG },
      status: "activo",
      publishStatus: "pendiente",
      createdAt,
      updatedAt: createdAt,
    }),
  );
}

/* ---------- Catálogos: tipos de medida y cuestionario ---------- */

/**
 * Los ocho de `demo-data/catalogs.ts`, en cm. El último es reciente: se añadió ayer, cuando las
 * revisiones enviadas ya estaban abiertas, así que ninguna lo midió y su unidad sigue editable (I26).
 */
const MEASUREMENT_LABELS = [
  "Cuello",
  "Pecho",
  "Cintura",
  "Cadera",
  "Brazo",
  "Muslo",
  "Gemelo",
  "Hombros",
] as const;
export type MeasurementLabel = (typeof MEASUREMENT_LABELS)[number];
const RECENT_MEASUREMENT: MeasurementLabel = "Hombros";

export const measurementTypeId = (prefix: string, label: MeasurementLabel) =>
  `${prefix}mt-${slug(label)}`;

export function buildMeasurementTypes(ctx: SeedContext): MeasurementType[] {
  return MEASUREMENT_LABELS.map((label, order) =>
    measurementTypeSchema.parse({
      id: measurementTypeId(ctx.idPrefix, label),
      trainerId: ctx.trainerId,
      label,
      unit: "cm",
      order,
      status: "activa",
      createdAt: at(
        ctx.clock,
        daysAgo(ctx, label === RECENT_MEASUREMENT ? RECENT_AGE_DAYS : LIBRARY_AGE_DAYS),
        "11:00",
      ),
    }),
  );
}

const scale: ResponseFormat = { kind: "escala", min: 1, max: 5 };
const text: ResponseFormat = { kind: "texto" };

type QuestionRow = [key: string, prompt: string, format: ResponseFormat, recent?: boolean];

/**
 * Cinco preguntas, con el criterio de `demo-data/catalogs.ts`: tres de escala y dos de texto. La
 * última es reciente, como el tipo de medida: nadie la ha respondido y su formato sigue editable
 * (I15).
 */
const QUESTION_ROWS = [
  ["energy", "Energía en los entrenos", scale],
  ["sleep", "Calidad del sueño", scale],
  ["hunger", "Hambre / adherencia al plan", scale],
  ["howSeen", "¿Cómo te has visto esta semana?", text],
  ["pain", "Molestias o dolores", text, true],
] as const satisfies readonly QuestionRow[];

export type QuestionKey = (typeof QUESTION_ROWS)[number][0];

export const questionIds = (prefix: string) =>
  Object.fromEntries(QUESTION_ROWS.map(([key]) => [key, `${prefix}q-${slug(key)}`])) as Record<
    QuestionKey,
    string
  >;

export function buildQuestions(ctx: SeedContext): QuestionnaireQuestion[] {
  const ids = questionIds(ctx.idPrefix);
  return (QUESTION_ROWS as readonly QuestionRow[]).map(([key, prompt, format, recent], order) =>
    questionnaireQuestionSchema.parse({
      id: ids[key as QuestionKey],
      trainerId: ctx.trainerId,
      prompt,
      format,
      order,
      status: "activa",
      createdAt: at(ctx.clock, daysAgo(ctx, recent ? RECENT_AGE_DAYS : LIBRARY_AGE_DAYS), "11:30"),
    }),
  );
}

/* ---------- Plantillas de rutina ---------- */

type Rx = [
  exercise: ExerciseKey,
  sets: number,
  repsMin: number,
  repsMax: number | null,
  rir: string,
  rest?: string,
  note?: string,
];

function day(
  exerciseIdOf: Record<ExerciseKey, string>,
  prefix: string,
  dayNumber: number,
  label: string,
  rows: Rx[],
): RoutineDay {
  return {
    id: `${prefix}-d${dayNumber}`,
    dayNumber,
    label,
    exercises: rows.map(([exercise, sets, repsMin, repsMax, rir, rest = "", note = ""], i) => ({
      id: `${prefix}-d${dayNumber}-e${i + 1}`,
      exerciseId: exerciseIdOf[exercise],
      prescription: { sets, repsMin, repsMax, rir, rest, note },
    })),
  };
}

export const routineTemplateIds = (prefix: string) =>
  ({
    fullBody3d: `${prefix}rt-full-body-3d`,
    upperLower4d: `${prefix}rt-torso-pierna-4d`,
  }) as const;

/** Dos plantillas de rutina: una de tres días y otra de cuatro. Solo ejercicios activos (I3). */
export function buildRoutineTemplates(
  ctx: SeedContext,
  library: readonly Exercise[],
): RoutineTemplate[] {
  const createdAt = at(ctx.clock, daysAgo(ctx, LIBRARY_AGE_DAYS), "12:00");
  const updatedAt = at(ctx.clock, daysAgo(ctx, 70), "12:00");
  const base = { trainerId: ctx.trainerId, note: "", createdAt, updatedAt };
  const { fullBody3d: fullBody, upperLower4d: upperLower } = routineTemplateIds(ctx.idPrefix);
  const ex = exerciseIds(ctx.idPrefix);
  const templates = [
    {
      ...base,
      id: fullBody,
      name: "Full body 3 días",
      description: "Cuerpo completo en días alternos",
      days: [
        day(ex, fullBody, 1, "A", [
          ["squat", 4, 6, 8, "2", "3 min"],
          ["bench", 4, 6, 8, "2", "3 min"],
          ["row", 3, 8, 10, "2", "2 min"],
          ["lateralRaise", 3, 12, 15, "1"],
        ]),
        day(ex, fullBody, 2, "B", [
          ["rdl", 4, 6, 8, "2", "3 min"],
          ["ohp", 4, 6, 8, "2", "3 min"],
          ["latPulldown", 3, 10, 12, "1-2", "2 min"],
          ["bulgarian", 3, 8, 10, "2", "", "por pierna"],
        ]),
        day(ex, fullBody, 3, "C", [
          ["legPress", 3, 10, 12, "1-2", "2 min"],
          ["inclineDb", 3, 8, 10, "2", "2 min"],
          ["pullup", 3, 6, 10, "2", "2 min"],
          ["legCurl", 3, 12, 15, "1"],
        ]),
      ],
    },
    {
      ...base,
      id: upperLower,
      name: "Torso / Pierna 4 días",
      description: "Dos días de torso y dos de pierna",
      days: [
        day(ex, upperLower, 1, "Torso", [
          ["bench", 4, 6, 8, "2", "3 min"],
          ["row", 4, 8, 10, "2", "2 min"],
          ["ohp", 3, 8, 10, "1-2", "2 min"],
          ["latPulldown", 3, 10, 12, "1-2", "2 min"],
        ]),
        day(ex, upperLower, 2, "Pierna", [
          ["squat", 4, 6, 8, "2", "3 min"],
          ["legPress", 3, 10, 12, "1-2", "2 min"],
          ["legCurl", 3, 12, 15, "1"],
        ]),
        day(ex, upperLower, 3, "Torso", [
          ["pullup", 4, 6, 10, "2", "3 min"],
          ["inclineDb", 3, 8, 10, "2", "2 min"],
          ["lateralRaise", 3, 12, 15, "1"],
        ]),
        day(ex, upperLower, 4, "Pierna", [
          ["rdl", 4, 6, 8, "2", "3 min"],
          ["bulgarian", 3, 8, 10, "2", "", "por pierna"],
          ["legCurl", 3, 12, 15, "1"],
        ]),
      ],
    },
  ].map((template) => routineTemplateSchema.parse(template));
  for (const template of templates) assertExercisesInLibrary(template, library);
  return templates;
}

/* ---------- Plantilla de menú ---------- */

/** Alimento del menú: de la biblioteca si lleva su clave, de texto libre si lleva `free`. */
type Item = [food: FoodKey | { free: string }, grams: number];

export const menuTemplateId = (prefix: string) => `${prefix}mnt-semana-tipo`;

/**
 * Una plantilla con dos menús de entrenamiento (uno sugerido) y uno de descanso. Los alimentos salen
 * de la biblioteca con `createFoodItem`, que guarda su copia congelada (I29); las verduras y la
 * ensalada van de texto libre y no suman (I30). Las kcal y los macros de cada menú son los que
 * escribe el entrenador: no se derivan de los alimentos ni con 4/4/9 (§5).
 */
export function buildMenuTemplate(ctx: SeedContext, foods: readonly Food[]): MenuTemplate {
  const templateId = menuTemplateId(ctx.idPrefix);
  const foodOf = (key: FoodKey): Food => {
    const name = (FOOD_ROWS as readonly FoodRow[]).find(([k]) => k === key)![1];
    return foods.find((f) => f.name === name)!;
  };
  const meal = (prefix: string, name: string, items: Item[]): Meal => ({
    id: `${prefix}-${slug(name)}`,
    name,
    items: items.map(([food, grams], i) => {
      const id = `${prefix}-${slug(name)}-${i + 1}`;
      return typeof food === "string"
        ? createFoodItem(foodOf(food), grams, () => id)
        : { id, name: food.free, grams };
    }),
  });
  const entry = (
    key: string,
    name: string,
    dayType: MenuTemplateEntry["dayType"],
    suggested: boolean,
    macros: Macros,
    note: string,
    meals: [name: string, items: Item[]][],
  ): MenuTemplateEntry => {
    const id = `${templateId}-${key}`;
    return {
      id,
      name,
      dayType,
      suggested,
      macros,
      note,
      meals: meals.map(([mealName, items]) => meal(id, mealName, items)),
    };
  };
  return menuTemplateSchema.parse({
    id: templateId,
    trainerId: ctx.trainerId,
    name: "Semana tipo",
    description: "Dos menús de entrenamiento y uno de descanso; los gramos se ajustan por cliente",
    menus: [
      entry(
        "a",
        "Menú A — Casero",
        "entrenamiento",
        true,
        { kcal: 2000, proteinG: 150, carbsG: 210, fatG: 60 },
        "Puedes cambiar la merluza por cualquier pescado blanco al mismo peso.",
        [
          [
            "Desayuno",
            [
              ["oats", 60],
              ["eggWhites", 200],
              ["banana", 100],
            ],
          ],
          [
            "Comida",
            [
              ["rice", 90],
              ["chicken", 160],
              ["oliveOil", 10],
              [{ free: "Verduras variadas" }, 200],
            ],
          ],
          [
            "Merienda",
            [
              ["yogurt", 250],
              ["walnuts", 20],
            ],
          ],
          [
            "Cena",
            [
              ["hake", 200],
              ["potato", 250],
              ["oliveOil", 10],
            ],
          ],
        ],
      ),
      entry(
        "b",
        "Menú B — Tupper",
        "entrenamiento",
        false,
        { kcal: 1980, proteinG: 145, carbsG: 205, fatG: 62 },
        "",
        [
          [
            "Desayuno",
            [
              ["bread", 80],
              ["egg", 120],
              ["banana", 100],
            ],
          ],
          [
            "Comida",
            [
              ["pasta", 90],
              ["tuna", 160],
              ["oliveOil", 10],
            ],
          ],
          [
            "Cena",
            [
              ["salmon", 150],
              ["potato", 200],
              [{ free: "Ensalada" }, 150],
            ],
          ],
        ],
      ),
      entry(
        "descanso",
        "Menú descanso",
        "descanso",
        true,
        { kcal: 1750, proteinG: 145, carbsG: 160, fatG: 58 },
        "",
        [
          [
            "Desayuno",
            [
              ["oats", 40],
              ["eggWhites", 200],
            ],
          ],
          [
            "Comida",
            [
              ["rice", 60],
              ["chicken", 180],
              ["oliveOil", 10],
              [{ free: "Verduras variadas" }, 250],
            ],
          ],
          ["Merienda", [["yogurt", 200]]],
          [
            "Cena",
            [
              ["hake", 200],
              ["potato", 150],
              ["oliveOil", 10],
            ],
          ],
        ],
      ),
    ],
    createdAt: at(ctx.clock, daysAgo(ctx, LIBRARY_AGE_DAYS), "12:30"),
    updatedAt: at(ctx.clock, daysAgo(ctx, 70), "12:30"),
  });
}
