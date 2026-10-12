import type { z } from "zod";
import {
  clientSchema,
  exerciseSchema,
  foodSchema,
  macroTargetsSchema,
  measurementTypeSchema,
  membershipSchema,
  menuSchema,
  menuTemplateSchema,
  questionnaireQuestionSchema,
  reviewSchema,
  routineSchema,
  routineTemplateSchema,
  weightLogSchema,
  workoutLogSchema,
  type Client,
  type Exercise,
  type Food,
  type MacroTargets,
  type MeasurementType,
  type Membership,
  type Menu,
  type MenuTemplate,
  type QuestionnaireQuestion,
  type Review,
  type Routine,
  type RoutineTemplate,
  type WeightLog,
  type WorkoutLog,
} from "@/lib/domain";
import { COLLECTIONS, FLAGS } from "../helpers";
import {
  buildMacroTargets,
  buildMenus,
  buildRoutine,
  buildWeightLogs,
  buildWorkoutLogs,
} from "./history";
import {
  ROUTINE_TEMPLATE_IDS,
  buildExercises,
  buildFoods,
  buildMeasurementTypes,
  buildMenuTemplate,
  buildQuestions,
  buildRoutineTemplates,
  type SeedContext,
} from "./library";
import { CLIENT_KEYS, buildClients, buildMemberships, type ClientKey } from "./people";
import { buildReviews } from "./reviews";

/** Un documento de la siembra, listo para `create()`. */
export interface SeedDoc {
  collection: string;
  id: string;
  /** Lo que se escribe: el objeto del dominio ya validado, más las banderas si las lleva. */
  data: Record<string, unknown>;
  /** El esquema con el que se valida antes de escribir y al releer. */
  schema: z.ZodType;
}

/** Todo lo que la siembra escribe en Firestore, salvo `trainers/{id}` y los `users/{uid}`. */
export interface SeedPlan {
  ctx: SeedContext;
  exercises: Exercise[];
  foods: Food[];
  measurementTypes: MeasurementType[];
  questions: QuestionnaireQuestion[];
  routineTemplates: RoutineTemplate[];
  menuTemplate: MenuTemplate;
  clients: Record<ClientKey, Client>;
  memberships: Membership[];
  routines: Record<ClientKey, Routine>;
  macroTargets: MacroTargets[];
  menus: Menu[];
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
  reviews: Review[];
  /** Tipos de medida y preguntas que alguna revisión sembrada usa de verdad. */
  measured: ReadonlySet<string>;
  answered: ReadonlySet<string>;
  /** En el orden en que se escriben: primero la biblioteca, al final lo que depende de todo. */
  docs: SeedDoc[];
}

/** Plantilla de rutina, nota y macros objetivo de cada cliente. Las kcal las escribe el entrenador. */
const CLIENT_PLANS = {
  lucas: {
    routineTemplateId: ROUTINE_TEMPLATE_IDS.fullBody3d,
    routineNote: "Sube 2,5 kg en sentadilla si el RIR 2 se te queda fácil.",
    macroTargets: {
      entrenamiento: { kcal: 2700, proteinG: 170, carbsG: 340, fatG: 75 },
      descanso: { kcal: 2400, proteinG: 165, carbsG: 280, fatG: 72 },
    },
    // La plantilla es de definición: para Lucas, más gramos y las macros que le corresponden.
    menuAdjustment: {
      gramsFactor: 1.35,
      macros: [
        { kcal: 2700, proteinG: 170, carbsG: 340, fatG: 75 },
        { kcal: 2650, proteinG: 165, carbsG: 330, fatG: 78 },
        { kcal: 2400, proteinG: 165, carbsG: 280, fatG: 72 },
      ],
    },
  },
  irene: {
    routineTemplateId: ROUTINE_TEMPLATE_IDS.upperLower4d,
    routineNote: "En la búlgara, prioriza el rango completo antes que el peso.",
    macroTargets: {
      entrenamiento: { kcal: 2000, proteinG: 150, carbsG: 210, fatG: 60 },
      descanso: { kcal: 1750, proteinG: 145, carbsG: 160, fatG: 58 },
    },
    menuAdjustment: undefined,
  },
} as const;

/**
 * La siembra entera como función pura de quién es el entrenador, cuál es el ancla y qué zona usa.
 * No toca Firebase: lo que devuelve ya está validado con los esquemas de `lib/domain`, y `run.ts`
 * solo decide qué falta por crear.
 */
export function buildSeedPlan(ctx: SeedContext): SeedPlan {
  const exercises = buildExercises(ctx);
  const foods = buildFoods(ctx);
  const measurementTypes = buildMeasurementTypes(ctx);
  const questions = buildQuestions(ctx);
  const routineTemplates = buildRoutineTemplates(ctx, exercises);
  const menuTemplate = buildMenuTemplate(ctx, foods);
  const clients = buildClients(ctx);
  const memberships = buildMemberships(ctx, clients);

  const routines = {} as Record<ClientKey, Routine>;
  const macroTargets: MacroTargets[] = [];
  const menus: Menu[] = [];
  const weightLogs: WeightLog[] = [];
  const workoutLogs: WorkoutLog[] = [];
  const reviews: Review[] = [];

  for (const key of CLIENT_KEYS) {
    const client = clients[key];
    const plan = CLIENT_PLANS[key];
    const template = routineTemplates.find((t) => t.id === plan.routineTemplateId)!;
    routines[key] = buildRoutine(ctx, client, template, exercises, plan.routineNote);
    macroTargets.push(...buildMacroTargets(ctx, client, plan.macroTargets));
    menus.push(...buildMenus(ctx, client, menuTemplate, plan.menuAdjustment));
    const logs = buildWeightLogs(ctx, key, client);
    weightLogs.push(...logs);
    workoutLogs.push(...buildWorkoutLogs(ctx, key, client, routines[key]));
    reviews.push(
      ...buildReviews(ctx, key, { client, weightLogs: logs, measurementTypes, questions }),
    );
  }

  // I26 e I15: la unidad y el formato quedan fijos desde la primera medida o respuesta. La app sube
  // estas banderas al guardar la revisión; aquí las revisiones se escriben directamente, así que
  // nacen `true` las de lo que alguna revisión usa, y `false` las demás, que siguen editables.
  const measured = new Set(reviews.flatMap((r) => r.measurements.map((m) => m.measurementTypeId)));
  const answered = new Set(reviews.flatMap((r) => r.responses.map((r2) => r2.questionId)));

  const docsOf = <T extends { id: string }>(
    collection: string,
    schema: z.ZodType,
    items: readonly T[],
    extra: (item: T) => Record<string, unknown> = () => ({}),
  ): SeedDoc[] =>
    items.map((item) => ({ collection, id: item.id, schema, data: { ...item, ...extra(item) } }));

  const docs: SeedDoc[] = [
    ...docsOf(COLLECTIONS.exercises, exerciseSchema, exercises),
    ...docsOf(COLLECTIONS.foods, foodSchema, foods),
    ...docsOf(COLLECTIONS.measurementTypes, measurementTypeSchema, measurementTypes, (t) => ({
      [FLAGS.hasMeasurements]: measured.has(t.id),
    })),
    ...docsOf(COLLECTIONS.questions, questionnaireQuestionSchema, questions, (q) => ({
      [FLAGS.hasResponses]: answered.has(q.id),
    })),
    ...docsOf(COLLECTIONS.routineTemplates, routineTemplateSchema, routineTemplates),
    ...docsOf(COLLECTIONS.menuTemplates, menuTemplateSchema, [menuTemplate]),
    ...docsOf(COLLECTIONS.clients, clientSchema, Object.values(clients)),
    ...docsOf(COLLECTIONS.memberships, membershipSchema, memberships),
    ...docsOf(COLLECTIONS.routines, routineSchema, Object.values(routines)),
    ...docsOf(COLLECTIONS.macroTargets, macroTargetsSchema, macroTargets),
    ...docsOf(COLLECTIONS.menus, menuSchema, menus),
    ...docsOf(COLLECTIONS.weightLogs, weightLogSchema, weightLogs),
    ...docsOf(COLLECTIONS.workoutLogs, workoutLogSchema, workoutLogs),
    ...docsOf(COLLECTIONS.reviews, reviewSchema, reviews),
  ];

  return {
    ctx,
    exercises,
    foods,
    measurementTypes,
    questions,
    routineTemplates,
    menuTemplate,
    clients,
    memberships,
    routines,
    macroTargets,
    menus,
    weightLogs,
    workoutLogs,
    reviews,
    measured,
    answered,
    docs,
  };
}

/** Las colecciones que la siembra escribe, en su orden de escritura y sin repetir. */
export const SEED_COLLECTIONS: readonly string[] = [
  COLLECTIONS.exercises,
  COLLECTIONS.foods,
  COLLECTIONS.measurementTypes,
  COLLECTIONS.questions,
  COLLECTIONS.routineTemplates,
  COLLECTIONS.menuTemplates,
  COLLECTIONS.clients,
  COLLECTIONS.memberships,
  COLLECTIONS.routines,
  COLLECTIONS.macroTargets,
  COLLECTIONS.menus,
  COLLECTIONS.weightLogs,
  COLLECTIONS.workoutLogs,
  COLLECTIONS.reviews,
];
