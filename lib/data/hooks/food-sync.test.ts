import { describe, expect, it, vi } from "vitest";
import { createDemoState, createMockPorts } from "@/lib/data/adapters/mock";
import { mergeFoodLibrary, type FoodDraft } from "@/lib/domain";
import {
  archiveFood,
  listOwnFoodsForLibrary,
  publishFoodVersion,
  retryPendingFoods,
  retryPendingFoodsOnce,
  saveFood,
  type FoodPorts,
} from "./food-sync";

const TODAY = "2026-08-29";
const TRAINER = "t-adrian";

const draft: FoodDraft = {
  name: "Lentejas cocidas",
  composition: { kcal: 116, proteinG: 9, carbsG: 20.1, fatG: 0.4 },
};

/** La primera página de una búsqueda de lentejas: todas las de estas pruebas caben en ella. */
async function lentilsInCatalog(ports: FoodPorts) {
  return (await ports.foodCatalog.searchCatalogFoods({ text: "lentejas" })).foods;
}

/**
 * Los mismos datos vistos con el catálogo caído y con el catálogo de vuelta: dos juegos de puertos
 * sobre el mismo estado y el mismo reloj, que avanza un segundo en cada escritura.
 */
function setup() {
  const state = createDemoState(TODAY);
  let n = 0;
  const now = () => new Date(Date.UTC(2026, 7, 29, 10, 0, n++)).toISOString();
  return {
    down: createMockPorts({ state, today: TODAY, now, foodCatalogDown: true }),
    up: createMockPorts({ state, today: TODAY, now }),
  };
}

describe("saving a food", () => {
  it("with the catalog down, does not fail and leaves the food pending", async () => {
    const { down } = setup();
    const result = await saveFood(down, TRAINER, { draft });
    expect(result.published).toBe(false);
    expect(result.food.publishStatus).toBe("pendiente");
    expect((await down.ownFoods.getFood(TRAINER, result.food.id))?.publishStatus).toBe("pendiente");
  });

  it("with the catalog up, publishes and marks the version it wrote", async () => {
    const { up } = setup();
    const created = await saveFood(up, TRAINER, { draft });
    expect(created).toMatchObject({ published: true, food: { publishStatus: "publicado" } });
    const edited = await saveFood(up, TRAINER, {
      foodId: created.food.id,
      draft: { ...draft, name: "Lentejas" },
    });
    expect(edited.food).toMatchObject({ name: "Lentejas", publishStatus: "publicado" });
    const inCatalog = (await lentilsInCatalog(up)).find((f) => f.id === created.food.id);
    expect(inCatalog?.name).toBe("Lentejas");
  });
});

describe("retrying what is pending", () => {
  it("publishes and marks once the catalog is back", async () => {
    const { down, up } = setup();
    const { food } = await saveFood(down, TRAINER, { draft });
    expect((await retryPendingFoods(down, TRAINER)).catalogUnavailable).toBe(true);

    const pendingBefore = (await up.ownFoods.listPendingFoods(TRAINER)).length;
    const result = await retryPendingFoods(up, TRAINER);
    expect(result).toEqual({ published: pendingBefore, pending: 0, catalogUnavailable: false });
    expect(await up.ownFoods.listPendingFoods(TRAINER)).toEqual([]);
    expect((await lentilsInCatalog(up)).map((f) => f.id)).toContain(food.id);
  });

  it("with the catalog down, costs a single failed call however much is pending", async () => {
    const { down } = setup();
    await saveFood(down, TRAINER, { draft });
    await saveFood(down, TRAINER, { draft: { ...draft, name: "Garbanzos" } });
    expect((await down.ownFoods.listPendingFoods(TRAINER)).length).toBeGreaterThan(2);

    const publish = vi.spyOn(down.foodCatalog, "publishFood");
    const result = await retryPendingFoods(down, TRAINER);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ published: 0, catalogUnavailable: true });
  });

  it("does not call the catalog when nothing is pending", async () => {
    const { up } = setup();
    await retryPendingFoods(up, TRAINER);
    const publish = vi.spyOn(up.foodCatalog, "publishFood");
    expect(await retryPendingFoods(up, TRAINER)).toEqual({
      published: 0,
      pending: 0,
      catalogUnavailable: false,
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it("never runs two at once: a second call gets the retry already running", async () => {
    const { down } = setup();
    const list = vi.spyOn(down.ownFoods, "listPendingFoods");
    const [a, b] = [retryPendingFoodsOnce(down, TRAINER), retryPendingFoodsOnce(down, TRAINER)];
    expect(a).toBe(b);
    await a;
    expect(list).toHaveBeenCalledTimes(1);
    await retryPendingFoodsOnce(down, TRAINER);
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe("publishing an old version", () => {
  it("does not mark the current one: a write that lands while publishing stays pending", async () => {
    const { up } = setup();
    const v1 = await up.ownFoods.createFood(TRAINER, draft);
    const publish = up.foodCatalog.publishFood.bind(up.foodCatalog);
    vi.spyOn(up.foodCatalog, "publishFood").mockImplementationOnce(async (trainerId, food) => {
      await publish(trainerId, food);
      // Mientras la publicación de v1 vuelve, el entrenador guarda otra vez.
      await up.ownFoods.updateFood(TRAINER, v1.id, { ...draft, name: "Lentejas pardinas" });
    });

    const result = await publishFoodVersion(up, TRAINER, v1);
    expect(result.published).toBe(true);
    const current = await up.ownFoods.getFood(TRAINER, v1.id);
    expect(current).toMatchObject({ name: "Lentejas pardinas", publishStatus: "pendiente" });

    // El reintento publica la versión nueva y entonces sí queda publicada.
    await retryPendingFoods(up, TRAINER);
    expect((await up.ownFoods.getFood(TRAINER, v1.id))?.publishStatus).toBe("publicado");
    expect((await lentilsInCatalog(up)).find((f) => f.id === v1.id)?.name).toBe(
      "Lentejas pardinas",
    );
  });
});

describe("archiving a food", () => {
  it("publishes the archived version, and it stops being listed anywhere", async () => {
    const { up } = setup();
    const { food } = await saveFood(up, TRAINER, { draft });
    const result = await archiveFood(up, TRAINER, food.id);
    expect(result).toMatchObject({
      published: true,
      food: { status: "archivado", publishStatus: "publicado" },
    });
    const own = await listOwnFoodsForLibrary(up, TRAINER);
    const catalog = await lentilsInCatalog(up);
    expect(catalog.map((f) => f.id)).not.toContain(food.id);
    expect(mergeFoodLibrary(own, catalog).map((f) => f.id)).not.toContain(food.id);
  });

  it("with the catalog down, still archives and leaves it pending", async () => {
    const { down, up } = setup();
    const { food } = await saveFood(up, TRAINER, { draft });
    const result = await archiveFood(down, TRAINER, food.id);
    expect(result).toMatchObject({
      published: false,
      food: { status: "archivado", publishStatus: "pendiente" },
    });
    // El catálogo aún lo sirve, pero la unión manda la copia propia, que está archivada (§4).
    const own = await listOwnFoodsForLibrary(up, TRAINER);
    const catalog = await lentilsInCatalog(up);
    expect(catalog.map((f) => f.id)).toContain(food.id);
    expect(mergeFoodLibrary(own, catalog).map((f) => f.id)).not.toContain(food.id);
  });
});
