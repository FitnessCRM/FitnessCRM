import {
  addCivilDays,
  answerQuestion,
  markReviewViewed,
  openReview,
  recordMeasurement,
  reviewSchema,
  reviewWindowForWeek,
  round1,
  sendReviewFeedback,
  submitReview,
  weightForReview,
  type Client,
  type MeasurementType,
  type QuestionnaireQuestion,
  type Review,
  type ReviewStatus,
  type WeightLog,
} from "@/lib/domain";
import { reviewDocId } from "../reviews";
import { sequence } from "./ids";
import {
  QUESTION_IDS,
  measurementTypeId,
  type MeasurementLabel,
  type QuestionKey,
  type SeedContext,
} from "./library";
import type { ClientKey } from "./people";
import { at } from "./time";

/** Una revisión de la siembra: en qué semana cae, hasta dónde llegó y qué puso el cliente. */
interface ReviewSpec {
  week: number;
  status: ReviewStatus;
  /** Días desde el inicio de la ventana en que se abrió, se envió, se vio y se revisó. */
  days: { open: number; submit?: number; view?: number; feedback?: number };
  measurements: Partial<Record<MeasurementLabel, number>>;
  answers: Partial<Record<QuestionKey, number | string>>;
  feedbackNote?: string;
}

/** Medidas de Lucas: valor de la semana 1 y lo que varía en cuatro semanas. Sin «Hombros». */
const LUCAS_MEASUREMENTS: Partial<Record<MeasurementLabel, [start: number, delta: number]>> = {
  Cuello: [38, 0.1],
  Pecho: [100, 0.8],
  Cintura: [82, 0.3],
  Cadera: [96, 0.2],
  Brazo: [35, 0.5],
  Muslo: [57, 0.8],
  Gemelo: [37, 0.2],
};

function lucasMeasurements(week: number): ReviewSpec["measurements"] {
  return Object.fromEntries(
    Object.entries(LUCAS_MEASUREMENTS).map(([label, [start, delta]]) => [
      label,
      round1(start + (delta * (week - 1)) / 4),
    ]),
  );
}

/** Abierta el sexto día de su semana, enviada el séptimo, vista y revisada los dos siguientes. */
const WEEKLY = { open: 5, submit: 6, view: 7, feedback: 8 };

const LUCAS_WEEKS: [answers: [number, number, number, string], feedbackNote: string][] = [
  [
    [3, 4, 4, "Punto de partida. Con ganas de empezar."],
    "Fotos y medidas de partida. Empezamos con las cargas que marcaste.",
  ],
  [
    [4, 4, 3, "Me noto más lleno en pecho y hombros."],
    "Buen arranque. Sube 2,5 kg en banca si llegas a 8 repeticiones.",
  ],
  [
    [4, 3, 4, "Semana de poco sueño por trabajo, pero he cumplido los tres días."],
    "Prioriza dormir: esta semana mantenemos cargas.",
  ],
  [
    [5, 4, 4, "La ropa me aprieta más en los brazos. Buena señal."],
    "Vas bien de peso. Subimos 20 g de carbohidratos en los días de entreno.",
  ],
  [[4, 4, 4, "Me veo más ancho de espalda. La sentadilla ha subido 5 kg desde que empecé."], ""],
];

/**
 * Lucas: semanas 1–4 `revisada` con nota y vídeo, y semana 5 `enviada` y sin ver, que es la que
 * sale como «Nueva» en «Revisiones recibidas». Irene: semana 9 `vista` sin feedback y semana 10
 * `borrador`, a medio rellenar.
 */
const SPECS: Record<ClientKey, ReviewSpec[]> = {
  lucas: LUCAS_WEEKS.map(([[energy, sleep, hunger, howSeen], feedbackNote], i) => ({
    week: i + 1,
    status: i < 4 ? "revisada" : "enviada",
    days: i < 4 ? WEEKLY : { open: WEEKLY.open, submit: WEEKLY.submit },
    measurements: lucasMeasurements(i + 1),
    answers: { energy, sleep, hunger, howSeen },
    feedbackNote,
  })),
  irene: [
    {
      week: 9,
      status: "vista",
      days: { open: 4, submit: 5, view: 6 },
      measurements: {
        Cuello: 31,
        Pecho: 87.5,
        Cintura: 68.5,
        Cadera: 94,
        Brazo: 27,
        Muslo: 53.5,
        Gemelo: 35,
      },
      answers: {
        energy: 3,
        sleep: 4,
        hunger: 2,
        howSeen: "Más definida en el abdomen, aunque con hambre por las tardes.",
      },
    },
    {
      week: 10,
      status: "borrador",
      days: { open: 0 },
      measurements: { Cintura: 68, Cadera: 93.5, Muslo: 53.5 },
      answers: {},
    },
  ],
};

/** El vídeo del feedback es un enlace externo (I20). Ficticio: `example.com` no aloja nada. */
const feedbackVideoUrl = (key: ClientKey, week: number) =>
  `https://example.com/feedback/${key}-semana-${week}`;

interface ReviewSources {
  client: Client;
  weightLogs: readonly WeightLog[];
  measurementTypes: readonly MeasurementType[];
  questions: readonly QuestionnaireQuestion[];
}

/**
 * Una revisión construida con las funciones del dominio, en el mismo orden en que la app la hace
 * avanzar, para que las invariantes se cumplan por construcción y no por haber escrito bien un
 * documento a mano:
 *
 * - `openReview` congela la semana y la ventana (I22) y los requisitos del catálogo que había al
 *   abrirla (I5). El id es `{clientId}_{semana}`, como en el adaptador (I16).
 * - El peso es el pesaje que la app habría tomado al guardar: el último de la ventana (I9).
 * - `recordMeasurement` y `answerQuestion` copian etiqueta, unidad, enunciado y formato (I12).
 * - `submitReview`, `markReviewViewed` —que guarda la copia del peso (I24)— y `sendReviewFeedback`.
 *
 * Sin fotos: la tarjeta 17 no está construida, así que todas salen incompletas según I5.
 */
function buildReview(
  ctx: SeedContext,
  key: ClientKey,
  spec: ReviewSpec,
  { client, weightLogs, measurementTypes, questions }: ReviewSources,
): Review {
  const windowStart = reviewWindowForWeek(client.startDate, spec.week).start;
  const dayOf = (offset: number) => addCivilDays(windowStart, offset);
  const newId = sequence(`${client.id}-rv${spec.week}`);

  const openedOn = dayOf(spec.days.open);
  const openedAt = at(ctx.clock, openedOn, "19:00");
  // El catálogo de entonces: lo que el entrenador añadió después no se le exige a esta revisión.
  const existing = <T extends { createdAt: string }>(entries: readonly T[]) =>
    entries.filter((entry) => entry.createdAt <= openedAt);
  const types = existing(measurementTypes);
  const asked = existing(questions);

  let review: Review = openReview({
    client,
    timeZone: ctx.clock.timeZone,
    at: openedOn,
    measurementTypes: types,
    questions: asked,
    newId,
    now: openedAt,
  });
  if (review.weekNumber !== spec.week) {
    throw new Error(`La revisión de ${client.id} cae en la semana ${review.weekNumber}`);
  }
  review = { ...review, id: reviewDocId(client.id, review.weekNumber) };

  const filledOn = dayOf(spec.days.submit ?? spec.days.open);
  const weightLog = weightForReview(
    weightLogs.filter((log) => log.date <= filledOn),
    review.window,
  );
  review = {
    ...review,
    weightLogId: weightLog?.id ?? null,
    measurements: (Object.entries(spec.measurements) as [MeasurementLabel, number][]).map(
      ([label, value]) => {
        const type = types.find((t) => t.id === measurementTypeId(label));
        if (!type) throw new Error(`«${label}» no estaba en el catálogo al abrir la revisión`);
        return recordMeasurement(type, value, newId);
      },
    ),
    responses: (Object.entries(spec.answers) as [QuestionKey, number | string][]).map(
      ([questionKey, value]) => {
        const question = asked.find((q) => q.id === QUESTION_IDS[questionKey]);
        if (!question) throw new Error(`«${questionKey}» no estaba en el cuestionario al abrirla`);
        return answerQuestion(question, value, newId);
      },
    ),
  };

  if (spec.days.submit !== undefined) {
    review = submitReview(review, at(ctx.clock, dayOf(spec.days.submit), "20:15"));
  }
  if (spec.days.view !== undefined) {
    review = markReviewViewed(review, weightLog, at(ctx.clock, dayOf(spec.days.view), "09:15"));
  }
  if (spec.days.feedback !== undefined) {
    review = sendReviewFeedback(
      review,
      { videoUrl: feedbackVideoUrl(key, spec.week), note: spec.feedbackNote ?? "" },
      at(ctx.clock, dayOf(spec.days.feedback), "13:00"),
    );
  }
  if (review.status !== spec.status) {
    throw new Error(`La revisión ${review.id} quedó ${review.status} y se esperaba ${spec.status}`);
  }
  return reviewSchema.parse(review);
}

export function buildReviews(ctx: SeedContext, key: ClientKey, sources: ReviewSources): Review[] {
  return SPECS[key].map((spec) => buildReview(ctx, key, spec, sources));
}
