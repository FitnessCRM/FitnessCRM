import type { Exercise } from "@/lib/domain";
import { TRAINER_ID, ts } from "./common";

export const EXERCISE_IDS = {
  squat: "ex-sentadilla-trasera",
  bench: "ex-press-banca",
  pullup: "ex-dominadas",
  rdl: "ex-peso-muerto-rumano",
  bulgarian: "ex-zancada-bulgara",
  row: "ex-remo-barra",
  legPress: "ex-prensa-inclinada",
  legCurl: "ex-curl-femoral",
  ohp: "ex-press-militar",
  inclineDb: "ex-press-inclinado-mancuernas",
} as const;

function exercise(
  id: string,
  name: string,
  muscleGroup: string,
  equipment: string,
  description = "",
): Exercise {
  return {
    id,
    trainerId: TRAINER_ID,
    name,
    muscleGroup,
    equipment,
    videoUrl: `https://video.example.com/${id.replace("ex-", "")}`,
    description,
    createdAt: ts("2026-02-01"),
  };
}

export const exercises: Exercise[] = [
  exercise(
    EXERCISE_IDS.squat,
    "Sentadilla trasera",
    "Pierna",
    "barra",
    "Barra apoyada en trapecio, bajada controlada hasta romper paralela. Rodillas en línea con las puntas.",
  ),
  exercise(EXERCISE_IDS.bench, "Press banca", "Empuje", "barra"),
  exercise(EXERCISE_IDS.pullup, "Dominadas", "Tracción", "peso corporal"),
  exercise(EXERCISE_IDS.rdl, "Peso muerto rumano", "Pierna", "barra"),
  exercise(EXERCISE_IDS.bulgarian, "Zancada búlgara", "Pierna", "mancuernas"),
  exercise(EXERCISE_IDS.row, "Remo con barra", "Tracción", "barra"),
  exercise(EXERCISE_IDS.legPress, "Prensa inclinada", "Pierna", "máquina"),
  exercise(EXERCISE_IDS.legCurl, "Curl femoral tumbado", "Pierna", "máquina"),
  exercise(EXERCISE_IDS.ohp, "Press militar", "Empuje", "barra"),
  exercise(EXERCISE_IDS.inclineDb, "Press inclinado mancuernas", "Empuje", "mancuernas"),
];
