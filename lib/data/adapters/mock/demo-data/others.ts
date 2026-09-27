import type { Review, WorkoutLog } from "@/lib/domain";
import { reviewWindowForWeek } from "@/lib/domain";
import { QUESTION_IDS, measurementTypes, questions } from "./catalogs";
import { CLIENT_IDS, TRAINER_ID, ts, type DemoDates } from "./common";
import { EXERCISE_IDS } from "./exercises";
import { REQUIREMENTS_BEFORE_STRESS_QUESTION, weightId } from "./reviews";

const poses = ["frente", "perfil", "espalda"] as const;

/** La pregunta de estrés es posterior a estas revisiones: nadie la ha respondido todavía. */
const answeredQuestions = questions.filter((q) => q.id !== QUESTION_IDS.stress);

function fullAnswers(prefix: string, scale: number, text: string) {
  return answeredQuestions.map((q) =>
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
      requirements: REQUIREMENTS_BEFORE_STRESS_QUESTION,
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
      requirements: REQUIREMENTS_BEFORE_STRESS_QUESTION,
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

/**
 * Las dos series de sentadilla "guardadas" hoy en la pantalla de rutina del cliente, más la
 * vez anterior del mismo día de rutina, que la pantalla enseña como referencia de solo lectura.
 */
export function buildWorkoutLogs(d: DemoDates): WorkoutLog[] {
  const base = {
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.marta,
    exerciseId: EXERCISE_IDS.squat,
    routineId: "rt-marta-hipertrofia",
    routineDayExerciseId: "r-marta-d2-e1",
  };
  const previous = d.daysAgo(4);
  return [
    {
      ...base,
      date: d.today,
      id: "wl-1",
      setNumber: 1,
      weightKg: 80,
      reps: 8,
      createdAt: ts(d.today, "17:10:00"),
    },
    {
      ...base,
      date: d.today,
      id: "wl-2",
      setNumber: 2,
      weightKg: 82.5,
      reps: 7,
      createdAt: ts(d.today, "17:14:00"),
    },
    {
      ...base,
      date: previous,
      id: "wl-3",
      setNumber: 1,
      weightKg: 77.5,
      reps: 8,
      createdAt: ts(previous, "17:08:00"),
    },
    {
      ...base,
      date: previous,
      id: "wl-4",
      setNumber: 2,
      weightKg: 80,
      reps: 8,
      createdAt: ts(previous, "17:13:00"),
    },
    {
      ...base,
      date: previous,
      id: "wl-5",
      setNumber: 3,
      weightKg: 80,
      reps: 6,
      createdAt: ts(previous, "17:18:00"),
    },
  ];
}
