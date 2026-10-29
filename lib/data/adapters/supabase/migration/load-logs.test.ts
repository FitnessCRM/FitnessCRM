import { describe, expect, it } from "vitest";
import type { Review, Routine, WeightLog, WorkoutLog } from "@/lib/domain";
import { entityIdFor } from "./ids";
import { findLogViolations, loadReviewsAndLogs, type LogData } from "./load-logs";
import {
  reviewMeasurementRows,
  reviewMediaCount,
  reviewRow,
  questionnaireResponseRows,
  routineRows,
  workoutLogRow,
} from "./to-rows";

const TRAINER = "uid-trainer";
const CREATED = "2026-08-30T09:00:00.000Z";

const review: Review = {
  id: "review-1",
  trainerId: TRAINER,
  clientId: "client-1",
  weekNumber: 5,
  window: { start: "2026-08-24", end: "2026-08-30" },
  status: "revisada",
  requirements: { measurementTypeIds: ["mt-1"], questionIds: ["q-1"] },
  media: [{ id: "p-1", pose: "frente", url: "x", uploadedAt: CREATED }],
  weightLogId: "wl-1",
  frozenWeight: { weightKg: 80.5, date: "2026-08-29" },
  measurements: [{ id: "m-1", measurementTypeId: "mt-1", value: 90, label: "Cintura", unit: "cm" }],
  responses: [
    {
      id: "r-1",
      questionId: "q-1",
      prompt: "Energía",
      format: { kind: "escala", min: 1, max: 5 },
      value: 4,
    },
    {
      id: "r-2",
      questionId: "q-2",
      prompt: "Comentario",
      format: { kind: "texto" },
      value: "Bien",
    },
  ],
  feedbackVideoUrl: null,
  feedbackNote: "",
  createdAt: CREATED,
  submittedAt: CREATED,
  viewedAt: CREATED,
  reviewedAt: CREATED,
};

const weightLog = (id: string, date: string): WeightLog => ({
  id,
  trainerId: TRAINER,
  clientId: "client-1",
  date,
  weightKg: 80.5,
  note: "",
  createdAt: CREATED,
});

const workout: WorkoutLog = {
  id: "wo-1",
  trainerId: TRAINER,
  clientId: "client-1",
  exerciseId: "exercise-press",
  routineId: "routine-1",
  routineDayExerciseId: "line-1",
  date: "2026-08-25",
  setNumber: 1,
  weightKg: 60,
  reps: 8,
  createdAt: CREATED,
};

const routine: Routine = {
  id: "routine-1",
  trainerId: TRAINER,
  clientId: "client-1",
  status: "activo",
  name: "Fuerza",
  note: "",
  sourceTemplateName: null,
  createdAt: CREATED,
  updatedAt: CREATED,
  days: [
    {
      id: "day-a",
      dayNumber: 1,
      label: "",
      exercises: [
        {
          id: "line-1",
          exerciseId: "exercise-press",
          prescription: { sets: 3, repsMin: 8, repsMax: null, rir: "", rest: "", note: "" },
        },
      ],
    },
  ],
};

describe("review rows", () => {
  it("converts requirements and the frozen weight, and keeps the weight log reference", () => {
    const row = reviewRow(review);
    expect(row.id).toBe(entityIdFor("review", "review-1"));
    expect(row.required_measurement_type_ids).toEqual([entityIdFor("measurement-type", "mt-1")]);
    expect(row.required_question_ids).toEqual([entityIdFor("question", "q-1")]);
    expect(row.weight_log_id).toBe(entityIdFor("weight-log", "wl-1"));
    expect(row).toMatchObject({ frozen_weight_kg: 80.5, frozen_weight_date: "2026-08-29" });
  });

  it("writes measurements with a frozen label and unit, and responses with their format", () => {
    const [measurement] = reviewMeasurementRows(review);
    expect(measurement).toMatchObject({
      measurement_type_id: entityIdFor("measurement-type", "mt-1"),
      value: 90,
      label: "Cintura",
      unit: "cm",
    });
    const [scale, text] = questionnaireResponseRows(review);
    expect(scale).toMatchObject({
      format_kind: "escala",
      scale_min: 1,
      scale_max: 5,
      value_number: 4,
      value_text: null,
    });
    expect(text).toMatchObject({
      format_kind: "texto",
      scale_min: null,
      value_number: null,
      value_text: "Bien",
    });
  });

  it("counts the photos that stay out of the load", () => {
    expect(reviewMediaCount([review])).toBe(1);
  });
});

describe("workout log rows", () => {
  it("points at the same routine line id that the routine rows write", () => {
    const lineId = routineRows(routine).lines[0]?.id;
    expect(workoutLogRow(workout).routine_day_exercise_id).toBe(lineId);
    expect(workoutLogRow(workout).routine_id).toBe(entityIdFor("routine", "routine-1"));
  });
});

describe("findLogViolations", () => {
  const base = (): LogData => ({ weightLogs: [], reviews: [], workoutLogs: [] });

  it("reports two weigh-ins for the same client and day", () => {
    const data = {
      ...base(),
      weightLogs: [weightLog("a", "2026-08-25"), weightLog("b", "2026-08-25")],
    };
    expect(findLogViolations(data)).toHaveLength(1);
  });

  it("accepts weigh-ins on different days", () => {
    const data = {
      ...base(),
      weightLogs: [weightLog("a", "2026-08-25"), weightLog("b", "2026-08-26")],
    };
    expect(findLogViolations(data)).toEqual([]);
  });
});

describe("loadReviewsAndLogs", () => {
  it("refuses a remote URL before sending anything", async () => {
    await expect(
      loadReviewsAndLogs(
        { weightLogs: [], reviews: [], workoutLogs: [] },
        {
          url: "https://fitnesscrm.supabase.co",
          serviceKey: "service",
          fetch: (async () => new Response("{}", { status: 201 })) as typeof fetch,
        },
      ),
    ).rejects.toThrow(/solo corre contra la instancia local/);
  });

  it("writes weigh-ins before reviews, and reviews before their measurements and answers", async () => {
    const calls: string[] = [];
    await loadReviewsAndLogs(
      { weightLogs: [weightLog("wl-1", "2026-08-29")], reviews: [review], workoutLogs: [workout] },
      {
        url: "http://127.0.0.1:54321",
        serviceKey: "service",
        fetch: (async (input: string | URL | Request) => {
          calls.push(String(input).replace("http://127.0.0.1:54321/rest/v1/", ""));
          return new Response("{}", { status: 201 });
        }) as typeof fetch,
      },
    );
    const at = (table: string) => calls.findIndex((c) => c.startsWith(`${table}?`));
    expect(at("weight_logs")).toBeLessThan(at("reviews"));
    expect(at("reviews")).toBeLessThan(at("review_measurements"));
    expect(at("reviews")).toBeLessThan(at("questionnaire_responses"));
    expect(at("workout_logs")).toBeGreaterThan(-1);
  });
});
