import { describe, expect, it } from "vitest";
import {
  reviewFromRow,
  weightLogFromRow,
  workoutLogFromRow,
  type ReviewRow,
  type WeightLogRow,
  type WorkoutLogRow,
} from "./review-rows";

const TRAINER = "11111111-1111-1111-1111-111111111111";
const CLIENT = "22222222-2222-2222-2222-222222222222";
const REVIEW = "33333333-3333-3333-3333-333333333333";
const LOG = "44444444-4444-4444-4444-444444444444";
const CREATED = "2026-10-05T09:00:00.123456+00:00";

function reviewRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    id: REVIEW,
    trainer_id: TRAINER,
    client_id: CLIENT,
    week_number: 3,
    window_start: "2026-10-12",
    window_end: "2026-10-18",
    status: "borrador",
    required_measurement_type_ids: [],
    required_question_ids: [],
    weight_log_id: null,
    frozen_weight_kg: null,
    frozen_weight_date: null,
    feedback_video_url: null,
    feedback_note: "",
    created_at: CREATED,
    submitted_at: null,
    viewed_at: null,
    reviewed_at: null,
    review_media: [],
    review_measurements: [],
    questionnaire_responses: [],
    ...overrides,
  };
}

describe("reviewFromRow", () => {
  it("maps an open draft with its window and its frozen requirements", () => {
    const review = reviewFromRow(
      reviewRow({
        required_measurement_type_ids: ["55555555-5555-5555-5555-555555555555"],
        required_question_ids: [],
      }),
    );
    expect(review).toMatchObject({
      weekNumber: 3,
      window: { start: "2026-10-12", end: "2026-10-18" },
      status: "borrador",
      requirements: {
        measurementTypeIds: ["55555555-5555-5555-5555-555555555555"],
        questionIds: [],
      },
      frozenWeight: null,
      createdAt: "2026-10-05T09:00:00.123Z",
      submittedAt: null,
    });
  });

  it("keeps the photos in pose order, and the photo's url is its storage path", () => {
    const review = reviewFromRow(
      reviewRow({
        review_media: [
          {
            id: "a",
            pose: "espalda",
            storage_path: "t/c/r/3.jpg",
            uploaded_at: CREATED,
          },
          {
            id: "b",
            pose: "frente",
            storage_path: "t/c/r/1.jpg",
            uploaded_at: CREATED,
          },
        ],
      }),
    );
    expect(review.media.map((m) => m.pose)).toEqual(["frente", "espalda"]);
    expect(review.media[0]?.url).toBe("t/c/r/1.jpg");
  });

  it("copies the weight only for a viewed review that had a weigh-in (I24)", () => {
    const viewed = reviewFromRow(
      reviewRow({
        status: "vista",
        weight_log_id: LOG,
        frozen_weight_kg: 81.4,
        frozen_weight_date: "2026-10-14",
        submitted_at: CREATED,
        viewed_at: CREATED,
      }),
    );
    expect(viewed.frozenWeight).toEqual({ weightKg: 81.4, date: "2026-10-14" });
  });

  it("reads a scale answer with its limits and a text answer with no scale", () => {
    const review = reviewFromRow(
      reviewRow({
        questionnaire_responses: [
          {
            id: "q1",
            question_id: "66666666-6666-6666-6666-666666666666",
            prompt: "Energía",
            format_kind: "escala",
            scale_min: 1,
            scale_max: 10,
            value_number: 7,
            value_text: null,
          },
          {
            id: "q2",
            question_id: "77777777-7777-7777-7777-777777777777",
            prompt: "Sueño",
            format_kind: "texto",
            scale_min: null,
            scale_max: null,
            value_number: null,
            value_text: "Regular",
          },
        ],
      }),
    );
    expect(review.responses[0]).toMatchObject({
      format: { kind: "escala", min: 1, max: 10 },
      value: 7,
    });
    expect(review.responses[1]).toMatchObject({ format: { kind: "texto" }, value: "Regular" });
  });
});

describe("weightLogFromRow", () => {
  it("maps the civil date as it is and the weight in kg", () => {
    const row: WeightLogRow = {
      id: LOG,
      trainer_id: TRAINER,
      client_id: CLIENT,
      log_date: "2026-10-14",
      weight_kg: 81.4,
      note: "",
      created_at: CREATED,
    };
    expect(weightLogFromRow(row)).toMatchObject({
      date: "2026-10-14",
      weightKg: 81.4,
      note: "",
      createdAt: "2026-10-05T09:00:00.123Z",
    });
  });
});

describe("workoutLogFromRow", () => {
  it("keeps the line it was done on, so it resolves across routine versions", () => {
    const row: WorkoutLogRow = {
      id: LOG,
      trainer_id: TRAINER,
      client_id: CLIENT,
      exercise_id: "88888888-8888-8888-8888-888888888888",
      routine_id: "99999999-9999-9999-9999-999999999999",
      routine_day_exercise_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      log_date: "2026-10-14",
      set_number: 2,
      weight_kg: 60,
      reps: 8,
      created_at: CREATED,
    };
    expect(workoutLogFromRow(row)).toMatchObject({
      routineDayExerciseId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      date: "2026-10-14",
      setNumber: 2,
      weightKg: 60,
      reps: 8,
    });
  });
});
