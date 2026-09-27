import type { BodyMeasurement, QuestionnaireResponse, Review, WeightLog } from "@/lib/domain";
import { addCivilDays, reviewWindowForWeek } from "@/lib/domain";
import { measurementTypes, QUESTION_IDS, questions } from "./catalogs";
import { CLIENT_IDS, TRAINER_ID, ts, type DemoDates } from "./common";

/** Pesajes de Marta como días desde su alta (en la maqueta: 1, 3, 5, 8 … 29 de agosto). */
const martaWeights: [dayOffset: number, kg: number, note?: string][] = [
  [0, 65.5],
  [2, 65.2],
  [4, 65.0],
  [7, 64.8],
  [9, 64.7],
  [11, 64.5],
  [14, 64.3],
  [16, 64.2],
  [18, 64.6, "tras vacaciones"],
  [21, 63.9],
  [23, 64.1],
  [25, 63.8],
  [28, 63.4, "en ayunas, día de revisión"],
];

export const weightId = (clientId: string, date: string) => `w-${clientId}-${date}`;

export function buildWeightLogs(d: DemoDates): WeightLog[] {
  const jorgeDate = d.today;
  const saraDate = d.yesterday;
  return [
    ...martaWeights.map(([offset, weightKg, note = ""]) => {
      const date = addCivilDays(d.martaStart, offset);
      return {
        id: weightId(CLIENT_IDS.marta, date),
        trainerId: TRAINER_ID,
        clientId: CLIENT_IDS.marta,
        date,
        weightKg,
        note,
        createdAt: ts(date, "07:30:00"),
      };
    }),
    {
      id: weightId(CLIENT_IDS.jorge, jorgeDate),
      trainerId: TRAINER_ID,
      clientId: CLIENT_IDS.jorge,
      date: jorgeDate,
      weightKg: 78.2,
      note: "",
      createdAt: ts(jorgeDate, "06:50:00"),
    },
    {
      id: weightId(CLIENT_IDS.sara, saraDate),
      trainerId: TRAINER_ID,
      clientId: CLIENT_IDS.sara,
      date: saraDate,
      weightKg: 61.0,
      note: "",
      createdAt: ts(saraDate, "07:10:00"),
    },
  ];
}

/**
 * Los requisitos tal y como estaban **antes de que se añadiera la pregunta de estrés**, que es
 * cuando se abrieron todas las revisiones de demo: las ocho medidas y las cinco preguntas
 * originales. `openReview` congela los requisitos al crear la revisión y la completitud se mide
 * contra esa foto, no contra el catálogo de hoy (I5).
 *
 * Va escrita a mano a propósito. Calcularla del catálogo es lo que rompió esto: al añadir la
 * pregunta de estrés, revisiones cerradas semanas antes pasaron a exigir una pregunta que nadie
 * podía haber respondido, y las cinco de Marta aparecieron «Parcial». El nombre dice de cuándo es
 * la foto para que una revisión de demo abierta después de otro cambio de catálogo **no reutilice
 * esta**, sino que escriba la suya.
 */
export const REQUIREMENTS_BEFORE_STRESS_QUESTION = {
  measurementTypeIds: [
    "mt-cuello",
    "mt-pecho",
    "mt-cintura",
    "mt-cadera",
    "mt-brazo",
    "mt-muslo",
    "mt-gemelo",
    "mt-hombros",
  ],
  questionIds: [
    QUESTION_IDS.energy,
    QUESTION_IDS.sleep,
    QUESTION_IDS.hunger,
    QUESTION_IDS.howSeen,
    QUESTION_IDS.pain,
  ],
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
  answers: [number, number, number, string, string];
  feedbackNote: string;
}

const martaWeeks: MartaWeek[] = [
  {
    week: 1,
    answers: [3, 3, 4, "Punto de partida.", "Ninguna"],
    feedbackNote: "Fotos y medidas base",
  },
  {
    week: 2,
    answers: [4, 3, 4, "Más energía en pierna.", "Ninguna"],
    feedbackNote: "Buen arranque, seguimos igual",
  },
  {
    week: 3,
    answers: [3, 2, 3, "Semana floja de sueño.", "Ninguna"],
    feedbackNote: "Subida de carbos +20 g",
  },
  {
    week: 4,
    answers: [4, 4, 4, "Ropa más suelta en cintura.", "Ninguna"],
    feedbackNote: "Vamos bien, mantén el descanso",
  },
];

const martaS5: MartaWeek = {
  week: 5,
  answers: [
    4,
    3,
    4,
    "Me veo con más definición en la cintura. Semana dura en el trabajo pero he cumplido casi todo.",
    "Ligera molestia en la rodilla derecha en la zancada búlgara, solo con peso alto.",
  ],
  feedbackNote: "",
};

/** Cinco revisiones de Marta: S1–S4 revisadas con feedback, S5 enviada hoy (la "Nueva" del panel). */
export function buildMartaReviews(d: DemoDates): Review[] {
  const build = (w: MartaWeek): Review => {
    const prefix = `rv-marta-s${w.week}`;
    const date = addCivilDays(d.martaStart, (w.week - 1) * 7);
    const done = w.week < 5;
    return {
      id: prefix,
      trainerId: TRAINER_ID,
      clientId: CLIENT_IDS.marta,
      weekNumber: w.week,
      window: reviewWindowForWeek(d.martaStart, w.week),
      status: done ? "revisada" : "enviada",
      requirements: REQUIREMENTS_BEFORE_STRESS_QUESTION,
      media: (["frente", "perfil", "espalda"] as const).map((pose) => ({
        id: `${prefix}-${pose}`,
        pose,
        url: `demo://${prefix}/${pose}.jpg`,
        uploadedAt: ts(date, "09:00:00"),
      })),
      weightLogId: weightId(CLIENT_IDS.marta, date),
      measurements: measurementsForWeek(prefix, w.week),
      responses: responses(prefix, w.answers),
      feedbackVideoUrl: done ? `https://youtu.be/hector-marta-s${w.week}` : null,
      feedbackNote: w.feedbackNote,
      createdAt: ts(date, "08:30:00"),
      submittedAt: ts(date, "09:10:00"),
      viewedAt: done ? ts(date, "12:00:00") : null,
      reviewedAt: done ? ts(date, "18:00:00") : null,
    };
  };
  return [...martaWeeks, martaS5].map(build);
}
