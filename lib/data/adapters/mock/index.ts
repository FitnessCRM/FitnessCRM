import type { DataPorts } from "@/lib/data/ports";
import { createMeasurementTypePort, createQuestionnairePort } from "./catalogs";
import { createExercisePort } from "./exercises";
import { createIdFactory } from "./ids";
import { createWeightLogPort, createWorkoutLogPort } from "./logs";
import {
  createClientPort,
  createMembershipPort,
  createSessionPort,
  createTrainerPort,
} from "./people";
import { createMacroTargetsPort, createMenuPort, createRoutinePort } from "./plans";
import { createReviewPort } from "./reviews";
import { clone, createDemoState, type MockContext, type MockState } from "./store";
import { createTemplatePort } from "./templates";

export interface MockPortsOptions {
  /** Estado inicial. Por defecto, los datos de la demo navegable relativos a `today`. */
  state?: MockState;
  /** Fecha civil de "hoy" para generar los datos de demo. Por defecto, la actual. */
  today?: string;
  now?: () => string;
}

/** Adaptador en memoria: implementa todos los puertos sobre un estado mutable en proceso. */
export function createMockPorts(options: MockPortsOptions = {}): DataPorts & { state: MockState } {
  const state = options.state ?? createDemoState(options.today);
  const ctx: MockContext = {
    state,
    newId: createIdFactory(),
    now: options.now ?? (() => new Date().toISOString()),
    reply: (value) => Promise.resolve(clone(value)),
  };
  return {
    state,
    session: createSessionPort(ctx),
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

export { createDemoState, demoToday } from "./store";
export type { MockState } from "./store";
