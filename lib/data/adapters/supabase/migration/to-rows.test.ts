import { describe, expect, it } from "vitest";
import type { Menu, Routine } from "@/lib/domain";
import { accountIdFor, clientIdFor, entityIdFor } from "./ids";
import { menuRows, questionRow, remapTemplateRefs, routineRows, templateKey } from "./to-rows";

const TRAINER_UID = "uid-trainer";
const CREATED = "2026-08-03T09:00:00.000Z";
const NO_TEMPLATES: ReadonlySet<string> = new Set();

const routine: Routine = {
  id: "routine-1",
  trainerId: TRAINER_UID,
  clientId: "client-doc-1",
  status: "activo",
  name: "Fuerza A",
  note: "Calienta bien",
  sourceTemplateName: null,
  sourceTemplateId: null,
  createdAt: CREATED,
  updatedAt: CREATED,
  days: [
    {
      id: "day-a",
      dayNumber: 1,
      label: "Torso",
      exercises: [
        {
          id: "line-1",
          exerciseId: "exercise-press",
          prescription: { sets: 3, repsMin: 8, repsMax: 10, rir: "2", rest: "90 s", note: "" },
        },
        {
          id: "line-2",
          exerciseId: "exercise-row",
          prescription: { sets: 3, repsMin: 10, repsMax: null, rir: "", rest: "", note: "pausa" },
        },
      ],
    },
  ],
};

const menu: Menu = {
  id: "menu-1",
  trainerId: TRAINER_UID,
  clientId: "client-doc-1",
  status: "activo",
  name: "Entreno",
  dayType: "entrenamiento",
  suggested: true,
  macros: { kcal: 2200, proteinG: 160, carbsG: 220, fatG: 70 },
  note: "",
  sourceTemplateName: null,
  sourceTemplateId: null,
  createdAt: CREATED,
  updatedAt: CREATED,
  meals: [
    {
      id: "meal-1",
      name: "Desayuno",
      items: [
        {
          id: "item-lib",
          name: "Avena",
          grams: 80,
          foodId: "food-avena",
          composition: { kcal: 300, proteinG: 10, carbsG: 54, fatG: 5 },
        },
        { id: "item-free", name: "Café con leche", grams: 200 },
      ],
    },
  ],
};

describe("routineRows", () => {
  it("links the routine to its trainer and client by the converted ids", () => {
    const { routine: row } = routineRows(routine, NO_TEMPLATES);
    expect(row.id).toBe(entityIdFor("routine", "routine-1"));
    expect(row.trainer_id).toBe(accountIdFor(TRAINER_UID));
    expect(row.client_id).toBe(clientIdFor("client-doc-1"));
    expect(row.status).toBe("activo");
  });

  it("writes days and lines with positions, and each line points at its exercise", () => {
    const { days, lines } = routineRows(routine, NO_TEMPLATES);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ position: 0, day_number: 1, label: "Torso" });
    expect(lines.map((l) => [l.position, l.exercise_id])).toEqual([
      [0, entityIdFor("exercise", "exercise-press")],
      [1, entityIdFor("exercise", "exercise-row")],
    ]);
    expect(lines[0]?.routine_day_id).toBe(days[0]?.id);
    expect(lines[1]).toMatchObject({ reps_max: null, note: "pausa" });
  });

  it("keeps a local id apart between two routines of the same client", () => {
    const other = { ...routine, id: "routine-2" };
    const first = routineRows(routine, NO_TEMPLATES).lines[0];
    const second = routineRows(other, NO_TEMPLATES).lines[0];
    expect(first?.id).not.toBe(second?.id);
  });
});

describe("menuRows", () => {
  it("copies the frozen composition of a library item and leaves a free-text item without one", () => {
    const { items } = menuRows(menu, NO_TEMPLATES);
    const [library, free] = items;
    expect(library).toMatchObject({
      food_id: entityIdFor("food", "food-avena"),
      kcal: 300,
      protein_g: 10,
      carbs_g: 54,
      fat_g: 5,
    });
    expect(free).toMatchObject({
      food_id: null,
      kcal: null,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
    });
  });

  it("writes the declared macros as given, not derived from the foods", () => {
    const { menu: row } = menuRows(menu, NO_TEMPLATES);
    expect(row).toMatchObject({ kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 });
    expect(row.day_type).toBe("entrenamiento");
  });
});

describe("source_template_id (E8)", () => {
  const known = new Set([
    templateKey(TRAINER_UID, "tpl-routine"),
    templateKey(TRAINER_UID, "tpl-menu"),
  ]);

  it("translates the template id with the same ids as the template rows", () => {
    const fromTemplate = { ...routine, sourceTemplateId: "tpl-routine" };
    expect(routineRows(fromTemplate, known).routine.source_template_id).toBe(
      entityIdFor("routine-template", "tpl-routine"),
    );
    const menuFromTemplate = { ...menu, sourceTemplateId: "tpl-menu" };
    expect(menuRows(menuFromTemplate, known).menu.source_template_id).toBe(
      entityIdFor("menu-template", "tpl-menu"),
    );
  });

  it("writes null when the plan has no template id, even with a template name", () => {
    const named = { ...routine, sourceTemplateName: "Fuerza A", sourceTemplateId: null };
    expect(routineRows(named, known).routine.source_template_id).toBeNull();
    expect(
      menuRows({ ...menu, sourceTemplateName: "Entreno" }, known).menu.source_template_id,
    ).toBeNull();
  });

  it("writes null when the template is not in the export", () => {
    const orphan = { ...routine, sourceTemplateId: "tpl-deleted" };
    expect(routineRows(orphan, known).routine.source_template_id).toBeNull();
    const orphanMenu = { ...menu, sourceTemplateId: "tpl-deleted" };
    expect(menuRows(orphanMenu, known).menu.source_template_id).toBeNull();
  });

  it("writes null when the template belongs to another trainer", () => {
    const foreign = new Set([templateKey("uid-other-trainer", "tpl-routine")]);
    const fromTemplate = { ...routine, sourceTemplateId: "tpl-routine" };
    expect(routineRows(fromTemplate, foreign).routine.source_template_id).toBeNull();
  });
});

describe("remapTemplateRefs", () => {
  it("converts exerciseId and foodId wherever they appear and leaves local ids alone", () => {
    const body = {
      days: [{ id: "day-a", exercises: [{ id: "line-1", exerciseId: "exercise-press" }] }],
      meals: [{ items: [{ id: "item-1", foodId: "food-avena", grams: 80 }] }],
    };
    const out = remapTemplateRefs(body) as typeof body;
    expect(out.days[0]?.exercises[0]).toEqual({
      id: "line-1",
      exerciseId: entityIdFor("exercise", "exercise-press"),
    });
    expect(out.meals[0]?.items[0]).toEqual({
      id: "item-1",
      foodId: entityIdFor("food", "food-avena"),
      grams: 80,
    });
  });
});

describe("questionRow", () => {
  it("writes a scale with its limits and a text question without them", () => {
    const base = {
      id: "q-1",
      trainerId: TRAINER_UID,
      prompt: "Energía",
      order: 0,
      status: "activa" as const,
      createdAt: CREATED,
    };
    const scale = questionRow({ ...base, format: { kind: "escala", min: 1, max: 5 } });
    expect(scale).toMatchObject({ format_kind: "escala", scale_min: 1, scale_max: 5 });
    expect(scale).not.toHaveProperty("has_responses");
    expect(questionRow({ ...base, format: { kind: "texto" } })).toMatchObject({
      format_kind: "texto",
      scale_min: null,
      scale_max: null,
    });
  });
});
