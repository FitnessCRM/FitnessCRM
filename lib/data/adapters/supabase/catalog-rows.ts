import {
  exerciseSchema,
  foodSchema,
  measurementTypeSchema,
  questionnaireQuestionSchema,
  type Exercise,
  type Food,
  type MeasurementType,
  type QuestionnaireQuestion,
} from "@/lib/domain";

/** Columnas que leen los puertos de catálogo. */
export const EXERCISE_COLUMNS =
  "id, trainer_id, name, muscle_group, equipment, video_url, description, status, created_at";

export const FOOD_COLUMNS =
  "id, trainer_id, name, kcal, protein_g, carbs_g, fat_g, status, publish_status, created_at, updated_at";

export const MEASUREMENT_TYPE_COLUMNS =
  "id, trainer_id, label, unit, sort_order, status, has_measurements, created_at";

export const QUESTION_COLUMNS =
  "id, trainer_id, prompt, format_kind, scale_min, scale_max, sort_order, status, has_responses, created_at";

/** `timestamptz` a ISO con `Z`, como en `rows.ts`. */
const isoOf = (value: string) => new Date(value).toISOString();

export interface ExerciseRow {
  id: string;
  trainer_id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  video_url: string | null;
  description: string;
  status: string;
  created_at: string;
}

export interface FoodRow {
  id: string;
  trainer_id: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  status: string;
  publish_status: string;
  created_at: string;
  updated_at: string;
}

export interface MeasurementTypeRow {
  id: string;
  trainer_id: string;
  label: string;
  unit: string;
  sort_order: number;
  status: string;
  has_measurements: boolean;
  created_at: string;
}

export interface QuestionRow {
  id: string;
  trainer_id: string;
  prompt: string;
  format_kind: string;
  scale_min: number | null;
  scale_max: number | null;
  sort_order: number;
  status: string;
  has_responses: boolean;
  created_at: string;
}

export function exerciseFromRow(row: ExerciseRow): Exercise {
  return exerciseSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    name: row.name,
    muscleGroup: row.muscle_group,
    equipment: row.equipment,
    videoUrl: row.video_url,
    description: row.description,
    status: row.status,
    createdAt: isoOf(row.created_at),
  });
}

export function foodFromRow(row: FoodRow): Food {
  return foodSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    name: row.name,
    composition: {
      kcal: row.kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
    },
    status: row.status,
    publishStatus: row.publish_status,
    createdAt: isoOf(row.created_at),
    updatedAt: isoOf(row.updated_at),
  });
}

export function measurementTypeFromRow(row: MeasurementTypeRow): MeasurementType {
  return measurementTypeSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    label: row.label,
    unit: row.unit,
    order: row.sort_order,
    status: row.status,
    createdAt: isoOf(row.created_at),
  });
}

export function questionFromRow(row: QuestionRow): QuestionnaireQuestion {
  return questionnaireQuestionSchema.parse({
    id: row.id,
    trainerId: row.trainer_id,
    prompt: row.prompt,
    format:
      row.format_kind === "escala"
        ? { kind: "escala", min: row.scale_min, max: row.scale_max }
        : { kind: "texto" },
    order: row.sort_order,
    status: row.status,
    createdAt: isoOf(row.created_at),
  });
}
