import { describe, expect, it } from "vitest";
import { NOW } from "./__tests__/fixtures";
import { planMenuPublish } from "./plan-publish";
import type { Menu, MenuTemplateEntry } from "./schemas";

const menu = (id: string, over: Partial<Menu> = {}): Menu => ({
  id,
  trainerId: "t-1",
  clientId: "c-1",
  name: id,
  dayType: "entrenamiento",
  suggested: false,
  macros: { proteinG: 1, carbsG: 1, fatG: 1 },
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

describe("planMenuPublish", () => {
  it("edits active menus in place when nothing new arrives for their day type", () => {
    const a = menu("a");
    const plan = planMenuPublish([a], [entry(a, { name: "A2" })]);
    expect(plan.activate).toEqual([]);
    expect(plan.ops).toHaveLength(1);
    expect(plan.ops[0]).toMatchObject({ type: "update", id: "a" });
  });

  it("republishes the kept active menus of a day type that gets a draft (I4 would archive them)", () => {
    const a = menu("a");
    const draft = menu("b", { status: "borrador" });
    const plan = planMenuPublish([a, draft], [entry(a), entry(draft)]);
    expect(plan.activate).toEqual(["entrenamiento"]);
    expect(plan.ops).toContainEqual({ type: "archive", id: "a" });
    expect(plan.ops.filter((o) => o.type === "create")).toHaveLength(1);
    expect(plan.ops).toContainEqual(expect.objectContaining({ type: "update", id: "b" }));
  });

  it("archives what was removed from the editor", () => {
    const a = menu("a");
    const b = menu("b");
    const plan = planMenuPublish([a, b], [entry(a)]);
    expect(plan.ops).toContainEqual({ type: "archive", id: "b" });
  });

  it("creates entries that do not exist yet and activates their day type", () => {
    const fresh = entry(menu("new"), { dayType: "descanso" });
    const plan = planMenuPublish([], [fresh]);
    expect(plan.ops[0]).toMatchObject({ type: "create" });
    expect(plan.activate).toEqual(["descanso"]);
  });
});
