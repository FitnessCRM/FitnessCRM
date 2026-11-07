import { describe, expect, it } from "vitest";
import type { Menu, MenuTemplate, Routine, RoutineTemplate } from "@/lib/domain";
import { entityIdFor } from "./ids";
import {
  findPlanViolations,
  loadCatalogAndPlans,
  planRowSets,
  plansWithUnknownTemplate,
  type PlanData,
} from "./load-catalog-plans";

const CREATED = "2026-08-03T09:00:00.000Z";

const emptyPlan = (): PlanData => ({
  exercises: [],
  foods: [],
  measurementTypes: [],
  questions: [],
  routineTemplates: [],
  menuTemplates: [],
  routines: [],
  menus: [],
  macroTargets: [],
  memberships: [],
});

const routine = (id: string, status: Routine["status"], clientId = "client-1"): Routine => ({
  id,
  trainerId: "uid-trainer",
  clientId,
  status,
  name: "Rutina",
  note: "",
  sourceTemplateName: null,
  sourceTemplateId: null,
  createdAt: CREATED,
  updatedAt: CREATED,
  days: [],
});

const menu = (id: string, suggested: boolean, status: Menu["status"]): Menu => ({
  id,
  trainerId: "uid-trainer",
  clientId: "client-1",
  status,
  name: "Menú",
  dayType: "entrenamiento",
  suggested,
  macros: { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
  note: "",
  sourceTemplateName: null,
  sourceTemplateId: null,
  createdAt: CREATED,
  updatedAt: CREATED,
  meals: [],
});

describe("findPlanViolations", () => {
  it("accepts one active routine per client, and reports two", () => {
    expect(findPlanViolations({ ...emptyPlan(), routines: [routine("a", "activo")] })).toEqual([]);
    const two = { ...emptyPlan(), routines: [routine("a", "activo"), routine("b", "activo")] };
    expect(findPlanViolations(two)).toHaveLength(1);
  });

  it("ignores archived and draft routines when counting", () => {
    const plan = {
      ...emptyPlan(),
      routines: [routine("a", "activo"), routine("b", "archivado"), routine("c", "borrador")],
    };
    expect(findPlanViolations(plan)).toEqual([]);
  });

  it("reports two active suggested menus for the same client and day type", () => {
    const plan = {
      ...emptyPlan(),
      menus: [menu("m1", true, "activo"), menu("m2", true, "activo")],
    };
    expect(findPlanViolations(plan)).toHaveLength(1);
  });
});

describe("source templates (E8)", () => {
  const routineTemplate: RoutineTemplate = {
    id: "tpl-routine",
    trainerId: "uid-trainer",
    name: "Hiper",
    description: "",
    note: "",
    days: [],
    createdAt: CREATED,
    updatedAt: CREATED,
  };
  const menuTemplate: MenuTemplate = {
    id: "tpl-menu",
    trainerId: "uid-trainer",
    name: "Base",
    description: "",
    menus: [],
    createdAt: CREATED,
    updatedAt: CREATED,
  };
  const plan: PlanData = {
    ...emptyPlan(),
    routineTemplates: [routineTemplate],
    menuTemplates: [menuTemplate],
    routines: [
      { ...routine("with", "activo"), sourceTemplateId: "tpl-routine" },
      { ...routine("without", "archivado") },
      { ...routine("missing", "archivado", "client-2"), sourceTemplateId: "tpl-gone" },
    ],
    menus: [
      { ...menu("with", false, "activo"), sourceTemplateId: "tpl-menu" },
      {
        ...menu("foreign", false, "archivado"),
        trainerId: "uid-other",
        sourceTemplateId: "tpl-menu",
      },
    ],
  };
  const rowsOf = (table: string) =>
    (planRowSets(plan).find((set) => set.table === table)?.rows ?? []) as {
      id: string;
      source_template_id: string | null;
    }[];

  it("links a plan to a template of the export and leaves the rest null", () => {
    const routines = new Map(rowsOf("routines").map((row) => [row.id, row.source_template_id]));
    expect(routines.get(entityIdFor("routine", "with"))).toBe(
      entityIdFor("routine-template", "tpl-routine"),
    );
    expect(routines.get(entityIdFor("routine", "without"))).toBeNull();
    expect(routines.get(entityIdFor("routine", "missing"))).toBeNull();

    const menus = new Map(rowsOf("menus").map((row) => [row.id, row.source_template_id]));
    expect(menus.get(entityIdFor("menu", "with"))).toBe(entityIdFor("menu-template", "tpl-menu"));
    expect(menus.get(entityIdFor("menu", "foreign"))).toBeNull();
  });

  it("counts the plans whose template is not in the export or belongs to another trainer", () => {
    expect(plansWithUnknownTemplate(plan)).toEqual({ routines: 1, menus: 1 });
    expect(plansWithUnknownTemplate(emptyPlan())).toEqual({ routines: 0, menus: 0 });
  });
});

describe("loadCatalogAndPlans", () => {
  it("refuses a remote URL before sending anything", async () => {
    await expect(
      loadCatalogAndPlans(emptyPlan(), {
        url: "https://fitnesscrm.supabase.co",
        serviceKey: "service",
        fetch: (async () => new Response("{}", { status: 200 })) as typeof fetch,
      }),
    ).rejects.toThrow(/solo corre contra la instancia local/);
  });

  it("refuses a plan that breaks an invariant, before writing", async () => {
    const calls: string[] = [];
    const plan = { ...emptyPlan(), routines: [routine("a", "activo"), routine("b", "activo")] };
    await expect(
      loadCatalogAndPlans(plan, {
        url: "http://127.0.0.1:54321",
        serviceKey: "service",
        fetch: (async (input: string | URL | Request) => {
          calls.push(String(input));
          return new Response("{}", { status: 201 });
        }) as typeof fetch,
      }),
    ).rejects.toThrow(/invariantes/);
    expect(calls).toEqual([]);
  });

  it("writes parents before children: exercises and routines before their days and lines", async () => {
    const calls: string[] = [];
    const plan: PlanData = {
      ...emptyPlan(),
      exercises: [
        {
          id: "exercise-press",
          trainerId: "uid-trainer",
          name: "Press",
          muscleGroup: "",
          equipment: "",
          videoUrl: null,
          description: "",
          status: "activo",
          createdAt: CREATED,
        },
      ],
      routines: [
        {
          ...routine("a", "activo"),
          days: [
            {
              id: "day-a",
              dayNumber: 1,
              label: "",
              exercises: [
                {
                  id: "line-1",
                  exerciseId: "exercise-press",
                  prescription: { sets: 3, repsMin: 8, repsMax: null, rir: "", rest: "", note: "" },
                },
              ],
            },
          ],
        },
      ],
      menus: [
        {
          ...menu("m1", false, "activo"),
          meals: [
            { id: "meal-1", name: "Comida", items: [{ id: "item-1", name: "Arroz", grams: 100 }] },
          ],
        },
      ],
    };
    await loadCatalogAndPlans(plan, {
      url: "http://127.0.0.1:54321",
      serviceKey: "service",
      fetch: (async (input: string | URL | Request) => {
        calls.push(String(input).replace("http://127.0.0.1:54321/rest/v1/", ""));
        return new Response("{}", { status: 201 });
      }) as typeof fetch,
    });
    const at = (table: string) => calls.findIndex((c) => c.startsWith(`${table}?`));
    expect(at("exercises")).toBeLessThan(at("routine_day_exercises"));
    expect(at("routines")).toBeLessThan(at("routine_days"));
    expect(at("routine_days")).toBeLessThan(at("routine_day_exercises"));
    expect(at("menus")).toBeLessThan(at("meals"));
    expect(at("meals")).toBeLessThan(at("menu_items"));
  });
});
