import type { Review, WorkoutLog } from "@/lib/domain";
import { reviewWindowForWeek } from "@/lib/domain";
import { measurementTypes, questions } from "./catalogs";
import { CLIENT_IDS, TRAINER_ID, ts, type DemoDates } from "./common";
import { EXERCISE_IDS } from "./exercises";
import { REQUIREMENTS, weightId } from "./reviews";

const poses = ["frente", "perfil", "espalda"] as const;

function fullAnswers(prefix: string, scale: number, text: string) {
  return questions.map((q) =>
    q.format.kind === "escala"
      ? {
          id: `${prefix}-${q.id}`,
          questionId: q.id,
          prompt: q.prompt,
          format: q.format,
          value: scale,
        }
      : {
          id: `${prefix}-${q.id}`,
          questionId: q.id,
          prompt: q.prompt,
          format: q.format,
          value: text,
        },
  );
}

/** Jorge: semana 8, enviada completa hoy de madrugada. Sara: semana 3, enviada ayer sin medidas ("Parcial"). */
export function buildOtherReviews(d: DemoDates): Review[] {
  return [
    {
      id: "rv-jorge-s8",
      trainerId: TRAINER_ID,
      clientId: CLIENT_IDS.jorge,
      weekNumber: 8,
      window: reviewWindowForWeek(d.jorgeStart, 8),
      status: "enviada",
      requirements: REQUIREMENTS,
      media: poses.map((pose) => ({
        id: `rv-jorge-s8-${pose}`,
        pose,
        url: `demo://rv-jorge-s8/${pose}.jpg`,
        uploadedAt: ts(d.today, "05:00:00"),
      })),
      weightLogId: weightId(CLIENT_IDS.jorge, d.today),
      measurements: measurementTypes.map((t) => ({
        id: `rv-jorge-s8-${t.id}`,
        measurementTypeId: t.id,
        value: 80,
        label: t.label,
        unit: t.unit,
      })),
      responses: fullAnswers("rv-jorge-s8", 4, "Todo en orden."),
      feedbackVideoUrl: null,
      feedbackNote: "",
      createdAt: ts(d.today, "04:30:00"),
      submittedAt: ts(d.today, "05:00:00"),
      viewedAt: null,
      reviewedAt: null,
    },
    {
      id: "rv-sara-s3",
      trainerId: TRAINER_ID,
      clientId: CLIENT_IDS.sara,
      weekNumber: 3,
      window: reviewWindowForWeek(d.saraStart, 3),
      status: "enviada",
      requirements: REQUIREMENTS,
      media: poses.map((pose) => ({
        id: `rv-sara-s3-${pose}`,
        pose,
        url: `demo://rv-sara-s3/${pose}.jpg`,
        uploadedAt: ts(d.yesterday, "20:00:00"),
      })),
      weightLogId: weightId(CLIENT_IDS.sara, d.yesterday),
      measurements: [],
      responses: fullAnswers("rv-sara-s3", 3, "Sin novedades."),
      feedbackVideoUrl: null,
      feedbackNote: "",
      createdAt: ts(d.yesterday, "19:30:00"),
      submittedAt: ts(d.yesterday, "20:15:00"),
      viewedAt: null,
      reviewedAt: null,
    },
  ];
}

/** Las dos series de sentadilla "guardadas" en la pantalla de rutina del cliente, hoy. */
export function buildWorkoutLogs(d: DemoDates): WorkoutLog[] {
  const base = {
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.marta,
    exerciseId: EXERCISE_IDS.squat,
    routineId: "rt-marta-hipertrofia",
    routineDayExerciseId: "r-marta-d2-e1",
    date: d.today,
  };
  return [
    {
      ...base,
      id: "wl-1",
      setNumber: 1,
      weightKg: 80,
      reps: 8,
      createdAt: ts(d.today, "17:10:00"),
    },
    {
      ...base,
      id: "wl-2",
      setNumber: 2,
      weightKg: 82.5,
      reps: 7,
      createdAt: ts(d.today, "17:14:00"),
    },
  ];
}
