import { getDoc, runTransaction } from "firebase/firestore";
import type { TrainerPort } from "@/lib/data/ports";
import { trainerSchema } from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, notFound, parseDoc, ref } from "./helpers";

/** El entrenador es la raíz de tenancy: su id de documento es su `trainerId`. */
export function createTrainerPort(ctx: FirebaseContext): TrainerPort {
  const trainerRef = (trainerId: string) => ref(ctx, COLLECTIONS.trainers, trainerId);
  return {
    getTrainer: async (trainerId) => {
      const snap = await getDoc(trainerRef(trainerId));
      return snap.exists() ? parseDoc(trainerSchema, snap) : null;
    },
    updateTrainer: (trainerId, changes) =>
      runTransaction(ctx.db, async (tx) => {
        const snap = await tx.get(trainerRef(trainerId));
        if (!snap.exists()) throw notFound("Entrenador", trainerId);
        const next = trainerSchema.parse({ ...parseDoc(trainerSchema, snap), ...changes });
        tx.set(trainerRef(trainerId), next, { merge: true });
        return next;
      }),
  };
}
