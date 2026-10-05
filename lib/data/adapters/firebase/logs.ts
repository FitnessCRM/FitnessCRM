import {
  collection,
  deleteDoc,
  getDocs,
  query,
  runTransaction,
  where,
  type DocumentData,
} from "firebase/firestore";
import type { WeightLogPort, WorkoutLogPort } from "@/lib/data/ports";
import {
  assertWeightLogDate,
  assertWeightLogDeletable,
  civilDateInTimeZone,
  clientSchema,
  routineSchema,
  trainerSchema,
  weightLogSchema,
  workoutLogSchema,
  type Review,
} from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, listOwn, notFound, ref, requireOwn, txRequireOwn } from "./helpers";

/**
 * Un pesaje por cliente y día (I23): el id del documento es `{clientId}_{fecha}`, así que guardar
 * de nuevo ese día cae sobre el mismo documento y no hace falta buscar el anterior con una consulta.
 */
export const weightLogDocId = (clientId: string, date: string) => `${clientId}_${date}`;

/** Una serie es única por línea prescrita, fecha y número de serie: ese trío es su id. */
export const workoutLogDocId = (
  clientId: string,
  routineDayExerciseId: string,
  date: string,
  setNumber: number,
) => `${clientId}_${routineDayExerciseId}_${date}_${setNumber}`;

export function createWeightLogPort(ctx: FirebaseContext): WeightLogPort {
  const name = COLLECTIONS.weightLogs;
  return {
    listWeightLogs: async (trainerId, clientId) =>
      (
        await listOwn(ctx, name, weightLogSchema, trainerId, where("clientId", "==", clientId))
      ).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    saveWeightLog: (input) =>
      runTransaction(ctx.db, async (tx) => {
        const { trainerId, clientId } = input;
        // I1/I2: el cliente existe y es de este entrenador; si no, `not_found`.
        const { value: client } = await txRequireOwn(
          tx,
          ref(ctx, COLLECTIONS.clients, clientId),
          clientSchema,
          trainerId,
          "Cliente",
        );
        const trainerSnap = await tx.get(ref(ctx, COLLECTIONS.trainers, trainerId));
        if (!trainerSnap.exists()) throw notFound("Entrenador", trainerId);
        const trainer = trainerSchema.parse({ ...trainerSnap.data(), id: trainerSnap.id });
        // I27: ni futuro, en la zona del entrenador y con el reloj de esta llamada, ni antes del alta.
        assertWeightLogDate(input.date, {
          today: civilDateInTimeZone(ctx.now(), trainer.timeZone),
          startDate: client.startDate,
        });
        const logRef = ref(ctx, name, weightLogDocId(clientId, input.date));
        const existingSnap = await tx.get(logRef);
        const existing = existingSnap.exists()
          ? weightLogSchema.parse({ ...existingSnap.data(), id: existingSnap.id })
          : null;
        const log = weightLogSchema.parse({
          ...input,
          // Nota vacía: se conserva la anterior (I23).
          note: input.note.trim() || existing?.note,
          id: logRef.id,
          createdAt: existing?.createdAt ?? ctx.now(),
        });
        tx.set(logRef, log);
        return log;
      }),
    deleteWeightLog: async (trainerId, weightLogId) => {
      const log = await requireOwn(ctx, name, weightLogSchema, trainerId, weightLogId, "Pesaje");
      // Las revisiones que lo apuntan: de ahí sale quién lo usa. La consulta va fuera de la
      // transacción y solo da los ids; dentro se releen por referencia (I25), así que una revisión
      // enviada entre la consulta y el borrado también bloquea. No se parsean con el esquema
      // completo: aquí solo importan su estado y su `weightLogId`.
      const pointing = await getDocs(
        query(
          collection(ctx.db, COLLECTIONS.reviews),
          where("trainerId", "==", trainerId),
          // Las reglas dejan leer al cliente solo sus revisiones, y una consulta tiene que probarlo.
          where("clientId", "==", log.clientId),
          where("weightLogId", "==", weightLogId),
        ),
      );
      await runTransaction(ctx.db, async (tx) => {
        const logRef = ref(ctx, name, weightLogId);
        await txRequireOwn(tx, logRef, weightLogSchema, trainerId, "Pesaje");
        const reviews = (
          await Promise.all(pointing.docs.map((d) => tx.get(ref(ctx, COLLECTIONS.reviews, d.id))))
        ).flatMap((snap) =>
          snap.exists()
            ? [{ id: snap.id, ...snap.data() } as Pick<Review, "id" | "status" | "weightLogId">]
            : [],
        );
        assertWeightLogDeletable(weightLogId, reviews); // I25
        tx.delete(logRef);
        // Solo puede quedar algún borrador apuntándolo: se queda sin peso.
        for (const review of reviews) {
          if (review.weightLogId === weightLogId) {
            tx.update(ref(ctx, COLLECTIONS.reviews, review.id), { weightLogId: null });
          }
        }
      });
    },
  };
}

export function createWorkoutLogPort(ctx: FirebaseContext): WorkoutLogPort {
  const name = COLLECTIONS.workoutLogs;
  return {
    listWorkoutLogs: (trainerId, clientId) =>
      listOwn(ctx, name, workoutLogSchema, trainerId, where("clientId", "==", clientId)),
    saveWorkoutLog: (input) =>
      runTransaction(ctx.db, async (tx) => {
        const { trainerId, clientId } = input;
        await txRequireOwn(
          tx,
          ref(ctx, COLLECTIONS.clients, clientId),
          clientSchema,
          trainerId,
          "Cliente",
        );
        // La serie se registra sobre una rutina de ese cliente y de ese entrenador.
        const { value: routine } = await txRequireOwn(
          tx,
          ref(ctx, COLLECTIONS.routines, input.routineId),
          routineSchema,
          trainerId,
          "Rutina",
        );
        if (routine.clientId !== clientId) throw notFound("Rutina", input.routineId);
        const logRef = ref(
          ctx,
          name,
          workoutLogDocId(clientId, input.routineDayExerciseId, input.date, input.setNumber),
        );
        const existingSnap = await tx.get(logRef);
        const log = workoutLogSchema.parse({
          ...input,
          id: logRef.id,
          createdAt: existingSnap.exists()
            ? (existingSnap.data() as DocumentData).createdAt
            : ctx.now(),
        });
        tx.set(logRef, log);
        return log;
      }),
    deleteWorkoutLog: async (trainerId, workoutLogId) => {
      await requireOwn(ctx, name, workoutLogSchema, trainerId, workoutLogId, "Serie");
      await deleteDoc(ref(ctx, name, workoutLogId));
    },
  };
}
