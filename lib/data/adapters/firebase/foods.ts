import { runTransaction, setDoc, where } from "firebase/firestore";
import type { OwnFoodPort } from "@/lib/data/ports";
import { foodDraftSchema, foodSchema, type Food } from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, listOwn, readOwn, ref, txRequireOwn } from "./helpers";

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * La copia propia de los alimentos (§4, §12) sobre la colección `foods`. Cumple I1 tal cual: solo
 * su entrenador la lee y la escribe, en el adaptador y en las reglas (I28). No sabe nada del
 * catálogo común: publicar es cosa del hook, que habla con los dos puertos.
 */
export function createOwnFoodPort(ctx: FirebaseContext): OwnFoodPort {
  const name = COLLECTIONS.foods;

  /**
   * Escribe una versión nueva sobre lo leído en la transacción. Toda escritura deja el alimento
   * `pendiente`: el catálogo aún no tiene esta versión (§7). Si `change` devuelve `null` no hay
   * versión nueva y no se escribe nada.
   */
  const writeVersion = (
    trainerId: string,
    foodId: string,
    change: (current: Food) => Food | null,
  ) =>
    runTransaction(ctx.db, async (tx) => {
      const docRef = ref(ctx, name, foodId);
      const { value: current } = await txRequireOwn(tx, docRef, foodSchema, trainerId, "Alimento");
      const changed = change(current);
      if (!changed) return current;
      const next = foodSchema.parse({
        ...changed,
        id: foodId,
        trainerId,
        createdAt: current.createdAt,
        publishStatus: "pendiente",
        updatedAt: ctx.now(),
      });
      tx.set(docRef, next);
      return next;
    });

  return {
    listFoods: async (trainerId) =>
      (await listOwn(ctx, name, foodSchema, trainerId, where("status", "==", "activo"))).sort(
        byName,
      ),
    getFood: (trainerId, foodId) => readOwn(ctx, name, foodSchema, trainerId, foodId),
    createFood: async (trainerId, draft) => {
      const { name: foodName, composition } = foodDraftSchema.parse(draft);
      const now = ctx.now();
      const food = foodSchema.parse({
        id: ctx.newId(),
        trainerId,
        name: foodName,
        composition,
        status: "activo",
        publishStatus: "pendiente",
        createdAt: now,
        updatedAt: now,
      });
      await setDoc(ref(ctx, name, food.id), food);
      return food;
    },
    updateFood: (trainerId, foodId, draft) => {
      const { name: foodName, composition } = foodDraftSchema.parse(draft);
      return writeVersion(trainerId, foodId, (current) => ({
        ...current,
        name: foodName,
        composition,
      }));
    },
    archiveFood: (trainerId, foodId) =>
      // Ya archivado: no hay versión nueva que publicar.
      writeVersion(trainerId, foodId, (food) =>
        food.status === "archivado" ? null : { ...food, status: "archivado" },
      ),
    listPendingFoods: (trainerId) =>
      listOwn(ctx, name, foodSchema, trainerId, where("publishStatus", "==", "pendiente")),
    markFoodPublished: (trainerId, foodId, version) =>
      // Leer, comparar y escribir en la misma transacción: si otra escritura entra entre la
      // publicación y esta marca, Firestore repite la transacción y la comparación ya no casa.
      runTransaction(ctx.db, async (tx) => {
        const docRef = ref(ctx, name, foodId);
        const { value: current } = await txRequireOwn(
          tx,
          docRef,
          foodSchema,
          trainerId,
          "Alimento",
        );
        if (current.updatedAt !== version || current.publishStatus === "publicado") return current;
        tx.update(docRef, { publishStatus: "publicado" });
        return { ...current, publishStatus: "publicado" as const };
      }),
  };
}
