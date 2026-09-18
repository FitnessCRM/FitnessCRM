import type { BodyMeasurement, QuestionnaireResponse, Review, WeightLog } from "@/lib/domain";
import { reviewWindowForWeek } from "@/lib/domain";
import { measurementTypes, QUESTION_IDS, questions } from "./catalogs";
import { CLIENT_IDS, TRAINER_ID, ts } from "./common";

/** Pesajes diarios de Marta en agosto, tal como aparecen en el calendario de "Revisión de cliente". */
const martaWeights: [date: string, kg: number, note?: string][] = [
  ["2026-08-01", 65.5],
  ["2026-08-03", 65.2],
  ["2026-08-05", 65.0],
  ["2026-08-08", 64.8],
  ["2026-08-10", 64.7],
  ["2026-08-12", 64.5],
  ["2026-08-15", 64.3],
  ["2026-08-17", 64.2],
  ["2026-08-19", 64.6, "tras vacaciones"],
  ["2026-08-22", 63.9],
  ["2026-08-24", 64.1],
  ["2026-08-26", 63.8],
  ["2026-08-29", 63.4, "en ayunas, día de revisión"],
];

const weightId = (clientId: string, date: string) => `w-${clientId}-${date}`;

export const weightLogs: WeightLog[] = [
  ...martaWeights.map(([date, weightKg, note = ""]) => ({
    id: weightId(CLIENT_IDS.marta, date),
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.marta,
    date,
    weightKg,
    note,
    createdAt: ts(date, "07:30:00"),
  })),
  {
    id: weightId(CLIENT_IDS.jorge, "2026-08-29"),
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.jorge,
    date: "2026-08-29",
    weightKg: 78.2,
    note: "",
    createdAt: ts("2026-08-29", "06:50:00"),
  },
  {
    id: weightId(CLIENT_IDS.sara, "2026-08-28"),
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.sara,
    date: "2026-08-28",
    weightKg: 61.0,
    note: "",
    createdAt: ts("2026-08-28", "07:10:00"),
  },
];

const REQUIREMENTS = {
  measurementTypeIds: measurementTypes.map((t) => t.id),
  questionIds: questions.map((q) => q.id),
};

/** Valores base (S1) y variación total en cinco semanas: cintura −3,0 · cadera −1,5 · muslo +0,8. */
const BASE: Record<string, [start: number, delta: number]> = {
  "mt-cuello": [32, 0],
  "mt-pecho": [89, -0.5],
  "mt-cintura": [74, -3],
  "mt-cadera": [98, -1.5],
  "mt-brazo": [28, 0.4],
  "mt-muslo": [56, 0.8],
  "mt-gemelo": [36, 0],
  "mt-hombros": [104, 0],
};

function measurementsForWeek(prefix: string, week: number): BodyMeasurement[] {
  return measurementTypes.map((t) => {
    const [start, delta] = BASE[t.id] ?? [0, 0];
    const value = Math.round((start + (delta * (week - 1)) / 4) * 10) / 10;
    return {
      id: `${prefix}-${t.id}`,
      measurementTypeId: t.id,
      value,
      label: t.label,
      unit: t.unit,
    };
  });
}

function responses(
  prefix: string,
  values: [number, number, number, string, string],
): QuestionnaireResponse[] {
  const [energy, sleep, hunger, seen, pain] = values;
  const q = (id: string) => questions.find((x) => x.id === id)!;
  const scale = (id: string, value: number): QuestionnaireResponse => ({
    id: `${prefix}-${id}`,
    questionId: id,
    prompt: q(id).prompt,
    format: { kind: "escala", min: 1, max: 5 },
    value,
  });
  const text = (id: string, value: string): QuestionnaireResponse => ({
    id: `${prefix}-${id}`,
    questionId: id,
    prompt: q(id).prompt,
    format: { kind: "texto" },
    value,
  });
  return [
    scale(QUESTION_IDS.energy, energy),
    scale(QUESTION_IDS.sleep, sleep),
    scale(QUESTION_IDS.hunger, hunger),
    text(QUESTION_IDS.howSeen, seen),
    text(QUESTION_IDS.pain, pain),
  ];
}

interface MartaWeek {
  week: number;
  date: string;
  answers: [number, number, number, string, string];
  feedbackNote: string;
}

const martaWeeks: MartaWeek[] = [
  {
    week: 1,
    date: "2026-08-01",
    answers: [3, 3, 4, "Punto de partida.", "Ninguna"],
    feedbackNote: "Fotos y medidas base",
  },
  {
    week: 2,
    date: "2026-08-08",
    answers: [4, 3, 4, "Más energía en pierna.", "Ninguna"],
    feedbackNote: "Buen arranque, seguimos igual",
  },
  {
    week: 3,
    date: "2026-08-15",
    answers: [3, 2, 3, "Semana floja de sueño.", "Ninguna"],
    feedbackNote: "Subida de carbos +20 g",
  },
  {
    week: 4,
    date: "2026-08-22",
    answers: [4, 4, 4, "Ropa más suelta en cintura.", "Ninguna"],
    feedbackNote: "Vamos bien, mantén el descanso",
  },
];

function martaReview(w: MartaWeek): Review {
  const prefix = `rv-marta-s${w.week}`;
  return {
    id: prefix,
    trainerId: TRAINER_ID,
    clientId: CLIENT_IDS.marta,
    weekNumber: w.week,
    window: reviewWindowForWeek("2026-08-01", w.week),
    status: "revisada",
    requirements: REQUIREMENTS,
    media: (["frente", "perfil", "espalda"] as const).map((pose) => ({
      id: `${prefix}-${pose}`,
      pose,
      url: `demo://${prefix}/${pose}.jpg`,
      uploadedAt: ts(w.date, "09:00:00"),
    })),
    weightLogId: weightId(CLIENT_IDS.marta, w.date),
    measurements: measurementsForWeek(prefix, w.week),
    responses: responses(prefix, w.answers),
    feedbackVideoUrl: `https://youtu.be/hector-marta-s${w.week}`,
    feedbackNote: w.feedbackNote,
    createdAt: ts(w.date, "08:30:00"),
    submittedAt: ts(w.date, "09:10:00"),
    viewedAt: ts(w.date, "12:00:00"),
    reviewedAt: ts(w.date, "18:00:00"),
  };
}

const martaS5: Review = {
  ...martaReview({
    week: 5,
    date: "2026-08-29",
    answers: [
      4,
      3,
      4,
      "Me veo con más definición en la cintura. Semana dura en el trabajo pero he cumplido casi todo.",
      "Ligera molestia en la rodilla derecha en la zancada búlgara, solo con peso alto.",
    ],
    feedbackNote: "",
  }),
  status: "enviada",
  feedbackVideoUrl: null,
  viewedAt: null,
  reviewedAt: null,
};

export const reviews: Review[] = [...martaWeeks.map(martaReview), martaS5];
