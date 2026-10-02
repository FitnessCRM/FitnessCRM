import type { ExercisePort } from "@/lib/data/ports";
import { exerciseSchema, removeExerciseFromRoutine, routinesUsingExercise } from "@/lib/domain";
import { findOwn, own, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createExercisePort(ctx: MockContext): ExercisePort {
  return {
    listExercises: async (trainerId) =>
      ctx.reply(
        own(ctx.state.exercises, trainerId)
          .filter((e) => e.status === "activo")
          .sort((a, b) => a.name.localeCompare(b.name)),
      ),
    getExercise: async (trainerId, exerciseId) =>
      ctx.reply(
        ctx.state.exercises.find((e) => e.id === exerciseId && e.trainerId === trainerId) ?? null,
      ),
    createExercise: async (input) => {
      const exercise = exerciseSchema.parse({
        ...input,
        id: ctx.newId(),
        status: "activo",
        createdAt: ctx.now(),
      });
      ctx.state.exercises.push(exercise);
      return ctx.reply(exercise);
    },
    updateExercise: async (trainerId, exerciseId, changes) => {
      const current = findOwn(ctx.state.exercises, trainerId, exerciseId, "Ejercicio");
      const next = exerciseSchema.parse({ ...current, ...changes, trainerId, id: exerciseId });
      return ctx.reply(replaceById(ctx.state.exercises, next));
    },
    getExerciseUsage: async (trainerId, exerciseId) => {
      // Las que modifica el archivado: activas y borradores. Las archivadas no se tocan (§7).
      const live = own(ctx.state.routines, trainerId).filter((r) => r.status !== "archivado");
      const routines = routinesUsingExercise(live, exerciseId);
      const templates = routinesUsingExercise(
        own(ctx.state.routineTemplates, trainerId),
        exerciseId,
      );
      return ctx.reply({
        clientIds: [...new Set(routines.map((r) => r.clientId))],
        routineTemplateIds: templates.map((t) => t.id),
      });
    },
    archiveExercise: async (trainerId, exerciseId) => {
      const exercise = findOwn(ctx.state.exercises, trainerId, exerciseId, "Ejercicio");
      const now = ctx.now();
      // Solo rutinas vivas: las archivadas existen para leer un entreno antiguo en su contexto.
      ctx.state.routines = ctx.state.routines.map((r) =>
        r.trainerId === trainerId && r.status !== "archivado"
          ? { ...removeExerciseFromRoutine(r, exerciseId), updatedAt: now }
          : r,
      );
      ctx.state.routineTemplates = ctx.state.routineTemplates.map((t) =>
        t.trainerId === trainerId
          ? { ...removeExerciseFromRoutine(t, exerciseId), updatedAt: now }
          : t,
      );
      exercise.status = "archivado";
      return ctx.reply(exercise);
    },
  };
}
