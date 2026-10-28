import { describe, expect, it } from "vitest";
import {
  macroTargetsFromRow,
  menuFromRow,
  menuTemplateFromRow,
  routineFromRow,
  routineTemplateFromRow,
  type MenuRow,
  type MenuTemplateRow,
  type MacroTargetsRow,
  type RoutineRow,
  type RoutineTemplateRow,
} from "./plan-rows";

const TRAINER = "11111111-1111-1111-1111-111111111111";
const CLIENT = "22222222-2222-2222-2222-222222222222";
const ID = "33333333-3333-3333-3333-333333333333";
const OTHER = "44444444-4444-4444-4444-444444444444";
const CREATED = "2026-10-01T10:00:00.123456+00:00";

describe("routineFromRow", () => {
  const row: RoutineRow = {
    id: ID,
    trainer_id: TRAINER,
    client_id: CLIENT,
    status: "activo",
    name: "Fuerza A",
    note: "Sube peso",
    source_template_name: null,
    created_at: CREATED,
    updated_at: CREATED,
    routine_days: [
      {
        id: OTHER,
        day_number: 2,
        label: "Pierna",
        position: 1,
        routine_day_exercises: [],
      },
      {
        id: ID,
        day_number: 1,
        label: "Torso",
        position: 0,
        routine_day_exercises: [
          {
            id: "55555555-5555-5555-5555-555555555555",
            exercise_id: "66666666-6666-6666-6666-666666666666",
            position: 1,
            sets: 3,
            reps_min: 10,
            reps_max: null,
            rir: "",
            rest: "",
            note: "",
          },
          {
            id: "77777777-7777-7777-7777-777777777777",
            exercise_id: "88888888-8888-8888-8888-888888888888",
            position: 0,
            sets: 4,
            reps_min: 6,
            reps_max: 8,
            rir: "1-2",
            rest: "90 s",
            note: "",
          },
        ],
      },
    ],
  };

  it("sorts days and lines by position and keeps the ids of the versions", () => {
    const routine = routineFromRow(row);
    expect(routine.days.map((d) => d.dayNumber)).toEqual([1, 2]);
    expect(routine.days[0]?.exercises.map((e) => e.id)).toEqual([
      "77777777-7777-7777-7777-777777777777",
      "55555555-5555-5555-5555-555555555555",
    ]);
  });

  it("maps a fixed-rep line with no upper limit, and the free-text prescription", () => {
    const routine = routineFromRow(row);
    expect(routine.days[0]?.exercises[1]?.prescription).toEqual({
      sets: 3,
      repsMin: 10,
      repsMax: null,
      rir: "",
      rest: "",
      note: "",
    });
    expect(routine.days[0]?.exercises[0]?.prescription.rir).toBe("1-2");
  });

  it("maps the header and the timestamps to UTC", () => {
    expect(routineFromRow(row)).toMatchObject({
      id: ID,
      trainerId: TRAINER,
      clientId: CLIENT,
      status: "activo",
      name: "Fuerza A",
      note: "Sube peso",
      sourceTemplateName: null,
      createdAt: "2026-10-01T10:00:00.123Z",
    });
  });
});

describe("menuFromRow", () => {
  const row: MenuRow = {
    id: ID,
    trainer_id: TRAINER,
    client_id: CLIENT,
    status: "borrador",
    name: "Entreno",
    day_type: "entrenamiento",
    suggested: true,
    kcal: 2000,
    protein_g: 150,
    carbs_g: 200,
    fat_g: 60,
    note: "",
    source_template_name: "Plantilla base",
    created_at: CREATED,
    updated_at: CREATED,
    meals: [
      {
        id: OTHER,
        name: "Cena",
        position: 1,
        menu_items: [],
      },
      {
        id: "99999999-9999-9999-9999-999999999999",
        name: "Desayuno",
        position: 0,
        menu_items: [
          {
            id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            name: "Ensalada libre",
            grams: 100,
            position: 1,
            food_id: null,
            kcal: null,
            protein_g: null,
            carbs_g: null,
            fat_g: null,
          },
          {
            id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            name: "Avena",
            grams: 80,
            position: 0,
            food_id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
            kcal: 296,
            protein_g: 10.4,
            carbs_g: 48,
            fat_g: 5.6,
          },
        ],
      },
    ],
  };

  it("maps the declared macros of the menu and its day type", () => {
    expect(menuFromRow(row)).toMatchObject({
      dayType: "entrenamiento",
      suggested: true,
      macros: { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
      sourceTemplateName: "Plantilla base",
    });
  });

  it("gives a library food its frozen composition (I29) and a free-text item none (I30)", () => {
    const menu = menuFromRow(row);
    const [breakfast, dinner] = menu.meals;
    expect(dinner?.name).toBe("Cena");
    expect(breakfast?.items[0]).toEqual({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: "Avena",
      grams: 80,
      foodId: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      composition: { kcal: 296, proteinG: 10.4, carbsG: 48, fatG: 5.6 },
    });
    expect(breakfast?.items[1]).toEqual({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Ensalada libre",
      grams: 100,
    });
  });
});

describe("macroTargetsFromRow", () => {
  it("reads the four figures as the macros of the target", () => {
    const row: MacroTargetsRow = {
      id: ID,
      trainer_id: TRAINER,
      client_id: CLIENT,
      day_type: "descanso",
      status: "activo",
      kcal: 1800,
      protein_g: 140,
      carbs_g: 150,
      fat_g: 60,
      created_at: CREATED,
      updated_at: CREATED,
    };
    expect(macroTargetsFromRow(row)).toMatchObject({
      dayType: "descanso",
      macros: { kcal: 1800, proteinG: 140, carbsG: 150, fatG: 60 },
      status: "activo",
    });
  });
});

describe("routineTemplateFromRow", () => {
  it("takes the name from its column and the note and days from the body", () => {
    const row: RoutineTemplateRow = {
      id: ID,
      trainer_id: TRAINER,
      name: "Base",
      description: "Para principiantes",
      body: { note: "", days: [] },
      created_at: CREATED,
      updated_at: CREATED,
    };
    expect(routineTemplateFromRow(row)).toMatchObject({
      name: "Base",
      description: "Para principiantes",
      note: "",
      days: [],
    });
  });
});

describe("menuTemplateFromRow", () => {
  it("reads the menus of the body", () => {
    const row: MenuTemplateRow = {
      id: ID,
      trainer_id: TRAINER,
      name: "Semana",
      description: "",
      body: { menus: [] },
      created_at: CREATED,
      updated_at: CREATED,
    };
    expect(menuTemplateFromRow(row)).toMatchObject({ name: "Semana", menus: [] });
  });
});
