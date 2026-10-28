import { describe, expect, it } from "vitest";
import {
  exerciseFromRow,
  foodFromRow,
  measurementTypeFromRow,
  questionFromRow,
  type ExerciseRow,
  type FoodRow,
  type MeasurementTypeRow,
  type QuestionRow,
} from "./catalog-rows";

const TRAINER = "11111111-1111-1111-1111-111111111111";
const ID = "22222222-2222-2222-2222-222222222222";

describe("exerciseFromRow", () => {
  const row: ExerciseRow = {
    id: ID,
    trainer_id: TRAINER,
    name: "Sentadilla",
    muscle_group: "Pierna",
    equipment: "barra",
    video_url: null,
    description: "",
    status: "activo",
    created_at: "2026-01-05T10:00:00.123456+00:00",
  };

  it("maps the row to the domain exercise, with no video and UTC timestamp", () => {
    expect(exerciseFromRow(row)).toEqual({
      id: ID,
      trainerId: TRAINER,
      name: "Sentadilla",
      muscleGroup: "Pierna",
      equipment: "barra",
      videoUrl: null,
      description: "",
      status: "activo",
      createdAt: "2026-01-05T10:00:00.123Z",
    });
  });

  it("refuses a video that is not an http(s) link (I20)", () => {
    expect(() => exerciseFromRow({ ...row, video_url: "ftp://x.test/v" })).toThrow();
  });
});

describe("foodFromRow", () => {
  const row: FoodRow = {
    id: ID,
    trainer_id: TRAINER,
    name: "Avena",
    kcal: 370,
    protein_g: 13,
    carbs_g: 60,
    fat_g: 7,
    status: "activo",
    publish_status: "pendiente",
    created_at: "2026-01-05T10:00:00+00:00",
    updated_at: "2026-10-02T09:00:00.123456+00:00",
  };

  it("groups the four figures into the composition and keeps the version", () => {
    expect(foodFromRow(row)).toEqual({
      id: ID,
      trainerId: TRAINER,
      name: "Avena",
      composition: { kcal: 370, proteinG: 13, carbsG: 60, fatG: 7 },
      status: "activo",
      publishStatus: "pendiente",
      createdAt: "2026-01-05T10:00:00.000Z",
      updatedAt: "2026-10-02T09:00:00.123Z",
    });
  });

  it("refuses macros over 100 g per 100 g, as the domain does", () => {
    expect(() => foodFromRow({ ...row, protein_g: 60, carbs_g: 60 })).toThrow();
  });
});

describe("measurementTypeFromRow", () => {
  it("maps sort_order to the domain order", () => {
    const row: MeasurementTypeRow = {
      id: ID,
      trainer_id: TRAINER,
      label: "Cintura",
      unit: "cm",
      sort_order: 2,
      status: "archivada",
      has_measurements: true,
      created_at: "2026-01-05T10:00:00+00:00",
    };
    expect(measurementTypeFromRow(row)).toMatchObject({
      label: "Cintura",
      unit: "cm",
      order: 2,
      status: "archivada",
    });
  });
});

describe("questionFromRow", () => {
  const base: QuestionRow = {
    id: ID,
    trainer_id: TRAINER,
    prompt: "Sueño",
    format_kind: "texto",
    scale_min: null,
    scale_max: null,
    sort_order: 0,
    status: "activa",
    has_responses: false,
    created_at: "2026-01-05T10:00:00+00:00",
  };

  it("reads a text question with no scale", () => {
    expect(questionFromRow(base)).toMatchObject({ format: { kind: "texto" }, order: 0 });
  });

  it("reads a scale question with its limits", () => {
    expect(
      questionFromRow({ ...base, format_kind: "escala", scale_min: 1, scale_max: 10 }),
    ).toMatchObject({ format: { kind: "escala", min: 1, max: 10 } });
  });
});
