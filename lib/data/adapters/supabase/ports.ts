import type { DataPorts } from "@/lib/data/ports";
import { createInvitationPort, createPasswordResetPort } from "./auth";
import { createMeasurementTypePort, createQuestionnairePort } from "./catalogs";
import { createClientPort } from "./clients";
import { createSupabaseClient, type SupabaseConfig } from "./client";
import { createExercisePort } from "./exercises";
import { createUnavailableFoodCatalogPort } from "./food-catalog";
import { createOwnFoodPort } from "./foods";
import { createWeightLogPort, createWorkoutLogPort } from "./logs";
import { createMembershipPort } from "./memberships";
import { createMacroTargetsPort, createMenuPort, createRoutinePort } from "./plans";
import { createReviewPort } from "./reviews";
import { createSessionPort } from "./session";
import { createTemplatePort } from "./templates";
import { createTrainerPort } from "./trainer";

export interface SupabasePortsOptions {
  config: SupabaseConfig;
  /** Página de la app que recibe el enlace para recuperar la contraseña, con su origen. */
  passwordResetRedirect: string;
}

/** Los 18 puertos de la aplicación, todos sobre un único cliente de Supabase. */
export function createSupabasePorts(options: SupabasePortsOptions): DataPorts {
  const client = createSupabaseClient(options.config);
  return {
    session: createSessionPort(client),
    invitations: createInvitationPort(client),
    passwordReset: createPasswordResetPort(client, { redirectTo: options.passwordResetRedirect }),
    trainer: createTrainerPort(client),
    clients: createClientPort(client),
    memberships: createMembershipPort(client),
    exercises: createExercisePort(client),
    ownFoods: createOwnFoodPort(client),
    foodCatalog: createUnavailableFoodCatalogPort(),
    routines: createRoutinePort(client),
    macroTargets: createMacroTargetsPort(client),
    menus: createMenuPort(client),
    templates: createTemplatePort(client),
    measurementTypes: createMeasurementTypePort(client),
    questionnaire: createQuestionnairePort(client),
    reviews: createReviewPort(client),
    weightLogs: createWeightLogPort(client),
    workoutLogs: createWorkoutLogPort(client),
  };
}

/**
 * Lo que `app/providers.tsx` monta con `NEXT_PUBLIC_DATA_BACKEND=supabase`. Las lecturas son literales
 * porque Next solo sustituye `process.env.NEXT_PUBLIC_*` escrito tal cual. Solo se llama en el navegador.
 */
export function createSupabasePortsFromEnv(): DataPorts {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createSupabasePorts({
    config: { url, anonKey },
    passwordResetRedirect: `${window.location.origin}/reset-password`,
  });
}
