import type { DataPorts } from "@/lib/data/ports";
import { createFirebaseAuthContext, createInvitationPort, createSessionPort } from "./auth";
import { createMeasurementTypePort, createQuestionnairePort } from "./catalogs";
import { createClientPort } from "./clients";
import { createFirestore, firebaseConfigFromEnv, type FirebaseConfig } from "./config";
import { createFirebaseContext } from "./context";
import { createExercisePort } from "./exercises";
import { createWeightLogPort, createWorkoutLogPort } from "./logs";
import { createMembershipPort } from "./memberships";
import { createMacroTargetsPort, createMenuPort, createRoutinePort } from "./plans";
import { createReviewPort } from "./reviews";
import { createTemplatePort } from "./templates";
import { createTrainerPort } from "./trainer";

export interface FirebasePortsOptions {
  /** Basta el `projectId`: con el emulador no hace falta más, y en producción lo completa el entorno. */
  config: Pick<FirebaseConfig, "projectId"> & Partial<FirebaseConfig>;
  /** Página de la app a la que lleva el enlace de la invitación, con su origen. */
  inviteUrl: string;
  /** Si se da, la app habla con los emuladores locales de Firestore (8080) y Auth (9099). */
  emulatorHost?: string;
  /** Nombre de la app de Firebase: distinto para tener varias a la vez (los tests). */
  appName?: string;
}

/** Los 15 puertos de la aplicación sobre Firestore y Firebase Auth. */
export function createFirebasePorts(options: FirebasePortsOptions): DataPorts {
  const { config, inviteUrl, emulatorHost, appName } = options;
  const db = createFirestore(config, {
    appName,
    emulator: emulatorHost ? { host: emulatorHost, port: 8080 } : undefined,
  });
  const ctx = createFirebaseContext(db);
  const authCtx = createFirebaseAuthContext(ctx, {
    appName,
    inviteUrl,
    emulatorUrl: emulatorHost ? `http://${emulatorHost}:9099` : undefined,
  });
  return {
    session: createSessionPort(authCtx),
    invitations: createInvitationPort(authCtx),
    trainer: createTrainerPort(ctx),
    clients: createClientPort(ctx),
    memberships: createMembershipPort(ctx),
    exercises: createExercisePort(ctx),
    routines: createRoutinePort(ctx),
    macroTargets: createMacroTargetsPort(ctx),
    menus: createMenuPort(ctx),
    templates: createTemplatePort(ctx),
    measurementTypes: createMeasurementTypePort(ctx),
    questionnaire: createQuestionnairePort(ctx),
    reviews: createReviewPort(ctx),
    weightLogs: createWeightLogPort(ctx),
    workoutLogs: createWorkoutLogPort(ctx),
  };
}

/**
 * Lo que `app/providers.tsx` monta: la configuración sale de las variables `NEXT_PUBLIC_FIREBASE_*`
 * y, si hay `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST`, se habla con los emuladores locales sin necesitar
 * las claves del proyecto: el proyecto de los emuladores es `demo-hector` (o el de
 * `NEXT_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID`) aunque haya un proyecto real en el entorno, porque los
 * datos de cada proyecto están separados. Las lecturas son literales porque Next solo sustituye
 * `process.env.NEXT_PUBLIC_*` escrito tal cual. Solo se llama en el navegador.
 */
export function createFirebasePortsFromEnv(): DataPorts {
  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST || undefined;
  const config = emulatorHost
    ? {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_PROJECT_ID || "demo-hector",
        apiKey: "demo-api-key",
      }
    : firebaseConfigFromEnv();
  return createFirebasePorts({
    config,
    emulatorHost,
    inviteUrl: `${window.location.origin}/accept-invite`,
  });
}
