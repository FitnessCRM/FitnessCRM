import { runTransaction, setDoc, where, writeBatch } from "firebase/firestore";
import type { ExercisePort } from "@/lib/data/ports";
import {
  exerciseSchema,
  removeExerciseFromRoutine,
  routineSchema,
  routineTemplateSchema,
  routinesUsingExercise,
} from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, listOwn, readOwn, ref, requireOwn, txRequireOwn } from "./helpers";

export function createExercisePort(ctx: FirebaseContext): ExercisePort {
  const name = COLLECTIONS.exercises;

  // Las rutinas que modifica el archivado: activas y borradores. Las archivadas no se tocan (§7).
  // Se leen enteras en memoria: son las rutinas vivas de una cartera, no su histórico.
  const liveRoutines = (trainerId: string) =>
    listOwn(
      ctx,
      COLLECTIONS.routines,
      routineSchema,
      trainerId,
      where("status", "in", ["borrador", "activo"]),
    );
  const templates = (trainerId: string) =>
    listOwn(ctx, COLLECTIONS.routineTemplates, routineTemplateSchema, trainerId);

  return {
    listExercises: async (trainerId) =>
      (await listOwn(ctx, name, exerciseSchema, trainerId, where("status", "==", "activo"))).sort(
        (a, b) => a.name.localeCompare(b.name),
      ),
    getExercise: (trainerId, exerciseId) =>
      readOwn(ctx, name, exerciseSchema, trainerId, exerciseId),
    createExercise: async (input) => {
      const exercise = exerciseSchema.parse({
        ...input,
        id: ctx.newId(),
        status: "activo",
        createdAt: ctx.now(),
      });
      await setDoc(ref(ctx, name, exercise.id), exercise);
      return exercise;
    },
    updateExercise: (trainerId, exerciseId, changes) =>
      runTransaction(ctx.db, async (tx) => {
        const docRef = ref(ctx, name, exerciseId);
        const { value: current } = await txRequireOwn(
          tx,
          docRef,
          exerciseSchema,
          trainerId,
          "Ejercicio",
        );
        const next = exerciseSchema.parse({ ...current, ...changes, trainerId, id: exerciseId });
        tx.set(docRef, next, { merge: true });
        return next;
      }),
    getExerciseUsage: async (trainerId, exerciseId) => {
      const [routines, tpls] = await Promise.all([liveRoutines(trainerId), templates(trainerId)]);
      return {
        clientIds: [...new Set(routinesUsingExercise(routines, exerciseId).map((r) => r.clientId))],
        routineTemplateIds: routinesUsingExercise(tpls, exerciseId).map((t) => t.id),
      };
    },
    archiveExercise: async (trainerId, exerciseId) => {
      const exercise = await requireOwn(
        ctx,
        name,
        exerciseSchema,
        trainerId,
        exerciseId,
        "Ejercicio",
      );
      const [routines, tpls] = await Promise.all([liveRoutines(trainerId), templates(trainerId)]);
      const now = ctx.now();
      // Un solo lote: el ejercicio se archiva a la vez que sale de las rutinas y plantillas que lo
      // prescribían, o no pasa nada. Solo se tocan las que lo usan.
      const batch = writeBatch(ctx.db);
      for (const r of routinesUsingExercise(routines, exerciseId)) {
        batch.set(
          ref(ctx, COLLECTIONS.routines, r.id),
          { ...removeExerciseFromRoutine(r, exerciseId), updatedAt: now },
          { merge: true },
        );
      }
      for (const t of routinesUsingExercise(tpls, exerciseId)) {
        batch.set(
          ref(ctx, COLLECTIONS.routineTemplates, t.id),
          { ...removeExerciseFromRoutine(t, exerciseId), updatedAt: now },
          { merge: true },
        );
      }
      batch.update(ref(ctx, name, exerciseId), { status: "archivado" });
      await batch.commit();
      return { ...exercise, status: "archivado" };
    },
  };
}
