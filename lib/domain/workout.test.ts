import { describe, expect, it } from "vitest";
import type { RoutineDay, WorkoutLog } from "./schemas";
import { dayRecordOn, defaultRoutineDay, latestDayRecord } from "./workout";

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
