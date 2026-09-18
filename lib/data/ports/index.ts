import type { MeasurementTypePort, QuestionnairePort } from "./catalogs";
import type { ClientPort } from "./clients";
import type { ExercisePort } from "./exercises";
import type { MembershipPort } from "./memberships";
import type { MacroTargetsPort, MenuPort, RoutinePort } from "./plans";
import type { ReviewPort } from "./reviews";
import type { SessionPort } from "./session";
import type { TemplatePort } from "./templates";
import type { TrainerPort } from "./trainer";
import type { WeightLogPort } from "./weight-logs";
import type { WorkoutLogPort } from "./workout-logs";

export type * from "./catalogs";
export type * from "./clients";
export type * from "./exercises";
export type * from "./memberships";
export type * from "./plans";
export type * from "./reviews";
export type * from "./session";
export type * from "./templates";
export type * from "./trainer";
export type * from "./weight-logs";
export type * from "./workout-logs";

/**
 * Conjunto de puertos que la aplicación consume. Cambiar de backend es implementar esta
 * interfaz de nuevo; ningún componente ni hook conoce quién hay detrás.
 */
export interface DataPorts {
  session: SessionPort;
  trainer: TrainerPort;
  clients: ClientPort;
  memberships: MembershipPort;
  exercises: ExercisePort;
  routines: RoutinePort;
  macroTargets: MacroTargetsPort;
  menus: MenuPort;
  templates: TemplatePort;
  measurementTypes: MeasurementTypePort;
  questionnaire: QuestionnairePort;
  reviews: ReviewPort;
  weightLogs: WeightLogPort;
  workoutLogs: WorkoutLogPort;
}
