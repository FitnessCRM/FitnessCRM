import { describe, expect, it } from "vitest";
import { NOW } from "./__tests__/fixtures";
import { DomainError } from "./errors";
import {
  assertExercisesInLibrary,
  removeExerciseFromRoutine,
  routinesUsingExercise,
} from "./routine";
import type { Routine } from "./schemas";

function routine(id: string, exerciseIds: string[]): Routine {
  return {
    id,
    trainerId: "t",
    clientId: `c-${id}`,
    name: "Rutina",
    note: "",
    status: "activo",
    sourceTemplateName: null,
    createdAt: NOW,
    updatedAt: NOW,
    days: [
      {
        id: `${id}-d1`,
        dayNumber: 1,
        label: "",
        exercises: exerciseIds.map((exerciseId, i) => ({
          id: `${id}-e${i}`,
          exerciseId,
          prescription: { sets: 3, repsMin: 8, repsMax: 10, rir: "2", rest: "", note: "" },
        })),
      },
    ],
  };
}

describe("archiving a library exercise", () => {
  const routines = [routine("a", ["ex-squat", "ex-press"]), routine("b", ["ex-press"])];

  it("reports which routines prescribe it so the trainer can be warned", () => {
    expect(routinesUsingExercise(routines, "ex-squat").map((r) => r.id)).toEqual(["a"]);
    expect(routinesUsingExercise(routines, "ex-press").map((r) => r.id)).toEqual(["a", "b"]);
    expect(routinesUsingExercise(routines, "ex-none")).toEqual([]);
  });

  it("removes it from every day, keeping the day and the other exercises", () => {
    const updated = removeExerciseFromRoutine(routines[0]!, "ex-squat");
    expect(updated.days).toHaveLength(1);
    expect(updated.days[0]?.exercises.map((e) => e.exerciseId)).toEqual(["ex-press"]);
    expect(routines[0]?.days[0]?.exercises).toHaveLength(2);
  });
});

describe("I3 · a routine only prescribes exercises of its trainer's library", () => {
  const library = [
    { id: "ex-a", status: "activo" as const },
    { id: "ex-b", status: "activo" as const },
    { id: "ex-old", status: "archivado" as const },
  ];

  it("accepts a body that only uses active exercises of the library", () => {
    expect(() => assertExercisesInLibrary(routine("r", ["ex-a", "ex-b"]), library)).not.toThrow();
    expect(() => assertExercisesInLibrary({ days: [] }, library)).not.toThrow();
  });

  it("rejects an exercise that is not in the library (another trainer's, or none at all)", () => {
    expect(() => assertExercisesInLibrary(routine("r", ["ex-a", "ex-ajeno"]), library)).toThrow(
      DomainError,
    );
  });

  it("rejects an archived exercise: it left the library (section 7)", () => {
    expect(() => assertExercisesInLibrary(routine("r", ["ex-old"]), library)).toThrow(DomainError);
  });
});
