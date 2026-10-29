import { describe, expect, it } from "vitest";
import type { Menu, Routine } from "@/lib/domain";
import { findPlanViolations, loadCatalogAndPlans, type PlanData } from "./load-catalog-plans";

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
