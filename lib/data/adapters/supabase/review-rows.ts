import {
  reviewSchema,
  weightLogSchema,
  workoutLogSchema,
  type Review,
  type WeightLog,
  type WorkoutLog,
} from "@/lib/domain";

/** `timestamptz` a ISO con `Z`, como en `catalog-rows.ts`. */
const isoOf = (value: string) => new Date(value).toISOString();
const isoOrNull = (value: string | null) => (value === null ? null : isoOf(value));

/**
 * Una revisión con sus hijos embebidos: fotos, medidas y respuestas. Las tres tablas cuelgan de la
 * revisión por clave foránea, así que PostgREST las embebe sin ambigüedad.
 */
export const REVIEW_SELECT = `
  id, trainer_id, client_id, week_number, window_start, window_end, status,
  required_measurement_type_ids, required_question_ids, weight_log_id,
  frozen_weight_kg, frozen_weight_date, feedback_video_url, feedback_note,
  created_at, submitted_at, viewed_at, reviewed_at,
  review_media (id, pose, storage_path, uploaded_at),
  review_measurements (id, measurement_type_id, value, label, unit),
  questionnaire_responses (
    id, question_id, prompt, format_kind, scale_min, scale_max, value_number, value_text
  )
`;

export const WEIGHT_LOG_COLUMNS =
  "id, trainer_id, client_id, log_date, weight_kg, note, created_at";

export const WORKOUT_LOG_COLUMNS =
  "id, trainer_id, client_id, exercise_id, routine_id, routine_day_exercise_id, log_date, set_number, weight_kg, reps, created_at";

const POSE_ORDER: readonly string[] = ["frente", "perfil", "espalda"];

interface ReviewMediaRow {
  id: string;
  pose: string;
  storage_path: string;
  uploaded_at: string;
}

interface ReviewMeasurementRow {
  id: string;
  measurement_type_id: string;
  value: number;
  label: string;
  unit: string;
}

interface QuestionnaireResponseRow {
  id: string;
  question_id: string;
  prompt: string;
  format_kind: string;
  scale_min: number | null;
  scale_max: number | null;
  value_number: number | null;
  value_text: string | null;
}

export interface ReviewRow {
  id: string;
  trainer_id: string;
  client_id: string;
  week_number: number;
  window_start: string;
  window_end: string;
  status: string;
  required_measurement_type_ids: string[];
  required_question_ids: string[];
  weight_log_id: string | null;
  frozen_weight_kg: number | null;
  frozen_weight_date: string | null;
  feedback_video_url: string | null;
  feedback_note: string;
  created_at: string;
  submitted_at: string | null;
  viewed_at: string | null;
  reviewed_at: string | null;
  review_media: ReviewMediaRow[];
  review_measurements: ReviewMeasurementRow[];
  questionnaire_responses: QuestionnaireResponseRow[];
}

export interface WeightLogRow {
  id: string;
  trainer_id: string;
  client_id: string;
  log_date: string;
  weight_kg: number;
  note: string;
  created_at: string;
}

export interface WorkoutLogRow {
  id: string;
  trainer_id: string;
  client_id: string;
  exercise_id: string;
  routine_id: string;
  routine_day_exercise_id: string;
  log_date: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  created_at: string;
}

/**
 * La foto se guarda por su ruta en Storage: `url` lleva esa ruta. El enlace que ve el entrenador se
 * firma al leerla, no aquí.
 */
function mediaFromRow(row: ReviewMediaRow) {
  return {
    id: row.id,
    pose: row.pose,
    url: row.storage_path,
    uploadedAt: isoOf(row.uploaded_at),
  };
}

function responseFromRow(row: QuestionnaireResponseRow) {
  const base = { id: row.id, questionId: row.question_id, prompt: row.prompt };
  if (row.format_kind === "escala") {
    return {
      ...base,
      format: { kind: "escala", min: row.scale_min, max: row.scale_max },
      value: row.value_number,
    };
  }
  return { ...base, format: { kind: "texto" }, value: row.value_text };
}

export function reviewFromRow(row: ReviewRow): Review {
  const frozenWeight =
    row.frozen_weight_kg === null || row.frozen_weight_date === null
      ? null
      : { weightKg: row.frozen_weight_kg, date: row.frozen_weight_date };

  return reviewSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    clientId: row.client_id,
    weekNumber: row.week_number,
    window: { start: row.window_start, end: row.window_end },
    status: row.status,
    requirements: {
      measurementTypeIds: row.required_measurement_type_ids,
      questionIds: row.required_question_ids,
    },
    media: [...row.review_media]
      .sort((a, b) => POSE_ORDER.indexOf(a.pose) - POSE_ORDER.indexOf(b.pose))
      .map(mediaFromRow),
    weightLogId: row.weight_log_id,
    frozenWeight,
    measurements: row.review_measurements.map((m) => ({
      id: m.id,
      measurementTypeId: m.measurement_type_id,
      value: m.value,
      label: m.label,
      unit: m.unit,
    })),
    responses: row.questionnaire_responses.map(responseFromRow),
    feedbackVideoUrl: row.feedback_video_url,
    feedbackNote: row.feedback_note,
    createdAt: isoOf(row.created_at),
    submittedAt: isoOrNull(row.submitted_at),
    viewedAt: isoOrNull(row.viewed_at),
    reviewedAt: isoOrNull(row.reviewed_at),
  });
}

export function weightLogFromRow(row: WeightLogRow): WeightLog {
  return weightLogSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    clientId: row.client_id,
    date: row.log_date,
    weightKg: row.weight_kg,
    note: row.note,
    createdAt: isoOf(row.created_at),
  });
}

export function workoutLogFromRow(row: WorkoutLogRow): WorkoutLog {
  return workoutLogSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    clientId: row.client_id,
    exerciseId: row.exercise_id,
    routineId: row.routine_id,
    routineDayExerciseId: row.routine_day_exercise_id,
    date: row.log_date,
    setNumber: row.set_number,
    weightKg: row.weight_kg,
    reps: row.reps,
    createdAt: isoOf(row.created_at),
  });
}
