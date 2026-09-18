import type { MeasurementType, QuestionnaireQuestion, ResponseFormat } from "@/lib/domain";
import { TRAINER_ID, ts } from "./common";

/** Los ocho campos de "Medidas corporales (cm)" de la pantalla de revisión del cliente. */
export const measurementTypes: MeasurementType[] = [
  "Cuello",
  "Pecho",
  "Cintura",
  "Cadera",
  "Brazo",
  "Muslo",
  "Gemelo",
  "Hombros",
].map((label, order) => ({
  id: `mt-${label.toLowerCase()}`,
  trainerId: TRAINER_ID,
  label,
  unit: "cm",
  order,
  status: "activa",
  createdAt: ts("2026-02-01"),
}));

export const QUESTION_IDS = {
  energy: "q-energia",
  sleep: "q-sueno",
  hunger: "q-hambre",
  howSeen: "q-como-te-has-visto",
  pain: "q-molestias",
} as const;

const scale: ResponseFormat = { kind: "escala", min: 1, max: 5 };
const text: ResponseFormat = { kind: "texto" };

/** Las cinco preguntas de la pantalla "Cuestionario de revisión". */
const questionRows: { id: string; prompt: string; format: ResponseFormat }[] = [
  { id: QUESTION_IDS.energy, prompt: "Energía en los entrenos", format: scale },
  { id: QUESTION_IDS.sleep, prompt: "Calidad del sueño", format: scale },
  { id: QUESTION_IDS.hunger, prompt: "Hambre / adherencia al plan", format: scale },
  {
    id: QUESTION_IDS.howSeen,
    prompt: "¿Cómo te has visto esta semana?",
    format: { kind: "texto" },
  },
  { id: QUESTION_IDS.pain, prompt: "Molestias o dolores", format: text },
];

export const questions: QuestionnaireQuestion[] = questionRows.map((q, order) => ({
  ...q,
  trainerId: TRAINER_ID,
  order,
  status: "activa",
  createdAt: ts("2026-02-01"),
}));
