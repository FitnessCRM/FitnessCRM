import type {
  Client,
  MeasurementType,
  QuestionnaireQuestion,
  Review,
  ReviewMedia,
  WeightLog,
} from "../schemas";

export const NOW = "2026-08-29T07:00:00Z";
export const TZ = "Europe/Madrid";

/** Generador de ids determinista para tests. */
export function idFactory(prefix = "id"): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

export const client: Client = {
  id: "c-marta",
  trainerId: "t-adrian",
  firstName: "Marta",
  lastName: "Ruiz",
  email: "marta@example.com",
  phone: "",
  goal: "",
  level: "",
  initialNotes: "",
  status: "activo",
  startDate: "2026-08-01",
  reviewCadence: { everyDays: 7 },
  createdAt: "2026-08-01T08:00:00Z",
};

export function measurementType(over: Partial<MeasurementType> = {}): MeasurementType {
  return {
    id: "mt-cintura",
    trainerId: client.trainerId,
    label: "Cintura",
    unit: "cm",
    order: 0,
    status: "activa",
    createdAt: NOW,
    ...over,
  };
}

export function question(over: Partial<QuestionnaireQuestion> = {}): QuestionnaireQuestion {
  return {
    id: "q-energia",
    trainerId: client.trainerId,
    prompt: "Energía en los entrenos",
    format: { kind: "escala", min: 1, max: 5 },
    order: 0,
    status: "activa",
    createdAt: NOW,
    ...over,
  };
}

export function weightLog(over: Partial<WeightLog> = {}): WeightLog {
  return {
    id: "w-1",
    trainerId: client.trainerId,
    clientId: client.id,
    date: "2026-08-29",
    weightKg: 63.4,
    note: "",
    createdAt: NOW,
    ...over,
  };
}

export function media(pose: ReviewMedia["pose"]): ReviewMedia {
  return { id: `m-${pose}`, pose, url: `storage://${pose}.jpg`, uploadedAt: NOW };
}

export function review(over: Partial<Review> = {}): Review {
  return {
    id: "r-1",
    trainerId: client.trainerId,
    clientId: client.id,
    weekNumber: 5,
    window: { start: "2026-08-29", end: "2026-09-04" },
    status: "borrador",
    requirements: { measurementTypeIds: ["mt-cintura"], questionIds: ["q-energia"] },
    media: [],
    weightLogId: null,
    measurements: [],
    responses: [],
    feedbackVideoUrl: null,
    feedbackNote: "",
    createdAt: NOW,
    submittedAt: null,
    viewedAt: null,
    reviewedAt: null,
    ...over,
  };
}

/** Revisión con los cuatro bloques cubiertos. */
export function completeReview(over: Partial<Review> = {}): Review {
  return review({
    media: [media("frente"), media("perfil"), media("espalda")],
    weightLogId: "w-1",
    measurements: [
      { id: "bm-1", measurementTypeId: "mt-cintura", value: 71, label: "Cintura", unit: "cm" },
    ],
    responses: [
      {
        id: "qr-1",
        questionId: "q-energia",
        prompt: "Energía en los entrenos",
        format: { kind: "escala", min: 1, max: 5 },
        value: 4,
      },
    ],
    ...over,
  });
}
