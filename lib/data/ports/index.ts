import type { MeasurementTypePort, QuestionnairePort } from "./catalogs";
import type { ClientPort } from "./clients";
import type { ExercisePort } from "./exercises";
import type { FoodCatalogPort, OwnFoodPort } from "./foods";
import type { InvitationPort } from "./invitations";
import type { MembershipPort } from "./memberships";
import type { PasswordResetPort } from "./password-reset";
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
export type * from "./foods";
export type * from "./invitations";
export type * from "./memberships";
export type * from "./password-reset";
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
 *
 * Contrato de las escrituras (I1, I2, I3, I20), que cualquier adaptador tiene que cumplir:
 * - Toda escritura que recibe un `clientId` comprueba que ese cliente existe y es de `trainerId`;
 *   si no, lanza `not_found`, sin decir si existe en otra cartera. Lo mismo para cualquier id que
 *   reciba: solo se escribe sobre lo propio, y lo que se archiva o activa es solo del entrenador.
 * - Una serie de entreno se registra sobre una rutina de ese cliente y de ese entrenador.
 * - Una rutina o plantilla de rutina solo prescribe ejercicios activos de la biblioteca del
 *   entrenador (I3): `routine.exercise_not_in_library`.
 * - El vídeo del feedback es un enlace http(s) (I20): `review.feedback_invalid_url`.
 * - Las identidades (`id`, `trainerId`, `clientId`) no cambian en una edición, lleguen o no.
 * - Los alimentos (I28): la copia propia solo se lee y se escribe con su `trainerId`, y en el
 *   catálogo común solo publica su autor; lo ajeno da `not_found`. El catálogo nunca devuelve quién
 *   es el autor de un alimento. Si no responde, lanza `food_catalog.unavailable` y la copia propia
 *   sigue respondiendo: ningún adaptador hace depender un puerto del otro.
 */
export interface DataPorts {
  session: SessionPort;
  invitations: InvitationPort;
  passwordReset: PasswordResetPort;
  trainer: TrainerPort;
  clients: ClientPort;
  memberships: MembershipPort;
  exercises: ExercisePort;
  ownFoods: OwnFoodPort;
  foodCatalog: FoodCatalogPort;
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
