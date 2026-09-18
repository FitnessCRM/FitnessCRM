import type {
  Client,
  Exercise,
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
import type { Session } from "@/lib/data/ports";
import { measurementTypes, questions } from "./demo-data/catalogs";
import { CLIENT_IDS, DEMO_TODAY, TRAINER_ID } from "./demo-data/common";
import { exercises } from "./demo-data/exercises";
import { macroTargets, menuTemplates, menus } from "./demo-data/nutrition";
import { otherReviews, workoutLogs } from "./demo-data/others";
import { clients, memberships, trainer } from "./demo-data/people";
import { reviews, weightLogs } from "./demo-data/reviews";
import { routineTemplates, routines } from "./demo-data/routines";

/** Todo el estado del adaptador en memoria. Se muta en sitio; los puertos devuelven copias. */
export interface MockState {
  session: Session;
  /** "Hoy" del adaptador: fija qué semana es la actual al abrir una revisión. */
  today: string;
  trainers: Trainer[];
  clients: Client[];
  memberships: Membership[];
  exercises: Exercise[];
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

/** Estado inicial con los datos de la demo navegable. Cada llamada devuelve una copia fresca. */
export function createDemoState(): MockState {
  return clone({
    session: { trainerId: TRAINER_ID, clientId: CLIENT_IDS.marta },
    today: DEMO_TODAY,
    trainers: [trainer],
    clients,
    memberships,
    exercises,
    routines,
    macroTargets,
    menus,
    routineTemplates,
    menuTemplates,
    measurementTypes,
    questions,
    reviews: [...reviews, ...otherReviews],
    weightLogs,
    workoutLogs,
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

export { clone };
