import { describe, expect, it } from "vitest";
import { membershipHistory, membershipStanding } from "./membership";
import type { Membership } from "./schemas";

let seq = 0;
function membership(
  startDate: string,
  endDate: string,
  paymentStatus: Membership["paymentStatus"] = "pagada",
): Membership {
  const id = `mb-${++seq}`;
  return {
    id,
    trainerId: "t",
    clientId: "c",
    type: "trimestral",
    startDate,
    endDate,
    paymentStatus,
    createdAt: `${startDate}T08:00:00Z`,
  };
}

describe("membershipStanding", () => {
  const past = membership("2026-04-01", "2026-06-30");
  const current = membership("2026-07-01", "2026-09-30");
  const future = membership("2026-10-01", "2026-12-31", "no_pagada");
  const all = [future, past, current];

  it("finds the one containing the date, the next one, and what is left", () => {
    const s = membershipStanding(all, "2026-09-20");
    expect(s.current?.id).toBe(current.id);
    expect(s.next?.id).toBe(future.id);
    expect(s.daysLeft).toBe(10);
    expect(s.elapsed).toBeCloseTo(81 / 91);
  });

  it("counts the first and the last day as inside the period", () => {
    expect(membershipStanding(all, "2026-07-01").current?.id).toBe(current.id);
    expect(membershipStanding(all, "2026-07-01").elapsed).toBe(0);
    const lastDay = membershipStanding(all, "2026-09-30");
    expect(lastDay.current?.id).toBe(current.id);
    expect(lastDay.daysLeft).toBe(0);
    expect(lastDay.elapsed).toBe(1);
  });

  it("has no current membership in a gap between two, but still announces the next", () => {
    const s = membershipStanding([past, future], "2026-08-15");
    expect(s.current).toBeNull();
    expect(s.next?.id).toBe(future.id);
    expect(s.daysLeft).toBeNull();
    expect(s.elapsed).toBeNull();
  });

  it("has no next once the last one is running", () => {
    expect(membershipStanding([past, current], "2026-09-20").next).toBeNull();
  });

  it("prefers the one that started later when two overlap", () => {
    const overlapping = membership("2026-09-15", "2026-11-30");
    expect(membershipStanding([current, overlapping], "2026-09-20").current?.id).toBe(
      overlapping.id,
    );
  });

  it("returns nothing at all without memberships", () => {
    expect(membershipStanding([], "2026-09-20")).toEqual({
      current: null,
      next: null,
      daysLeft: null,
      elapsed: null,
    });
  });
});

describe("membershipHistory", () => {
  it("lists the most recent first, renewals included", () => {
    const rows = membershipHistory([
      membership("2026-07-01", "2026-09-30"),
      membership("2026-10-01", "2026-12-31"),
      membership("2026-04-01", "2026-06-30"),
    ]);
    expect(rows.map((m) => m.startDate)).toEqual(["2026-10-01", "2026-07-01", "2026-04-01"]);
  });
});
