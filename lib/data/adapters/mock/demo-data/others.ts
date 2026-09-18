import type { Review, WorkoutLog } from "@/lib/domain";
import { reviewWindowForWeek } from "@/lib/domain";
import { measurementTypes, questions } from "./catalogs";
import { CLIENT_IDS, DEMO_TODAY, TRAINER_ID, ts } from "./common";

const REQUIREMENTS = {
  measurementTypeIds: measurementTypes.map((t) => t.id),
  questionIds: questions.map((q) => q.id),
};

const poses = ["frente", "perfil", "espalda"] as const;

/** Jorge: semana 8, enviada completa "hace 5 h". Sara: semana 3, enviada sin medidas ("Parcial"). */
export const otherReviews: Review[] = [
  {
    id: "rv-jorge-s8",
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.jorge,
    weekNumber: 8,
    window: reviewWindowForWeek("2026-07-11", 8),
    status: "enviada",
    requirements: REQUIREMENTS,
    media: poses.map((pose) => ({
      id: `rv-jorge-s8-${pose}`,
      pose,
      url: `demo://rv-jorge-s8/${pose}.jpg`,
      uploadedAt: ts(DEMO_TODAY, "05:00:00"),
    })),
    weightLogId: `w-${CLIENT_IDS.jorge}-2026-08-29`,
    measurements: measurementTypes.map((t) => ({
      id: `rv-jorge-s8-${t.id}`,
      measurementTypeId: t.id,
      value: 80,
      label: t.label,
      unit: t.unit,
    })),
    responses: questions.map((q) =>
      q.format.kind === "escala"
        ? {
            id: `rv-jorge-s8-${q.id}`,
            questionId: q.id,
            prompt: q.prompt,
            format: q.format,
            value: 4,
          }
        : {
            id: `rv-jorge-s8-${q.id}`,
            questionId: q.id,
            prompt: q.prompt,
            format: q.format,
            value: "Todo en orden.",
          },
    ),
    feedbackVideoUrl: null,
    feedbackNote: "",
    createdAt: ts(DEMO_TODAY, "04:30:00"),
    submittedAt: ts(DEMO_TODAY, "05:00:00"),
    viewedAt: null,
    reviewedAt: null,
  },
  {
    id: "rv-sara-s3",
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.sara,
    weekNumber: 3,
    window: reviewWindowForWeek("2026-08-15", 3),
    status: "enviada",
    requirements: REQUIREMENTS,
    media: poses.map((pose) => ({
      id: `rv-sara-s3-${pose}`,
      pose,
      url: `demo://rv-sara-s3/${pose}.jpg`,
      uploadedAt: ts("2026-08-28", "20:00:00"),
    })),
    weightLogId: `w-${CLIENT_IDS.sara}-2026-08-28`,
    measurements: [],
    responses: questions.map((q) =>
      q.format.kind === "escala"
        ? {
            id: `rv-sara-s3-${q.id}`,
            questionId: q.id,
            prompt: q.prompt,
            format: q.format,
            value: 3,
          }
        : {
            id: `rv-sara-s3-${q.id}`,
            questionId: q.id,
            prompt: q.prompt,
            format: q.format,
            value: "Sin novedades.",
          },
    ),
    feedbackVideoUrl: null,
    feedbackNote: "",
    createdAt: ts("2026-08-28", "19:30:00"),
    submittedAt: ts("2026-08-28", "20:15:00"),
    viewedAt: null,
    reviewedAt: null,
  },
];

/** Las dos series de sentadilla "guardadas" en la pantalla de rutina del cliente. */
export const workoutLogs: WorkoutLog[] = [
  {
    id: "wl-1",
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.marta,
    routineId: "rt-marta-hipertrofia",
    routineDayExerciseId: "r-marta-d2-e1",
    date: DEMO_TODAY,
    setNumber: 1,
    weightKg: 80,
    reps: 8,
    createdAt: ts(DEMO_TODAY, "17:10:00"),
  },
  {
    id: "wl-2",
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.marta,
    routineId: "rt-marta-hipertrofia",
    routineDayExerciseId: "r-marta-d2-e1",
    date: DEMO_TODAY,
    setNumber: 2,
    weightKg: 82.5,
    reps: 7,
    createdAt: ts(DEMO_TODAY, "17:14:00"),
  },
];
