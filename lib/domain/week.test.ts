import { describe, expect, it } from "vitest";
import { DomainError } from "./errors";
import {
  addCivilDays,
  civilDateInTimeZone,
  civilDaysBetween,
  daysUntilNextReview,
  reviewWindowForWeek,
  weekNumber,
} from "./week";

const TZ = "Europe/Madrid";

describe("weekNumber (§8)", () => {
  it("is 1 on the start date and stays 1 for six more days", () => {
    expect(weekNumber("2026-08-01", "2026-08-01", TZ)).toBe(1);
    expect(weekNumber("2026-08-01", "2026-08-07", TZ)).toBe(1);
  });

  it("rolls to 2 on day 7 and to 5 on day 28", () => {
    expect(weekNumber("2026-08-01", "2026-08-08", TZ)).toBe(2);
    expect(weekNumber("2026-08-01", "2026-08-29", TZ)).toBe(5);
  });

  it("skipping a week leaves a gap: no phantom week", () => {
    expect(weekNumber("2026-08-01", "2026-08-15", TZ)).toBe(3);
    expect(weekNumber("2026-08-01", "2026-08-29", TZ)).toBe(5);
  });

  it("projects an instant to the trainer's time zone before counting", () => {
    // 22:30 UTC on Aug 7 is already Aug 8 in Madrid (UTC+2 in summer) → week 2
    const instant = new Date("2026-08-07T22:30:00Z");
    expect(weekNumber("2026-08-01", instant, TZ)).toBe(2);
    expect(weekNumber("2026-08-01", instant, "UTC")).toBe(1);
  });

  it("is not affected by the DST change", () => {
    // Europe/Madrid leaves DST on 2026-10-25
    expect(weekNumber("2026-10-19", "2026-10-26", TZ)).toBe(2);
    expect(weekNumber("2026-10-19", "2026-10-25", TZ)).toBe(1);
  });

  it("rejects dates before the start date", () => {
    expect(() => weekNumber("2026-08-01", "2026-07-31", TZ)).toThrow(DomainError);
  });
});

describe("reviewWindowForWeek", () => {
  it("covers the seven civil days of the week", () => {
    expect(reviewWindowForWeek("2026-08-01", 1)).toEqual({
      start: "2026-08-01",
      end: "2026-08-07",
    });
    expect(reviewWindowForWeek("2026-08-01", 5)).toEqual({
      start: "2026-08-29",
      end: "2026-09-04",
    });
  });

  it("agrees with weekNumber at both edges", () => {
    const w = reviewWindowForWeek("2026-08-01", 5);
    expect(weekNumber("2026-08-01", w.start, TZ)).toBe(5);
    expect(weekNumber("2026-08-01", w.end, TZ)).toBe(5);
    expect(weekNumber("2026-08-01", addCivilDays(w.end, 1), TZ)).toBe(6);
  });

  it("rejects week 0", () => {
    expect(() => reviewWindowForWeek("2026-08-01", 0)).toThrow(DomainError);
  });
});

describe("civil date helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addCivilDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(civilDaysBetween("2026-02-27", "2026-03-02")).toBe(3);
  });

  it("converts instants to civil dates in a time zone", () => {
    expect(civilDateInTimeZone("2026-08-07T22:30:00Z", TZ)).toBe("2026-08-08");
    expect(civilDateInTimeZone("2026-08-07T22:30:00Z", "America/New_York")).toBe("2026-08-07");
  });

  it("computes days until next review from the cadence", () => {
    expect(daysUntilNextReview("2026-08-22", "2026-08-01", 7, "2026-08-27")).toBe(2);
    expect(daysUntilNextReview(null, "2026-08-01", 7, "2026-08-10")).toBe(-2);
  });
});
