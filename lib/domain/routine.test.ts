import { describe, expect, it } from "vitest";
import { NOW } from "./__tests__/fixtures";
import { DomainError } from "./errors";
import {
  archiveExerciseInRoutines,
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
    sourceTemplateId: null,
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

describe("E7 · archiving an exercise versions the active routines", () => {
  const later = "2026-11-03T10:00:00.000Z";
  const draft = { ...routine("d", ["ex-squat", "ex-press"]), status: "borrador" as const };
  const archived = { ...routine("x", ["ex-squat"]), status: "archivado" as const };
  const all = [routine("a", ["ex-squat", "ex-press"]), routine("b", ["ex-press"]), draft, archived];
  let n = 0;
  const result = archiveExerciseInRoutines(all, "ex-squat", {
    now: later,
    newId: () => `new-${++n}`,
  });

  it("archives the active routine as it was, with the exercise inside", () => {
    const old = result.find((r) => r.id === "a")!;
    expect(old.status).toBe("archivado");
    expect(old.days[0]?.exercises.map((e) => e.exerciseId)).toEqual(["ex-squat", "ex-press"]);
  });

  it("replaces it with a new active version without the exercise, keeping line ids", () => {
    const version = result.find((r) => r.id === "new-1")!;
    expect(version.status).toBe("activo");
    expect(version.clientId).toBe("c-a");
    expect(version.createdAt).toBe(later);
    expect(version.days[0]?.exercises.map((e) => e.id)).toEqual(["a-e1"]);
    expect(result.filter((r) => r.clientId === "c-a" && r.status === "activo")).toHaveLength(1);
  });

  it("edits drafts in place and leaves the rest untouched", () => {
    const d = result.find((r) => r.id === "d")!;
    expect(d.status).toBe("borrador");
    expect(d.days[0]?.exercises.map((e) => e.exerciseId)).toEqual(["ex-press"]);
    expect(result.find((r) => r.id === "b")).toBe(all[1]);
    expect(result.find((r) => r.id === "x")).toBe(archived);
    expect(result).toHaveLength(5);
  });
});
