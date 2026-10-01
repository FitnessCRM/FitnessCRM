import type { ClientTrackingQuery, MembershipQuery } from "@/lib/data/ports";

/** Claves de TanStack Query. Todas empiezan por el `trainerId` de la sesión salvo la sesión misma. */
export const queryKeys = {
  session: ["session"] as const,
  trainer: (trainerId: string) => ["trainer", trainerId] as const,
  clients: (trainerId: string) => ["clients", trainerId] as const,
  clientsTracking: (trainerId: string, query: ClientTrackingQuery) =>
    ["clients", trainerId, "tracking", query] as const,
  client: (trainerId: string, clientId: string) => ["clients", trainerId, clientId] as const,
  memberships: (trainerId: string) => ["memberships", trainerId] as const,
  membershipsWithClients: (trainerId: string, query: MembershipQuery) =>
    ["memberships", trainerId, "with-clients", query] as const,
  clientMemberships: (trainerId: string, clientId: string) =>
    ["memberships", trainerId, "client", clientId] as const,
  exercises: (trainerId: string) => ["exercises", trainerId] as const,
  exercisesById: (trainerId: string, exerciseIds: readonly string[]) =>
    ["exercises", trainerId, "ids", ...exerciseIds] as const,
  exerciseUsage: (trainerId: string, exerciseId: string) =>
    ["exercises", trainerId, exerciseId, "usage"] as const,
  routines: (trainerId: string, clientId: string) => ["routines", trainerId, clientId] as const,
  activeRoutine: (trainerId: string, clientId: string) =>
    ["routines", trainerId, clientId, "active"] as const,
  macroTargets: (trainerId: string, clientId: string) =>
    ["macro-targets", trainerId, clientId] as const,
  menus: (trainerId: string, clientId: string) => ["menus", trainerId, clientId] as const,
  editableMenus: (trainerId: string, clientId: string) =>
    ["menus", trainerId, clientId, "editable"] as const,
  routineTemplates: (trainerId: string) => ["routine-templates", trainerId] as const,
  menuTemplates: (trainerId: string) => ["menu-templates", trainerId] as const,
  measurementTypes: (trainerId: string) => ["measurement-types", trainerId] as const,
  questions: (trainerId: string) => ["questions", trainerId] as const,
  questionsWithResponses: (trainerId: string, questionIds: readonly string[]) =>
    ["questions", trainerId, "with-responses", ...questionIds] as const,
  reviews: (trainerId: string) => ["reviews", trainerId] as const,
  clientReviews: (trainerId: string, clientId: string) =>
    ["reviews", trainerId, "client", clientId] as const,
  currentReview: (trainerId: string, clientId: string) =>
    ["reviews", trainerId, "current", clientId] as const,
  submittedReviews: (trainerId: string) => ["reviews", trainerId, "submitted"] as const,
  review: (trainerId: string, reviewId: string) => ["reviews", trainerId, "id", reviewId] as const,
  weightLogs: (trainerId: string, clientId: string) =>
    ["weight-logs", trainerId, clientId] as const,
  workoutLogs: (trainerId: string, clientId: string, routineId: string) =>
    ["workout-logs", trainerId, clientId, routineId] as const,
};
