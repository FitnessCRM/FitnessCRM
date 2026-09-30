import { describe, expect, it } from "vitest";
import { review, weightLog } from "./__tests__/fixtures";
import {
  changeSinceStart,
  lastWeeksRange,
  latestWeightLog,
  mergeWeightLogInput,
  reviewUsingWeightLog,
  sevenDayAverage,
  weeklyWeights,
  weightSummary,
} from "./weight";

const log = (id: string, date: string, weightKg: number, createdAt = `${date}T07:00:00Z`) =>
  weightLog({ id, date, weightKg, createdAt });

/** Los pesajes de Marta de la demo. */
const marta = [
  log("a", "2026-08-01", 65.5),
  log("b", "2026-08-03", 65.2),
  log("c", "2026-08-05", 65.0),
  log("d", "2026-08-08", 64.8),
  log("e", "2026-08-10", 64.7),
  log("f", "2026-08-12", 64.5),
  log("g", "2026-08-15", 64.3),
  log("h", "2026-08-17", 64.2),
  log("i", "2026-08-19", 64.6),
  log("j", "2026-08-22", 63.9),
  log("k", "2026-08-24", 64.1),
  log("l", "2026-08-26", 63.8),
  log("m", "2026-08-29", 63.4),
];

describe("latestWeightLog", () => {
  it("picks the most recent date regardless of array order", () => {
    expect(latestWeightLog([...marta].reverse())?.id).toBe("m");
  });
  it("breaks same-day ties by creation time and is null without logs", () => {
    const logs = [
      log("x", "2026-08-29", 63.6, "2026-08-29T06:00:00Z"),
      log("y", "2026-08-29", 63.4, "2026-08-29T21:00:00Z"),
    ];
    expect(latestWeightLog(logs)?.id).toBe("y");
    expect(latestWeightLog([])).toBeNull();
  });
});

describe("sevenDayAverage", () => {
  it("averages the 7 civil days ending on the latest log, inclusive, rounded to 1 decimal", () => {
    // Ventana 23-08 … 29-08 → 24 (64,1), 26 (63,8), 29 (63,4) → 63,766… → 63,8
    expect(sevenDayAverage(marta)).toBe(63.8);
  });
  it("includes the edge day and excludes the day before the window", () => {
    const logs = [
      log("p", "2026-08-23", 70),
      log("q", "2026-08-29", 60),
      log("r", "2026-08-22", 99),
    ];
    expect(sevenDayAverage(logs)).toBe(65);
  });
  it("is null with fewer than 2 logs in the window, even if older logs exist", () => {
    expect(
      sevenDayAverage([log("a", "2026-08-01", 65.5), log("m", "2026-08-29", 63.4)]),
    ).toBeNull();
    expect(sevenDayAverage([log("m", "2026-08-29", 63.4)])).toBeNull();
    expect(sevenDayAverage([])).toBeNull();
  });
  it("anchors to the latest log, not to today: an old streak still has an average", () => {
    const logs = [log("a", "2026-01-01", 70), log("b", "2026-01-03", 71)];
    expect(sevenDayAverage(logs)).toBe(70.5);
  });
});

describe("changeSinceStart", () => {
  it("is latest minus first recorded weigh-in (Marta: −2,1)", () => {
    expect(changeSinceStart(marta)).toBe(-2.1);
  });
  it("is positive when weight goes up and null with fewer than 2 logs", () => {
    expect(changeSinceStart([log("a", "2026-08-01", 60), log("b", "2026-08-09", 61.25)])).toBe(1.3);
    expect(changeSinceStart([log("a", "2026-08-01", 60)])).toBeNull();
    expect(changeSinceStart([])).toBeNull();
  });
  it("uses the first weigh-in as start, not the client's start date", () => {
    const logs = [log("a", "2026-08-10", 64.7), log("m", "2026-08-29", 63.4)];
    expect(changeSinceStart(logs)).toBe(-1.3);
  });
});

describe("weightSummary", () => {
  it("returns the three figures together and all null when empty", () => {
    expect(weightSummary(marta)).toMatchObject({ sevenDayAverage: 63.8, changeSinceStart: -2.1 });
    expect(weightSummary(marta).latest?.weightKg).toBe(63.4);
    expect(weightSummary([])).toEqual({
      latest: null,
      sevenDayAverage: null,
      changeSinceStart: null,
    });
  });
});

describe("weeklyWeights", () => {
  it("takes the latest weigh-in of each client week and leaves gaps as null", () => {
    const points = weeklyWeights(marta, "2026-08-01", 1, 6);
    expect(points.map((p) => p.weightKg)).toEqual([65.0, 64.5, 64.6, 63.8, 63.4, null]);
    expect(points[4]).toEqual({ week: 5, weightKg: 63.4, date: "2026-08-29" });
  });
  it("shows a skipped week as a gap between two values", () => {
    const logs = [log("a", "2026-08-01", 65.5), log("m", "2026-08-15", 64.3)];
    expect(weeklyWeights(logs, "2026-08-01", 1, 3).map((p) => p.weightKg)).toEqual([
      65.5,
      null,
      64.3,
    ]);
  });
  it("never starts before week 1", () => {
    expect(lastWeeksRange(5)).toEqual({ from: 1, to: 5 });
    expect(lastWeeksRange(9)).toEqual({ from: 4, to: 9 });
    expect(weeklyWeights([], "2026-08-01", -3, 2)).toHaveLength(2);
  });
});

describe("reviewUsingWeightLog", () => {
  it("marks the log a review references as review day, nothing else", () => {
    const reviews = [review({ weightLogId: "m" })];
    expect(reviewUsingWeightLog(log("m", "2026-08-29", 63.4), reviews)?.id).toBe("r-1");
    expect(reviewUsingWeightLog(log("l", "2026-08-26", 63.8), reviews)).toBeNull();
  });
});

describe("mergeWeightLogInput (I23)", () => {
  it("replaces the note when a new one arrives", () => {
    expect(mergeWeightLogInput({ note: "antes" }, { weightKg: 64, note: "  ahora " }).note).toBe(
      "ahora",
    );
  });

  it("keeps the previous note when the new one is empty", () => {
    expect(mergeWeightLogInput({ note: "antes" }, { weightKg: 64, note: "" }).note).toBe("antes");
    expect(mergeWeightLogInput({ note: "antes" }, { weightKg: 64, note: "   " }).note).toBe(
      "antes",
    );
  });

  it("has nothing to keep on a first weigh-in", () => {
    expect(mergeWeightLogInput(undefined, { weightKg: 64, note: "" }).note).toBe("");
  });
});
