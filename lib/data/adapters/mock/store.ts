import type {
  MembershipRate,
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
  Trainer,
  WeightLog,
  WorkoutLog,
} from "@/lib/domain";
import { civilDateInTimeZone, type CivilDate } from "@/lib/domain";
import type { Session } from "@/lib/data/ports";
import { measurementTypes, questions } from "./demo-data/catalogs";
import { CLIENT_IDS, DEMO_TZ, TRAINER_ID, demoDates } from "./demo-data/common";
import { exercises } from "./demo-data/exercises";
import { buildFoods, type CatalogEntry } from "./demo-data/foods";
import { buildNutrition } from "./demo-data/nutrition";
import { buildOtherReviews, buildWorkoutLogs } from "./demo-data/others";
import { buildClients, buildMemberships, trainer } from "./demo-data/people";
import { buildDemoClientReviews, buildWeightLogs } from "./demo-data/reviews";
import { buildRoutines } from "./demo-data/routines";

/**
 * Invitación de entrenador que deja la administración de la plataforma (docs/dominio.md §12). No es
 * una entidad del dominio: la escribe otra app, y esta solo la acepta.
 */
export interface MockTrainerInvitation {
  /** En minúsculas, como el id del documento en Firestore. */
  email: string;
  name: string;
  timeZone: string;
  status: "invitado" | "aceptada";
  createdAt: string;
  trainerId?: string;
  acceptedAt?: string;
}

/** Todo el estado del adaptador en memoria. Se muta en sitio; los puertos devuelven copias. */
export interface MockState {
  session: Session;
  trainers: Trainer[];
  /** La demo no trae ninguna: las añade quien quiera probar el alta de un entrenador. */
  trainerInvitations: MockTrainerInvitation[];
  clients: Client[];
  memberships: Membership[];
  /** Tarifas del entrenador (E1). */
  membershipRates: MembershipRate[];
  /**
   * Entrenadores con el cobro en línea conectado (tarjeta 125). La demo empieza conectada: cada área
   * monta su propio estado, y así el cliente de la demo puede pagar.
   */
  onlinePaymentsConnected: string[];
  exercises: Exercise[];
  /** La copia propia de los alimentos de cada entrenador. */
  foods: Food[];
  /** El catálogo común: lo publicado por todos los entrenadores, con su autor para I28, y lo sembrado. */
  catalogFoods: CatalogEntry[];
  routines: Routine[];
  macroTargets: MacroTargets[];
  menus: Menu[];
  routineTemplates: RoutineTemplate[];
  menuTemplates: MenuTemplate[];
  measurementTypes: MeasurementType[];
  questions: QuestionnaireQuestion[];
  reviews: Review[];
  weightLogs: WeightLog[];
  workoutLogs: WorkoutLog[];
}

const clone = <T>(value: T): T => structuredClone(value);

/** "Hoy" del adaptador: la fecha civil actual en la zona del entrenador de la demo. */
export function demoToday(): CivilDate {
  return civilDateInTimeZone(new Date(), DEMO_TZ);
}

/**
 * Estado inicial con los datos de la demo navegable, generados relativos a `today` para que
 * la maqueta no envejezca. Cada llamada devuelve una copia fresca.
 */
export function createDemoState(today: CivilDate = demoToday()): MockState {
  const d = demoDates(today);
  const { routineTemplates, routines } = buildRoutines(d);
  const { macroTargets, menus, menuTemplates } = buildNutrition(d);
  const { foods, catalogFoods } = buildFoods(d);
  return clone({
    // La demo es el entrenador con un cliente a mano: puede recorrer las dos áreas.
    session: { trainerId: TRAINER_ID, clientId: CLIENT_IDS.marta, role: "trainer" },
    trainers: [trainer],
    trainerInvitations: [],
    clients: buildClients(d),
    memberships: buildMemberships(d),
    // Demo: mensual y trimestral se pueden pagar; semestral está desactivada y anual, sin precio.
    onlinePaymentsConnected: [TRAINER_ID],
    membershipRates: [
      { trainerId: TRAINER_ID, type: "mensual", active: true, priceCents: 4900 },
      { trainerId: TRAINER_ID, type: "trimestral", active: true, priceCents: 12900 },
      { trainerId: TRAINER_ID, type: "semestral", active: false, priceCents: 23900 },
    ],
    exercises,
    foods,
    catalogFoods,
    routines,
    macroTargets,
    menus,
    routineTemplates,
    menuTemplates,
    measurementTypes,
    questions,
    reviews: [...buildDemoClientReviews(d), ...buildOtherReviews(d)],
    weightLogs: buildWeightLogs(d),
    workoutLogs: buildWorkoutLogs(d),
  });
}

/** Lo que cada puerto del adaptador necesita. */
export interface MockContext {
  state: MockState;
  newId: () => string;
  now: () => string;
  /** Aplica la latencia simulada y devuelve una copia para que nadie mute el estado desde fuera. */
  reply: <T>(value: T) => Promise<T>;
}

export type { CatalogEntry };
export { clone };
