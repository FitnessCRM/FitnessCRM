import { describe, expect, it } from "vitest";
import type { RoutineDay, WorkoutLog } from "./schemas";
import { dayRecordOn, defaultRoutineDay, lastExerciseRecord, latestDayRecord } from "./workout";

function day(dayNumber: number, sets: number[]): RoutineDay {
  return {
    id: `d${dayNumber}`,
    dayNumber,
    label: "",
    exercises: sets.map((s, i) => ({
      id: `d${dayNumber}-e${i + 1}`,
      exerciseId: `ex-${dayNumber}-${i + 1}`,
      prescription: { sets: s, repsMin: 8, repsMax: 10, rir: "2", rest: "", note: "" },
    })),
  };
}

let seq = 0;
function log(
  routineDayExerciseId: string,
  date: string,
  setNumber: number,
  time = "10:00:00",
): WorkoutLog {
  return {
    id: `wl-${++seq}`,
    trainerId: "t",
    clientId: "c",
    exerciseId: "ex",
    routineId: "r",
    routineDayExerciseId,
    date,
    setNumber,
    weightKg: 60,
    reps: 8,
    createdAt: `${date}T${time}Z`,
  };
}

const routine = { days: [day(1, [3, 3]), day(2, [4, 3]), day(3, [3])] };

describe("defaultRoutineDay", () => {
  it("opens the first day when nothing was ever logged", () => {
    expect(defaultRoutineDay(routine, [])?.dayNumber).toBe(1);
  });

  it("opens the day after the last one with logs", () => {
    const logs = [log("d1-e1", "2026-09-10", 1), log("d2-e1", "2026-09-12", 1)];
    expect(defaultRoutineDay(routine, logs)?.dayNumber).toBe(3);
  });

  it("wraps around to the first day after the last", () => {
    expect(defaultRoutineDay(routine, [log("d3-e1", "2026-09-12", 1)])?.dayNumber).toBe(1);
  });

  it("breaks same-date ties by creation time", () => {
    const logs = [
      log("d2-e1", "2026-09-12", 1, "18:00:00"),
      log("d1-e1", "2026-09-12", 1, "09:00:00"),
    ];
    expect(defaultRoutineDay(routine, logs)?.dayNumber).toBe(3);
  });

  it("ignores logs whose prescription is no longer in the routine", () => {
    const logs = [log("gone", "2026-09-15", 1), log("d1-e2", "2026-09-10", 1)];
    expect(defaultRoutineDay(routine, logs)?.dayNumber).toBe(2);
  });

  it("returns undefined for a routine without days", () => {
    expect(defaultRoutineDay({ days: [] }, [])).toBeUndefined();
  });
});

describe("dayRecordOn", () => {
  const d2 = day(2, [4, 3]);
  const logs = [
    log("d2-e1", "2026-09-05", 1),
    log("d2-e1", "2026-09-12", 1),
    log("d2-e2", "2026-09-12", 2),
    log("d1-e1", "2026-09-12", 1),
  ];

  it("returns only the logs of that exact date", () => {
    const record = dayRecordOn(d2, logs, "2026-09-12");
    expect(record.date).toBe("2026-09-12");
    expect(record.loggedSets).toBe(2);
    expect(record.logs.map((l) => l.routineDayExerciseId)).toEqual(["d2-e1", "d2-e2"]);
  });

  it("is empty on a date without logs, even if earlier dates have them", () => {
    expect(dayRecordOn(d2, logs, "2026-09-19")).toEqual({
      date: "2026-09-19",
      logs: [],
      totalSets: 7,
      loggedSets: 0,
    });
  });
});

describe("latestDayRecord", () => {
  const d2 = day(2, [4, 3]);

  it("ignores dates from today onwards when asked for what came before", () => {
    const logs = [
      log("d2-e1", "2026-09-05", 1),
      log("d2-e1", "2026-09-12", 1),
      log("d2-e1", "2026-09-19", 1),
    ];
    const previous = latestDayRecord(d2, logs, { before: "2026-09-19" });
    expect(previous.date).toBe("2026-09-12");
    expect(previous.logs).toHaveLength(1);
    expect(latestDayRecord(d2, logs, { before: "2026-09-05" }).date).toBeNull();
  });

  it("counts nothing when the day was never logged", () => {
    expect(latestDayRecord(d2, [log("d1-e1", "2026-09-10", 1)])).toEqual({
      date: null,
      logs: [],
      totalSets: 7,
      loggedSets: 0,
    });
  });

  it("counts only the most recent logging date of that day", () => {
    const logs = [
      log("d2-e1", "2026-09-05", 1),
      log("d2-e1", "2026-09-05", 2),
      log("d2-e1", "2026-09-05", 3),
      log("d2-e1", "2026-09-12", 1),
      log("d2-e2", "2026-09-12", 2),
      log("d1-e1", "2026-09-15", 1),
    ];
    const record = latestDayRecord(d2, logs);
    expect(record.date).toBe("2026-09-12");
    expect(record.loggedSets).toBe(2);
    expect(record.logs.every((l) => l.date === "2026-09-12")).toBe(true);
  });

  it("keeps the newest log when a set was saved twice on the same date", () => {
    const first = log("d2-e1", "2026-09-12", 1, "10:00:00");
    const second = log("d2-e1", "2026-09-12", 1, "10:05:00");
    const record = latestDayRecord(d2, [second, first]);
    expect(record.logs.map((l) => l.id)).toEqual([second.id]);
    expect(record.loggedSets).toBe(1);
  });

  it("does not count sets above the current prescription", () => {
    const logs = [log("d2-e2", "2026-09-12", 3), log("d2-e2", "2026-09-12", 4)];
    const record = latestDayRecord(d2, logs);
    expect(record.logs).toHaveLength(2);
    expect(record.loggedSets).toBe(1);
  });
});

describe("line ids carry over between routine versions (§7)", () => {
  // La versión archivada tenía dos líneas en el día 2; la nueva conserva los ids de lo que sigue
  // (día y primera línea), quita la segunda y añade una línea nueva con id propio.
  const archived = day(2, [4, 3]);
  const next: RoutineDay = {
    ...archived,
    exercises: [
      {
        ...archived.exercises[0]!,
        prescription: { ...archived.exercises[0]!.prescription, sets: 5 },
      },
      { id: "d2-new", exerciseId: "ex-nuevo", prescription: archived.exercises[1]!.prescription },
    ],
  };
  const onArchived = (id: string, date: string, set: number) => ({
    ...log(id, date, set),
    routineId: "r-archived",
  });
  const logs = [
    onArchived("d2-e1", "2026-09-20", 1),
    onArchived("d2-e1", "2026-09-20", 2),
    onArchived("d2-e2", "2026-09-20", 1),
  ];

  it("a log made on the archived version resolves to the same line of the new one", () => {
    const record = latestDayRecord(next, logs);
    expect(record.date).toBe("2026-09-20");
    expect(record.logs.map((l) => l.routineDayExerciseId)).toEqual(["d2-e1", "d2-e1"]);
    expect(record.loggedSets).toBe(2);
    expect(defaultRoutineDay({ days: [day(1, [3]), next] }, logs)?.dayNumber).toBe(1);
  });

  it("the log of a removed line still resolves in the archived version", () => {
    const record = latestDayRecord(archived, logs);
    expect(record.logs.map((l) => l.routineDayExerciseId).sort()).toEqual([
      "d2-e1",
      "d2-e1",
      "d2-e2",
    ]);
    expect(latestDayRecord(next, logs).logs.some((l) => l.routineDayExerciseId === "d2-e2")).toBe(
      false,
    );
  });
});

describe("lastExerciseRecord", () => {
  const of = (exerciseId: string, line: string, date: string, set: number, weightKg = 60) => ({
    ...log(line, date, set),
    exerciseId,
    weightKg,
  });

  it("finds the last day before the given one on which the exercise was logged", () => {
    const logs = [
      of("sentadilla", "d1-e1", "2026-09-10", 1),
      of("sentadilla", "d1-e1", "2026-09-17", 1, 70),
      of("sentadilla", "d1-e1", "2026-09-24", 1, 80),
    ];
    const last = lastExerciseRecord("sentadilla", logs, "2026-09-24");
    expect(last?.date).toBe("2026-09-17");
    expect(last?.logs.map((l) => l.weightKg)).toEqual([70]);
  });

  it("ignores today and later days, and other exercises", () => {
    const logs = [
      of("sentadilla", "d1-e1", "2026-09-24", 1),
      of("press", "d1-e2", "2026-09-20", 1),
    ];
    expect(lastExerciseRecord("sentadilla", logs, "2026-09-24")).toBeNull();
    expect(lastExerciseRecord("sentadilla", [], "2026-09-24")).toBeNull();
  });

  it("finds it even when the day it was last logged on did not include it", () => {
    // El día 1 se registró el 20 con sentadilla; el 22 se registró el día 1 sin ella.
    const logs = [
      of("sentadilla", "d1-e1", "2026-09-20", 1, 75),
      of("press", "d1-e2", "2026-09-22", 1),
    ];
    expect(lastExerciseRecord("sentadilla", logs, "2026-09-24")?.date).toBe("2026-09-20");
  });

  it("follows the exercise to another routine day or a new line", () => {
    const logs = [
      of("sentadilla", "d1-e1", "2026-09-20", 1),
      of("sentadilla", "d3-new", "2026-09-22", 1),
    ];
    expect(
      lastExerciseRecord("sentadilla", logs, "2026-09-24")?.logs[0]?.routineDayExerciseId,
    ).toBe("d3-new");
  });

  it("lists the sets in order and keeps the newest when one was saved twice", () => {
    const logs = [
      of("sentadilla", "d1-e1", "2026-09-20", 2, 70),
      { ...of("sentadilla", "d1-e1", "2026-09-20", 1, 60), createdAt: "2026-09-20T10:00:00Z" },
      { ...of("sentadilla", "d1-e1", "2026-09-20", 1, 65), createdAt: "2026-09-20T11:00:00Z" },
    ];
    const last = lastExerciseRecord("sentadilla", logs, "2026-09-24");
    expect(last?.logs.map((l) => [l.setNumber, l.weightKg])).toEqual([
      [1, 65],
      [2, 70],
    ]);
  });
});
