import { describe, expect, it } from "vitest";
import {
  isExpiringSoon,
  membershipEndDate,
  matchesMembershipFilter,
  membershipHistory,
  membershipStanding,
  overlappingMembershipIds,
} from "./membership";
import type { Membership } from "./schemas";
import { addCivilDays } from "./week";

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

describe("isExpiringSoon", () => {
  const m = membership("2026-09-01", "2026-09-30");

  it("is true for the current membership within 7 days of its end, last day included", () => {
    expect(isExpiringSoon(m, "2026-09-23")).toBe(true);
    expect(isExpiringSoon(m, "2026-09-30")).toBe(true);
    expect(isExpiringSoon(m, "2026-09-22")).toBe(false);
  });

  it("is false when it has not started or is already over", () => {
    expect(isExpiringSoon(m, "2026-08-31")).toBe(false);
    expect(isExpiringSoon(m, "2026-10-01")).toBe(false);
  });
});

describe("overlappingMembershipIds", () => {
  it("flags both memberships of a pair that overlap, extremes included", () => {
    const a = membership("2026-07-01", "2026-07-31");
    const b = membership("2026-07-31", "2026-08-31");
    expect([...overlappingMembershipIds([a, b])].sort()).toEqual([a.id, b.id].sort());
  });

  it("does not flag back-to-back memberships", () => {
    const a = membership("2026-07-01", "2026-07-31");
    const b = membership("2026-08-01", "2026-08-31");
    expect(overlappingMembershipIds([a, b]).size).toBe(0);
  });

  it("catches a short one inside a long one, even with another in between", () => {
    const long = membership("2026-01-01", "2026-12-31");
    const middle = membership("2026-03-01", "2026-03-31");
    const late = membership("2026-06-01", "2026-06-30");
    expect(overlappingMembershipIds([long, middle, late]).size).toBe(3);
  });

  it("only compares memberships of the same client", () => {
    const a = membership("2026-07-01", "2026-07-31");
    const other = { ...membership("2026-07-15", "2026-08-15"), clientId: "other" };
    expect(overlappingMembershipIds([a, other]).size).toBe(0);
  });
});

describe("matchesMembershipFilter", () => {
  const unpaidOver = membership("2026-06-01", "2026-06-30", "no_pagada");
  const paidEnding = membership("2026-09-01", "2026-09-30");

  it("all matches everything, unpaid looks at payment only, expiring only at current ones", () => {
    const today = "2026-09-25";
    expect(matchesMembershipFilter(unpaidOver, "all", today)).toBe(true);
    expect(matchesMembershipFilter(unpaidOver, "unpaid", today)).toBe(true);
    expect(matchesMembershipFilter(unpaidOver, "expiring", today)).toBe(false);
    expect(matchesMembershipFilter(paidEnding, "unpaid", today)).toBe(false);
    expect(matchesMembershipFilter(paidEnding, "expiring", today)).toBe(true);
  });
});

describe("membershipEndDate", () => {
  it("ends the day before the same day of the month the type counts to", () => {
    expect(membershipEndDate("mensual", "2026-09-01")).toBe("2026-09-30");
    expect(membershipEndDate("trimestral", "2026-09-01")).toBe("2026-11-30");
    expect(membershipEndDate("semestral", "2026-09-15")).toBe("2027-03-14");
    expect(membershipEndDate("anual", "2026-09-01")).toBe("2027-08-31");
  });

  it("makes the next period start the day after the end", () => {
    const end = membershipEndDate("trimestral", "2026-09-01");
    expect(addCivilDays(end, 1)).toBe("2026-12-01");
  });

  it("stays in the last day of a shorter month and crosses the year", () => {
    expect(membershipEndDate("mensual", "2026-01-31")).toBe("2026-02-27");
    expect(membershipEndDate("anual", "2028-02-29")).toBe("2029-02-27");
    expect(membershipEndDate("trimestral", "2026-11-15")).toBe("2027-02-14");
  });
});
