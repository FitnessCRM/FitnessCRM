import { describe, expect, it } from "vitest";
import { NOW, idFactory } from "./__tests__/fixtures";
import type { MenuTemplate, RoutineTemplate } from "./schemas";
import {
  cloneMenuTemplate,
  cloneRoutineTemplate,
  countTemplateDayTypes,
  countTemplateExercises,
  duplicateMenuTemplate,
  duplicateRoutineTemplate,
  moveItem,
  renumberDays,
  setSuggestedMenu,
} from "./templates";

const routineTemplate: RoutineTemplate = {
  id: "rt-1",
  trainerId: "t-adrian",
  name: "Hiper 5d v3",
  description: "",
  note: "",
  days: [
    {
      id: "d-1",
      dayNumber: 1,
      label: "Torso",
      exercises: [
        {
          id: "e-1",
          exerciseId: "ex-press",
          prescription: { sets: 4, repsMin: 6, repsMax: 8, rir: "2", rest: "3 min", note: "" },
        },
      ],
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const menuTemplate: MenuTemplate = {
  id: "mt-1",
  trainerId: "t-adrian",
  name: "Definición 2.400",
  description: "",
  menus: [
    {
      id: "m-1",
      name: "Menú A — Casero",
      dayType: "entrenamiento",
      suggested: true,
      macros: { kcal: 2348, proteinG: 165, carbsG: 260, fatG: 72 },
      note: "",
      meals: [
        {
          id: "meal-1",
          name: "Desayuno",
          items: [{ id: "f-1", name: "Copos de avena", grams: 80 }],
        },
      ],
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
};

const ctx = { trainerId: "t-adrian", clientId: "c-marta", now: NOW };

describe("templates are cloned, never linked (§4)", () => {
  it("copies a routine template into a draft routine with fresh ids", () => {
    const routine = cloneRoutineTemplate(routineTemplate, { ...ctx, newId: idFactory("new") });
    expect(routine.status).toBe("borrador");
    expect(routine.clientId).toBe("c-marta");
    expect(routine.sourceTemplateName).toBe("Hiper 5d v3");
    expect(routine.id).not.toBe(routineTemplate.id);
    expect(routine.days[0]?.id).not.toBe("d-1");
    expect(routine.days[0]?.exercises[0]?.exerciseId).toBe("ex-press");
  });

  it("editing the template afterwards does not touch the clone", () => {
    const routine = cloneRoutineTemplate(routineTemplate, { ...ctx, newId: idFactory("new") });
    routineTemplate.days[0]!.exercises[0]!.prescription.sets = 99;
    routineTemplate.days[0]!.label = "Cambiado";
    expect(routine.days[0]?.exercises[0]?.prescription.sets).toBe(4);
    expect(routine.days[0]?.label).toBe("Torso");
  });

  it("copies every menu of a menu template into draft client menus", () => {
    const menus = cloneMenuTemplate(menuTemplate, { ...ctx, newId: idFactory("new") });
    expect(menus).toHaveLength(1);
    expect(menus[0]?.status).toBe("borrador");
    expect(menus[0]?.meals[0]?.items[0]?.name).toBe("Copos de avena");
    menuTemplate.menus[0]!.meals[0]!.items[0]!.grams = 1;
    expect(menus[0]?.meals[0]?.items[0]?.grams).toBe(80);
  });
});

describe("duplicating a template", () => {
  const dup = { newId: idFactory("dup"), now: NOW, name: "Hiper 5d v3 (copia)" };

  it("makes an independent template with fresh ids and the given name", () => {
    const copy = duplicateRoutineTemplate(routineTemplate, dup);
    expect(copy.id).not.toBe(routineTemplate.id);
    expect(copy.name).toBe("Hiper 5d v3 (copia)");
    expect(copy.days[0]?.id).not.toBe(routineTemplate.days[0]?.id);
    expect(copy.days[0]?.exercises[0]?.exerciseId).toBe("ex-press");
    routineTemplate.days[0]!.exercises[0]!.prescription.sets = 7;
    expect(copy.days[0]?.exercises[0]?.prescription.sets).not.toBe(7);
  });

  it("copies every menu, meal and food of a menu template with fresh ids", () => {
    const copy = duplicateMenuTemplate(menuTemplate, { ...dup, newId: idFactory("dm") });
    expect(copy.menus).toHaveLength(menuTemplate.menus.length);
    expect(copy.menus[0]?.id).not.toBe(menuTemplate.menus[0]?.id);
    expect(copy.menus[0]?.meals[0]?.items[0]?.id).not.toBe("f-1");
    expect(copy.menus[0]?.meals[0]?.items[0]?.name).toBe("Copos de avena");
  });

  it("counts exercises across days and distinct day types", () => {
    expect(countTemplateExercises(routineTemplate)).toBe(1);
    expect(countTemplateDayTypes(menuTemplate)).toBe(1);
  });
});

describe("template editing helpers", () => {
  it("moves an item one place and ignores out-of-range moves", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("numbers days 1..n in order, with no gaps after a removal", () => {
    const days = [{ dayNumber: 1 }, { dayNumber: 3 }, { dayNumber: 7 }];
    expect(renumberDays(days).map((d) => d.dayNumber)).toEqual([1, 2, 3]);
  });

  it("keeps a single suggested menu per day type", () => {
    const menus = [
      { id: "a", dayType: "entrenamiento", suggested: true },
      { id: "b", dayType: "entrenamiento", suggested: false },
      { id: "c", dayType: "descanso", suggested: true },
    ];
    const next = setSuggestedMenu(menus, "b");
    expect(next.map((m) => m.suggested)).toEqual([false, true, true]);
    expect(setSuggestedMenu(menus, "zzz")).toEqual(menus);
  });
});
