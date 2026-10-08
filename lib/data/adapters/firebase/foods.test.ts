import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FoodDraft } from "@/lib/domain";
import { createDemoState, createMockPorts, type MockState } from "../mock";
import { TRAINER_ID } from "../mock/demo-data/common";
import { createFirestore } from "./config";
import { createFirebaseContext, type FirebaseContext } from "./context";
import { createUnavailableFoodCatalogPort } from "./food-catalog";
import { createOwnFoodPort } from "./foods";
import { COLLECTIONS } from "./helpers";

/**
 * La copia propia de los alimentos contra el emulador de Firestore (`pnpm test:firebase`). Las
 * lecturas se comparan con el adaptador en memoria sobre los mismos datos de demo; las escrituras,
 * con lo que pide el puerto: aislamiento por entrenador (I28), `pendiente` en cada escritura y la
 * marca de publicado solo sobre la versión publicada.
 */
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const TODAY = "2026-10-03";
const STRANGER = "t-otra";

/** Un reloj que avanza un segundo en cada llamada: cada escritura es una versión distinta. */
function ticking() {
  let n = 0;
  return () => new Date(Date.UTC(2026, 9, 3, 10, 0, n++)).toISOString();
}

const draft: FoodDraft = {
  name: "Lentejas cocidas",
  composition: { kcal: 116, proteinG: 9, carbsG: 20.1, fatG: 0.4 },
};

describe.skipIf(!emulatorHost)("adaptador de Firebase · alimentos", () => {
  let db: Firestore;
  let ctx: FirebaseContext;
  let state: MockState;

  beforeAll(() => {
    const [host = "127.0.0.1", port = "8080"] = (emulatorHost as string).split(":");
    db = createFirestore(
      { projectId: "demo-hector" },
      { appName: "firebase-foods-test", emulator: { host, port: Number(port) } },
    );
  });

  beforeEach(async () => {
    await fetch(
      `http://${emulatorHost}/emulator/v1/projects/demo-hector/databases/(default)/documents`,
      { method: "DELETE" },
    );
    ctx = createFirebaseContext(db, { now: ticking() });
    state = createDemoState(TODAY);
    await Promise.all(state.foods.map((f) => setDoc(doc(db, COLLECTIONS.foods, f.id), f)));
  });

  const mock = () => createMockPorts({ state: structuredClone(state), today: TODAY });
  const ids = (items: { id: string }[]) => items.map((i) => i.id).sort();

  it("reads the same as the in-memory reference", async () => {
    const foods = createOwnFoodPort(ctx);
    const reference = mock().ownFoods;
    expect(await foods.listFoods(TRAINER_ID)).toEqual(await reference.listFoods(TRAINER_ID));
    expect(ids(await foods.listPendingFoods(TRAINER_ID))).toEqual(
      ids(await reference.listPendingFoods(TRAINER_ID)),
    );
    const archived = state.foods.find((f) => f.status === "archivado")!;
    expect(await foods.getFood(TRAINER_ID, archived.id)).toEqual(archived);
    expect(await foods.getFood(TRAINER_ID, "no-existe")).toBeNull();
  });

  it("create, edit and archive leave the food pending, keeping its identity and creation date", async () => {
    const foods = createOwnFoodPort(ctx);
    const created = await foods.createFood(TRAINER_ID, {
      ...draft,
      composition: { ...draft.composition, proteinG: 9.04 },
    });
    expect(created).toMatchObject({
      trainerId: TRAINER_ID,
      status: "activo",
      publishStatus: "pendiente",
    });
    expect(created.composition.proteinG).toBe(9);

    await foods.markFoodPublished(TRAINER_ID, created.id, created.updatedAt);
    const edited = await foods.updateFood(TRAINER_ID, created.id, { ...draft, name: "Lentejas" });
    expect(edited).toMatchObject({
      id: created.id,
      trainerId: TRAINER_ID,
      name: "Lentejas",
      publishStatus: "pendiente",
      createdAt: created.createdAt,
    });
    expect(edited.updatedAt > created.updatedAt).toBe(true);

    await foods.markFoodPublished(TRAINER_ID, created.id, edited.updatedAt);
    const archived = await foods.archiveFood(TRAINER_ID, created.id);
    expect(archived).toMatchObject({ status: "archivado", publishStatus: "pendiente" });
    expect(ids(await foods.listFoods(TRAINER_ID))).not.toContain(created.id);
    expect(ids(await foods.listPendingFoods(TRAINER_ID))).toContain(created.id);

    // Archivar lo ya archivado no escribe una versión nueva.
    expect(await foods.archiveFood(TRAINER_ID, created.id)).toEqual(archived);
    expect((await getDoc(doc(db, COLLECTIONS.foods, created.id))).data()).toEqual(archived);
  });

  it("marks as published only the version that was published, not a later write", async () => {
    const foods = createOwnFoodPort(ctx);
    const v1 = await foods.createFood(TRAINER_ID, draft);
    const v2 = await foods.updateFood(TRAINER_ID, v1.id, { ...draft, name: "Lentejas pardinas" });

    expect((await foods.markFoodPublished(TRAINER_ID, v1.id, v1.updatedAt)).publishStatus).toBe(
      "pendiente",
    );
    expect((await foods.getFood(TRAINER_ID, v1.id))?.publishStatus).toBe("pendiente");
    expect((await foods.markFoodPublished(TRAINER_ID, v1.id, v2.updatedAt)).publishStatus).toBe(
      "publicado",
    );
    expect((await foods.getFood(TRAINER_ID, v1.id))?.publishStatus).toBe("publicado");
  });

  it("another trainer neither sees nor writes them: not_found (I28)", async () => {
    const foods = createOwnFoodPort(ctx);
    const [food] = await foods.listFoods(TRAINER_ID);
    expect(await foods.listFoods(STRANGER)).toEqual([]);
    expect(await foods.listPendingFoods(STRANGER)).toEqual([]);
    expect(await foods.getFood(STRANGER, food!.id)).toBeNull();
    for (const write of [
      () => foods.updateFood(STRANGER, food!.id, draft),
      () => foods.archiveFood(STRANGER, food!.id),
      () => foods.markFoodPublished(STRANGER, food!.id, food!.updatedAt),
    ]) {
      await expect(write()).rejects.toMatchObject({ code: "not_found" });
    }
    expect(await foods.getFood(TRAINER_ID, food!.id)).toEqual(food);
  });
});

describe("catálogo común de alimentos con Firebase", () => {
  it("always answers unavailable until its API exists", async () => {
    const catalog = createUnavailableFoodCatalogPort();
    await expect(catalog.listCatalogFoods()).rejects.toMatchObject({
      code: "food_catalog.unavailable",
    });
    await expect(
      catalog.publishFood(TRAINER_ID, createDemoState(TODAY).foods[0]!),
    ).rejects.toMatchObject({ code: "food_catalog.unavailable" });
  });
});
