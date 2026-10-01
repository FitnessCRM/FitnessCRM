import type { Prescription, Routine, RoutineDay, RoutineTemplate } from "@/lib/domain";
import { CLIENT_IDS, TRAINER_ID, ts, type DemoDates } from "./common";
import { EXERCISE_IDS as EX } from "./exercises";

type Rx = [
  exerciseId: string,
  sets: number,
  repsMin: number,
  repsMax: number | null,
  rir: string,
  rest?: string,
  note?: string,
];

const rx = (
  [exerciseId, sets, repsMin, repsMax, rir, rest = "", note = ""]: Rx,
  id: string,
): { id: string; exerciseId: string; prescription: Prescription } => ({
  id,
  exerciseId,
  prescription: { sets, repsMin, repsMax, rir, rest, note },
});

function day(prefix: string, dayNumber: number, label: string, rows: Rx[]): RoutineDay {
  return {
    id: `${prefix}-d${dayNumber}`,
    dayNumber,
    label,
    exercises: rows.map((row, i) => rx(row, `${prefix}-d${dayNumber}-e${i + 1}`)),
  };
}

/** Días del "Editor de plan" (Torso / Pierna / Torso) más dos días que completan las 5 sesiones. */
function hyper5dDays(prefix: string): RoutineDay[] {
  return [
    day(prefix, 1, "Torso", [
      [EX.bench, 4, 6, 8, "2", "3 min"],
      [EX.row, 4, 8, 10, "2", "2 min"],
      [EX.ohp, 3, 8, 10, "1-2", "2 min"],
    ]),
    day(prefix, 2, "Pierna", [
      [EX.squat, 4, 6, 8, "2", "3 min"],
      [EX.legPress, 3, 10, 12, "1-2", "2 min"],
      [EX.bulgarian, 3, 8, 10, "2", "", "por pierna"],
      [EX.legCurl, 3, 12, 15, "1"],
    ]),
    day(prefix, 3, "Torso", [
      [EX.pullup, 4, 6, 10, "2", "3 min"],
      [EX.inclineDb, 3, 8, 10, "2", "2 min"],
    ]),
    day(prefix, 4, "Pierna", [
      [EX.rdl, 4, 6, 8, "2", "3 min"],
      [EX.bulgarian, 3, 8, 10, "2", "", "por pierna"],
      [EX.legCurl, 3, 12, 15, "1"],
    ]),
    day(prefix, 5, "Torso", [
      [EX.bench, 3, 8, 10, "1-2", "2 min"],
      [EX.pullup, 3, 6, 10, "2", "2 min"],
      [EX.ohp, 3, 8, 12, "1"],
    ]),
  ];
}

/** Las tres plantillas de rutina de la pantalla "Plantillas" y la rutina activa de Marta. */
export function buildRoutines(d: DemoDates): {
  routineTemplates: RoutineTemplate[];
  routines: Routine[];
} {
  const templateBase = { trainerId: TRAINER_ID, note: "", createdAt: ts(d.daysAgo(180)) };
  const routineTemplates: RoutineTemplate[] = [
    {
      ...templateBase,
      id: "rt-hiper-5d-v3",
      name: "Hiper 5d v3",
      description: "torso/pierna",
      days: hyper5dDays("rt1"),
      updatedAt: ts(d.daysAgo(17)),
    },
    {
      ...templateBase,
      id: "rt-fuerza-basicos-3d",
      name: "Fuerza básicos 3d",
      description: "SBD",
      days: [
        day("rt2", 1, "Sentadilla", [
          [EX.squat, 5, 5, null, "1", "4 min"],
          [EX.legPress, 3, 8, 10, "2"],
        ]),
        day("rt2", 2, "Banca", [
          [EX.bench, 5, 5, null, "1", "4 min"],
          [EX.row, 4, 8, 10, "2"],
        ]),
        day("rt2", 3, "Peso muerto", [
          [EX.rdl, 5, 5, null, "1", "4 min"],
          [EX.pullup, 4, 6, 8, "2"],
        ]),
      ],
      updatedAt: ts(d.daysAgo(27)),
    },
    {
      ...templateBase,
      id: "rt-full-body-2d",
      name: "Full body 2d",
      description: "principiantes",
      days: [
        day("rt3", 1, "A", [
          [EX.squat, 3, 8, 10, "3"],
          [EX.bench, 3, 8, 10, "3"],
          [EX.row, 3, 10, 12, "3"],
        ]),
        day("rt3", 2, "B", [
          [EX.rdl, 3, 8, 10, "3"],
          [EX.ohp, 3, 8, 10, "3"],
          [EX.pullup, 3, 5, 8, "3"],
        ]),
      ],
      updatedAt: ts(d.daysAgo(45)),
    },
  ];
  const routines: Routine[] = [
    {
      id: "rt-marta-hipertrofia",
      trainerId: TRAINER_ID,
      clientId: CLIENT_IDS.marta,
      name: "Hipertrofia — Torso / Pierna",
      note: "Esta semana sube 2,5 kg en sentadilla si el RIR 2 se te queda fácil. En la búlgara prioriza el rango completo antes que el peso.",
      days: hyper5dDays("r-marta"),
      status: "activo",
      sourceTemplateName: "Hiper 5d v3",
      createdAt: ts(d.martaStart),
      updatedAt: ts(d.daysAgo(5)),
    },
  ];
  return { routineTemplates, routines };
}
