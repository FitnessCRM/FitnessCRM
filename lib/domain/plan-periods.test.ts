import { describe, expect, it } from "vitest";
import { TZ } from "./__tests__/fixtures";
import { menuSetPeriods, planOverlaps, routinePeriods } from "./plan-periods";
import type { Menu, Routine } from "./schemas";

const routine = (id: string, status: Routine["status"], createdAt: string, updatedAt: string) =>
  ({
    id,
    trainerId: "t-adrian",
    clientId: "c-marta",
    name: id,
    note: "",
    days: [],
    status,
    sourceTemplateName: null,
    createdAt,
    updatedAt,
  }) satisfies Routine;

const menu = (
  id: string,
  dayType: Menu["dayType"],
  status: Menu["status"],
  createdAt: string,
  updatedAt: string,
) =>
  ({
    id,
    trainerId: "t-adrian",
    clientId: "c-marta",
    name: id,
    dayType,
    suggested: false,
    macros: { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
    note: "",
    meals: [],
    status,
    sourceTemplateName: null,
    createdAt,
    updatedAt,
  }) satisfies Menu;

describe("when a routine was in force", () => {
  // r1 se archivó el 10-09 al activar r2; r2 el 05-10 al activar r3; r3 sigue activa desde el 05-10.
  const routines = [
    routine("r3", "activo", "2026-10-01T09:00:00Z", "2026-10-05T09:00:00Z"),
    routine("r1", "archivado", "2026-09-01T09:00:00Z", "2026-09-10T09:00:00Z"),
    routine("r2", "archivado", "2026-09-08T09:00:00Z", "2026-10-05T09:00:00Z"),
    routine("draft", "borrador", "2026-10-06T09:00:00Z", "2026-10-06T09:00:00Z"),
  ];

  it("chains each archived routine from the archiving of the previous one", () => {
    const periods = routinePeriods(routines, TZ);
    expect(periods.map((p) => [p.routine.id, p.from, p.to])).toEqual([
      ["r1", "2026-09-01", "2026-09-10"], // el primero: no consta su activación, se usa su creación
      ["r2", "2026-09-10", "2026-10-05"],
      ["r3", "2026-10-05", null], // la activa: desde que se activó, y sigue en uso
    ]);
  });

  it("leaves drafts out: they were never in force", () => {
    expect(routinePeriods(routines, TZ).map((p) => p.routine.id)).not.toContain("draft");
  });

  it("finds what was in force in a period, boundary days included", () => {
    const periods = routinePeriods(routines, TZ);
    const ids = (start: string, end: string) =>
      periods.filter((p) => planOverlaps(p, start, end)).map((p) => p.routine.id);
    expect(ids("2026-09-02", "2026-09-05")).toEqual(["r1"]);
    expect(ids("2026-09-05", "2026-09-20")).toEqual(["r1", "r2"]); // hubo un cambio dentro
    expect(ids("2026-10-05", "2026-10-05")).toEqual(["r2", "r3"]); // el día del cambio
    expect(ids("2026-10-20", "2026-10-25")).toEqual(["r3"]); // sigue en uso
    expect(ids("2026-08-01", "2026-08-20")).toEqual([]); // antes de todo
  });

  it("never invents a period that ends before it starts", () => {
    const odd = [routine("x", "archivado", "2026-09-20T09:00:00Z", "2026-09-10T09:00:00Z")];
    const [p] = routinePeriods(odd, TZ);
    expect(p!.from <= p!.to!).toBe(true);
  });
});

describe("when a set of menus was in force", () => {
  const menus = [
    menu("a1", "entrenamiento", "archivado", "2026-09-01T09:00:00Z", "2026-10-05T09:00:00Z"),
    menu("a2", "entrenamiento", "archivado", "2026-09-01T09:00:00Z", "2026-10-05T09:00:00Z"),
    menu("b1", "entrenamiento", "activo", "2026-10-02T09:00:00Z", "2026-10-05T09:00:00Z"),
    menu("d1", "descanso", "activo", "2026-09-01T09:00:00Z", "2026-09-03T09:00:00Z"),
    menu("draft", "descanso", "borrador", "2026-10-06T09:00:00Z", "2026-10-06T09:00:00Z"),
  ];

  it("groups the menus archived together and keeps each day type apart", () => {
    const periods = menuSetPeriods(menus, TZ);
    expect(periods.map((p) => [p.dayType, p.menus.map((m) => m.id), p.from, p.to])).toEqual([
      ["entrenamiento", ["a1", "a2"], "2026-09-01", "2026-10-05"],
      ["entrenamiento", ["b1"], "2026-10-05", null],
      ["descanso", ["d1"], "2026-09-03", null],
    ]);
  });

  it("leaves drafts out", () => {
    const ids = menuSetPeriods(menus, TZ).flatMap((p) => p.menus.map((m) => m.id));
    expect(ids).not.toContain("draft");
  });
});
