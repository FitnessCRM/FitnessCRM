import type { z } from "zod";
import { SEED_PREFIX } from "@/lib/data/seed/ids";
import type { SeedContext, SeedIdFormats } from "@/lib/data/seed/library";
import { buildSeedPlan, type SeedPlan } from "@/lib/data/seed/plan";
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
} from "@/lib/domain";
import { COLLECTIONS, FLAGS } from "../helpers";
import { weightLogDocId, workoutLogDocId } from "../logs";
import { reviewDocId } from "../reviews";

/**
 * La siembra de la demo en forma de Firestore (tarjeta 104). Los datos los construye
 * `lib/data/seed/`, que no sabe de ningún backend; aquí se deciden los ids, las colecciones, las
 * banderas y los `users/{uid}`.
 */

/** El entrenador de la demo. La siembra es para esta cuenta y no para otra. */
export const TRAINER_EMAIL = "h.damaso@gmail.com";

/** Los clientes de la demo de Firebase. Son los de la primera ejecución: no se cambian. */
export const FIREBASE_CLIENT_EMAILS: SeedContext["clientEmails"] = {
  lucas: "daniel2003ml+lucas@gmail.com",
  irene: "daniel2003ml+irene@gmail.com",
};

/** Pesajes, series y revisiones llevan como id la clave compuesta que usa el adaptador. */
export const FIRESTORE_SEED_IDS: SeedIdFormats = {
  weightLog: weightLogDocId,
  workoutLog: workoutLogDocId,
  review: reviewDocId,
};

/** Lo que la siembra de Firestore recibe de fuera; el resto del contexto es fijo. */
export type FirestoreSeedBase = Omit<SeedContext, "idPrefix" | "ids" | "clientEmails">;

/** El contexto de la siembra en Firestore: ids con `seed-` y correos, los de la primera ejecución. */
export const firestoreSeedContext = (base: FirestoreSeedBase): SeedContext => ({
  ...base,
  idPrefix: SEED_PREFIX,
  ids: FIRESTORE_SEED_IDS,
  clientEmails: FIREBASE_CLIENT_EMAILS,
});

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
export interface FirestoreSeedPlan extends SeedPlan {
  /** En el orden en que se escriben: primero la biblioteca, al final lo que depende de todo. */
  docs: SeedDoc[];
}

export function buildFirestoreSeedPlan(base: FirestoreSeedBase): FirestoreSeedPlan {
  const plan = buildSeedPlan(firestoreSeedContext(base));
  const { measured, answered } = plan;

  const docsOf = <T extends { id: string }>(
    collection: string,
    schema: z.ZodType,
    items: readonly T[],
    extra: (item: T) => Record<string, unknown> = () => ({}),
  ): SeedDoc[] =>
    items.map((item) => ({ collection, id: item.id, schema, data: { ...item, ...extra(item) } }));

  // I26 e I15: la app sube estas banderas al guardar la revisión; aquí las revisiones se escriben
  // directamente, así que nacen `true` las de lo que alguna revisión usa, y `false` las demás, que
  // siguen editables.
  const docs: SeedDoc[] = [
    ...docsOf(COLLECTIONS.exercises, exerciseSchema, plan.exercises),
    ...docsOf(COLLECTIONS.foods, foodSchema, plan.foods),
    ...docsOf(COLLECTIONS.measurementTypes, measurementTypeSchema, plan.measurementTypes, (t) => ({
      [FLAGS.hasMeasurements]: measured.has(t.id),
    })),
    ...docsOf(COLLECTIONS.questions, questionnaireQuestionSchema, plan.questions, (q) => ({
      [FLAGS.hasResponses]: answered.has(q.id),
    })),
    ...docsOf(COLLECTIONS.routineTemplates, routineTemplateSchema, plan.routineTemplates),
    ...docsOf(COLLECTIONS.menuTemplates, menuTemplateSchema, [plan.menuTemplate]),
    ...docsOf(COLLECTIONS.clients, clientSchema, Object.values(plan.clients)),
    ...docsOf(COLLECTIONS.memberships, membershipSchema, plan.memberships),
    ...docsOf(COLLECTIONS.routines, routineSchema, Object.values(plan.routines)),
    ...docsOf(COLLECTIONS.macroTargets, macroTargetsSchema, plan.macroTargets),
    ...docsOf(COLLECTIONS.menus, menuSchema, plan.menus),
    ...docsOf(COLLECTIONS.weightLogs, weightLogSchema, plan.weightLogs),
    ...docsOf(COLLECTIONS.workoutLogs, workoutLogSchema, plan.workoutLogs),
    ...docsOf(COLLECTIONS.reviews, reviewSchema, plan.reviews),
  ];

  return { ...plan, docs };
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

/**
 * `users/{uid}`: el puente entre una cuenta de Auth y una persona (§12). No es una entidad del
 * dominio y no tiene esquema; estas son las formas que leen `auth.ts` y las reglas de seguridad.
 */
export interface UserLink {
  role: "trainer" | "client";
  trainerId: string;
  clientId: string | null;
  email: string;
}

export const trainerUserLink = (trainerId: string, email: string): UserLink => ({
  role: "trainer",
  trainerId,
  clientId: null,
  email,
});

/** Exactamente las cuatro claves que exigen las reglas a quien acepta una invitación. */
export const clientUserLink = (client: Client): UserLink => ({
  role: "client",
  trainerId: client.trainerId,
  clientId: client.id,
  email: client.email,
});
