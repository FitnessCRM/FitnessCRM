import type {
  Client,
  Exercise,
  Food,
  MacroTargets,
  MeasurementType,
  Membership,
  Menu,
  MenuTemplate,
  QuestionnaireQuestion,
  Review,
  Routine,
  RoutineTemplate,
  WeightLog,
  WorkoutLog,
} from "@/lib/domain";
import {
  buildMacroTargets,
  buildMenus,
  buildRoutine,
  buildWeightLogs,
  buildWorkoutLogs,
} from "./history";
import {
  buildExercises,
  buildFoods,
  buildMeasurementTypes,
  buildMenuTemplate,
  buildQuestions,
  buildRoutineTemplates,
  routineTemplateIds,
  type SeedContext,
} from "./library";
import { CLIENT_KEYS, buildClients, buildMemberships, type ClientKey } from "./people";
import { buildReviews } from "./reviews";

/**
 * Todo lo que la siembra crea, como objetos del dominio, salvo el entrenador y las cuentas. Cada
 * backend lo traduce a su forma: documentos de Firestore o filas de Supabase.
 */
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
}

/** Plantilla de rutina, nota y macros objetivo de cada cliente. Las kcal las escribe el entrenador. */
const CLIENT_PLANS = {
  lucas: {
    routineTemplate: "fullBody3d",
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
    routineTemplate: "upperLower4d",
    routineNote: "En la búlgara, prioriza el rango completo antes que el peso.",
    macroTargets: {
      entrenamiento: { kcal: 2000, proteinG: 150, carbsG: 210, fatG: 60 },
      descanso: { kcal: 1750, proteinG: 145, carbsG: 160, fatG: 58 },
    },
    menuAdjustment: undefined,
  },
} as const;

/**
 * La siembra entera como función pura de quién es el entrenador, cuál es el ancla, qué zona usa y
 * cómo se componen los ids. No toca ningún backend: lo que devuelve ya está validado con los esquemas
 * de `lib/domain`, y cada backend solo decide qué falta por crear.
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
  const templateIds = routineTemplateIds(ctx.idPrefix);

  const routines = {} as Record<ClientKey, Routine>;
  const macroTargets: MacroTargets[] = [];
  const menus: Menu[] = [];
  const weightLogs: WeightLog[] = [];
  const workoutLogs: WorkoutLog[] = [];
  const reviews: Review[] = [];

  for (const key of CLIENT_KEYS) {
    const client = clients[key];
    const plan = CLIENT_PLANS[key];
    const template = routineTemplates.find((t) => t.id === templateIds[plan.routineTemplate])!;
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

  // I26 e I15: la unidad y el formato quedan fijos desde la primera medida o respuesta. Lo que alguna
  // revisión sembrada usa ya no es editable; cada backend lo marca a su manera.
  const measured = new Set(reviews.flatMap((r) => r.measurements.map((m) => m.measurementTypeId)));
  const answered = new Set(reviews.flatMap((r) => r.responses.map((r2) => r2.questionId)));

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
  };
}
