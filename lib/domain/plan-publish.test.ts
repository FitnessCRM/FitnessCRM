import { describe, expect, it } from "vitest";
import { NOW } from "./__tests__/fixtures";
import { planMenuPublish, routinePublishOp } from "./plan-publish";
import type { Menu, MenuTemplateEntry } from "./schemas";

const menu = (id: string, over: Partial<Menu> = {}): Menu => ({
  id,
  trainerId: "t-1",
  clientId: "c-1",
  name: id,
  dayType: "entrenamiento",
  suggested: false,
  macros: { kcal: 25, proteinG: 1, carbsG: 1, fatG: 1 },
  meals: [],
  note: "",
  status: "activo",
  sourceTemplateName: null,
  createdAt: NOW,
  updatedAt: NOW,
  ...over,
});
const entry = (m: Menu, over: Partial<MenuTemplateEntry> = {}): MenuTemplateEntry => ({
  id: m.id,
  name: m.name,
  dayType: m.dayType,
  suggested: m.suggested,
  macros: m.macros,
  meals: m.meals,
  note: m.note,
  ...over,
});

const ops = (plan: ReturnType<typeof planMenuPublish>) =>
  plan.ops.map((o) => ("id" in o ? `${o.type}:${o.id}` : `${o.type}:${o.body.name}`)).sort();

describe("routinePublishOp (§7: a draft is edited in place, the active one is versioned)", () => {
  it("creates a routine when the client has none", () => {
    expect(routinePublishOp([])).toEqual({ type: "create" });
    expect(routinePublishOp([{ id: "old", status: "archivado" }])).toEqual({ type: "create" });
  });

  it("edits a draft in place", () => {
    expect(routinePublishOp([{ id: "d", status: "borrador" }])).toEqual({
      type: "update",
      id: "d",
    });
  });

  it("versions the active routine instead of editing it", () => {
    expect(routinePublishOp([{ id: "a", status: "activo" }])).toEqual({ type: "revise", id: "a" });
  });

  it("prefers the draft when there is also an active one, so a half-done publish is reused", () => {
    const routines = [
      { id: "a", status: "activo" as const },
      { id: "d", status: "borrador" as const },
    ];
    expect(routinePublishOp(routines)).toEqual({ type: "update", id: "d" });
  });
});

describe("planMenuPublish (§7: the active menus of a day type are a set, never edited in place)", () => {
  it("leaves an unchanged day type alone", () => {
    const a = menu("a");
    const b = menu("b", { dayType: "descanso" });
    const plan = planMenuPublish([a, b], [entry(a), entry(b)]);
    expect(plan).toEqual({ ops: [], activate: [] });
  });

  it("versions an edited active menu and the rest of its set, and activates the day type", () => {
    const a = menu("a");
    const b = menu("b");
    const rest = menu("r", { dayType: "descanso" });
    const plan = planMenuPublish([a, b, rest], [entry(a, { name: "A2" }), entry(b), entry(rest)]);
    expect(ops(plan)).toEqual(["revise:a", "revise:b"]);
    expect(plan.activate).toEqual(["entrenamiento"]);
    expect(plan.ops.some((o) => o.type === "update")).toBe(false);
  });

  it("archives a removed menu and versions what remains of its set", () => {
    const a = menu("a");
    const b = menu("b");
    const plan = planMenuPublish([a, b], [entry(a)]);
    expect(ops(plan)).toEqual(["archive:b", "revise:a"]);
    expect(plan.activate).toEqual(["entrenamiento"]);
  });

  it("edits drafts in place and versions the active menus beside them", () => {
    const a = menu("a");
    const draft = menu("b", { status: "borrador" });
    const plan = planMenuPublish([a, draft], [entry(a), entry(draft, { name: "B2" })]);
    expect(ops(plan)).toEqual(["revise:a", "update:b"]);
    expect(plan.activate).toEqual(["entrenamiento"]);
  });

  it("creates new entries and activates their day type", () => {
    const fresh = entry(menu("new"), { dayType: "descanso" });
    const plan = planMenuPublish([], [fresh]);
    expect(ops(plan)).toEqual(["create:new"]);
    expect(plan.activate).toEqual(["descanso"]);
  });

  it("only archives when a day type is left empty: there is nothing to activate", () => {
    const a = menu("a");
    const plan = planMenuPublish([a], []);
    expect(ops(plan)).toEqual(["archive:a"]);
    expect(plan.activate).toEqual([]);
  });

  it("treats a menu moved to another day type as removed from one set and created in the other", () => {
    const a = menu("a");
    const b = menu("b");
    const plan = planMenuPublish([a, b], [entry(a, { dayType: "descanso" }), entry(b)]);
    expect(ops(plan)).toEqual(["archive:a", "create:a", "revise:b"]);
    expect(plan.activate).toEqual(["entrenamiento", "descanso"]);
  });
});
