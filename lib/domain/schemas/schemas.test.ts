import { describe, expect, it } from "vitest";
import {
  membershipSchema,
  prescriptionSchema,
  questionnaireResponseSchema,
  responseFormatSchema,
  reviewSchema,
  exerciseSchema,
  timeZoneSchema,
  weightLogSchema,
} from "./index";

const NOW = "2026-08-29T07:00:00Z";

describe("prescription", () => {
  it("accepts a rep range or fixed reps (repsMax null) and free-text RIR/rest", () => {
    expect(
      prescriptionSchema.safeParse({
        sets: 4,
        repsMin: 6,
        repsMax: 8,
        rir: "1-2",
        rest: "el que necesites",
      }).success,
    ).toBe(true);
    expect(
      prescriptionSchema.safeParse({ sets: 3, repsMin: 10, repsMax: null, rir: "2", rest: "" })
        .success,
    ).toBe(true);
  });

  it("rejects repsMax below repsMin and non-integer sets", () => {
    expect(prescriptionSchema.safeParse({ sets: 4, repsMin: 8, repsMax: 6 }).success).toBe(false);
    expect(prescriptionSchema.safeParse({ sets: 2.5, repsMin: 8, repsMax: null }).success).toBe(
      false,
    );
  });
});

describe("response format and frozen responses (I12)", () => {
  it("requires max > min on a scale", () => {
    expect(responseFormatSchema.safeParse({ kind: "escala", min: 1, max: 5 }).success).toBe(true);
    expect(responseFormatSchema.safeParse({ kind: "escala", min: 5, max: 5 }).success).toBe(false);
  });

  it("validates the value against the frozen format, not against anything external", () => {
    const base = { id: "qr", questionId: "q", prompt: "Energía" };
    expect(
      questionnaireResponseSchema.safeParse({
        ...base,
        format: { kind: "escala", min: 1, max: 5 },
        value: 6,
      }).success,
    ).toBe(false);
    expect(
      questionnaireResponseSchema.safeParse({
        ...base,
        format: { kind: "escala", min: 1, max: 5 },
        value: 4,
      }).success,
    ).toBe(true);
    expect(
      questionnaireResponseSchema.safeParse({ ...base, format: { kind: "texto" }, value: 4 })
        .success,
    ).toBe(false);
  });
});

describe("review", () => {
  it("only accepts the four lifecycle states and the three closed poses", () => {
    const valid = {
      id: "r",
      trainerId: "t",
      clientId: "c",
      weekNumber: 5,
      window: { start: "2026-08-29", end: "2026-09-04" },
      status: "enviada",
      requirements: { measurementTypeIds: [], questionIds: [] },
      media: [{ id: "m", pose: "frente", url: "storage://x", uploadedAt: NOW }],
      weightLogId: null,
      measurements: [],
      responses: [],
      feedbackVideoUrl: null,
      feedbackNote: "",
      createdAt: NOW,
      submittedAt: NOW,
      viewedAt: null,
      reviewedAt: null,
    };
    expect(reviewSchema.safeParse(valid).success).toBe(true);
    expect(reviewSchema.safeParse({ ...valid, status: "completa" }).success).toBe(false);
    expect(
      reviewSchema.safeParse({ ...valid, media: [{ ...valid.media[0], pose: "lateral" }] }).success,
    ).toBe(false);
  });

  it("feedback video must be an external http(s) link (I20)", () => {
    const partial = reviewSchema.pick({ feedbackVideoUrl: true });
    expect(partial.safeParse({ feedbackVideoUrl: "https://youtu.be/abc" }).success).toBe(true);
    expect(partial.safeParse({ feedbackVideoUrl: "ftp://host/video.mp4" }).success).toBe(false);
    expect(partial.safeParse({ feedbackVideoUrl: "not a url" }).success).toBe(false);
  });
});

describe("misc invariants", () => {
  it("weight is stored in kg and must be positive (I18)", () => {
    const base = {
      id: "w",
      trainerId: "t",
      clientId: "c",
      date: "2026-08-29",
      note: "",
      createdAt: NOW,
    };
    expect(weightLogSchema.safeParse({ ...base, weightKg: 63.4 }).success).toBe(true);
    expect(weightLogSchema.safeParse({ ...base, weightKg: 0 }).success).toBe(false);
    expect(weightLogSchema.safeParse({ ...base, weightKg: 63.4, date: "29-08-2026" }).success).toBe(
      false,
    );
  });

  it("membership has no amount fields and end >= start (I21)", () => {
    const m = {
      id: "m",
      trainerId: "t",
      clientId: "c",
      type: "trimestral",
      startDate: "2026-07-01",
      endDate: "2026-09-30",
      paymentStatus: "pagada",
      createdAt: NOW,
    };
    expect(membershipSchema.safeParse(m).success).toBe(true);
    expect(membershipSchema.safeParse({ ...m, endDate: "2026-06-30" }).success).toBe(false);
    expect(Object.keys(membershipSchema.parse(m))).not.toContain("amount");
  });

  it("exercise video is an external link or null (I20)", () => {
    const e = { id: "e", trainerId: "t", name: "Sentadilla", createdAt: NOW, videoUrl: null };
    expect(exerciseSchema.safeParse(e).success).toBe(true);
    expect(exerciseSchema.safeParse({ ...e, videoUrl: "https://video.example/x" }).success).toBe(
      true,
    );
    expect(exerciseSchema.safeParse({ ...e, videoUrl: "/uploads/x.mp4" }).success).toBe(false);
  });

  it("time zone must be a valid IANA name", () => {
    expect(timeZoneSchema.safeParse("Europe/Madrid").success).toBe(true);
    expect(timeZoneSchema.safeParse("Mars/Olympus").success).toBe(false);
  });
});
