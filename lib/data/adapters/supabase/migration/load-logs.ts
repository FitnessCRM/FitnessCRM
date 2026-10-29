import {
  reviewSchema,
  weightLogSchema,
  workoutLogSchema,
  type Review,
  type WeightLog,
  type WorkoutLog,
} from "@/lib/domain";
import { parseCollection } from "./load-catalog-plans";
import type { ExportedDocument } from "./people";
import { assertLocalUrl, upsertRows, type LoadTarget } from "./rest";
import {
  questionnaireResponseRows,
  reviewMeasurementRows,
  reviewMediaCount,
  reviewRow,
  weightLogRow,
  workoutLogRow,
} from "./to-rows";

/**
 * Revisiones, pesajes y registros de entrenamiento (tarjeta 119, Fase 8). Las fotos de las
 * revisiones no se cargan (Fase 0.1). Va después de catálogos y planes, de los que referencian ids.
 */

export const LOG_COLLECTIONS = ["weightLogs", "reviews", "workoutLogs"] as const;

export type LogCollection = (typeof LOG_COLLECTIONS)[number];

export interface LogData {
  weightLogs: WeightLog[];
  reviews: Review[];
  workoutLogs: WorkoutLog[];
}

export function parseLogData(documents: Record<LogCollection, ExportedDocument[]>): LogData {
  return {
    weightLogs: parseCollection("weightLogs", documents.weightLogs, weightLogSchema),
    reviews: parseCollection("reviews", documents.reviews, reviewSchema),
    workoutLogs: parseCollection("workoutLogs", documents.workoutLogs, workoutLogSchema),
  };
}

/**
 * Los únicos de la base de datos que se comprueban antes de escribir: un pesaje por cliente y día
 * (I23) y una revisión por cliente y semana (I16). El resto de restricciones las dice la base.
 */
export function findLogViolations(data: LogData): string[] {
  const problems: string[] = [];
  const duplicates = (label: string, keys: string[]) => {
    const seen = new Set<string>();
    for (const key of keys) {
      if (seen.has(key)) problems.push(`${label} duplicado: ${key}`);
      seen.add(key);
    }
  };
  duplicates(
    "pesaje",
    data.weightLogs.map((log) => `${log.clientId}/${log.date}`),
  );
  duplicates(
    "revisión",
    data.reviews.map((review) => `${review.clientId}/semana ${review.weekNumber}`),
  );
  return problems;
}

/** Filas por tabla, en el orden en que se escriben: pesajes antes que las revisiones que los citan. */
export function logRowSets(data: LogData) {
  return [
    { table: "weight_logs", onConflict: "id", rows: data.weightLogs.map(weightLogRow) },
    { table: "reviews", onConflict: "id", rows: data.reviews.map(reviewRow) },
    {
      table: "review_measurements",
      onConflict: "id",
      rows: data.reviews.flatMap(reviewMeasurementRows),
    },
    {
      table: "questionnaire_responses",
      onConflict: "id",
      rows: data.reviews.flatMap(questionnaireResponseRows),
    },
    { table: "workout_logs", onConflict: "id", rows: data.workoutLogs.map(workoutLogRow) },
  ];
}

export function reviewPhotosLeftOut(data: LogData): number {
  return reviewMediaCount(data.reviews);
}

/** Escribe pesajes, revisiones (con sus medidas y respuestas) y registros. Devuelve filas por tabla. */
export async function loadReviewsAndLogs(
  data: LogData,
  target: LoadTarget,
): Promise<Record<string, number>> {
  assertLocalUrl(target.url);
  const problems = findLogViolations(data);
  if (problems.length > 0) {
    throw new Error(`Hay registros que no cumplen los invariantes: ${problems.join("; ")}.`);
  }

  const counts: Record<string, number> = {};
  for (const set of logRowSets(data)) {
    await upsertRows(target, set.table, set.onConflict, set.rows);
    counts[set.table] = set.rows.length;
  }
  return counts;
}
