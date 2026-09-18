import type { ExercisePort } from "@/lib/data/ports";
import { exerciseSchema, removeExerciseFromRoutine, routinesUsingExercise } from "@/lib/domain";
import { findOwn, own, removeById, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createExercisePort(ctx: MockContext): ExercisePort {
  return {
    listExercises: async (trainerId) =>
      ctx.reply(own(ctx.state.exercises, trainerId).sort((a, b) => a.name.localeCompare(b.name))),
    getExercise: async (trainerId, exerciseId) =>
      ctx.reply(
        ctx.state.exercises.find((e) => e.id === exerciseId && e.trainerId === trainerId) ?? null,
      ),
    createExercise: async (input) => {
      const exercise = exerciseSchema.parse({ ...input, id: ctx.newId(), createdAt: ctx.now() });
      ctx.state.exercises.push(exercise);
      return ctx.reply(exercise);
    },
    updateExercise: async (trainerId, exerciseId, changes) => {
      const current = findOwn(ctx.state.exercises, trainerId, exerciseId, "Ejercicio");
      const next = exerciseSchema.parse({ ...current, ...changes, trainerId, id: exerciseId });
      return ctx.reply(replaceById(ctx.state.exercises, next));
    },
    getExerciseUsage: async (trainerId, exerciseId) => {
      const routines = routinesUsingExercise(own(ctx.state.routines, trainerId), exerciseId);
      const templates = routinesUsingExercise(
        own(ctx.state.routineTemplates, trainerId),
        exerciseId,
      );
      return ctx.reply({
        clientIds: [...new Set(routines.map((r) => r.clientId))],
        routineTemplateIds: templates.map((t) => t.id),
      });
    },
    deleteExercise: async (trainerId, exerciseId) => {
      findOwn(ctx.state.exercises, trainerId, exerciseId, "Ejercicio");
      const now = ctx.now();
      ctx.state.routines = ctx.state.routines.map((r) =>
        r.trainerId === trainerId
          ? { ...removeExerciseFromRoutine(r, exerciseId), updatedAt: now }
          : r,
      );
      ctx.state.routineTemplates = ctx.state.routineTemplates.map((t) =>
        t.trainerId === trainerId
          ? { ...removeExerciseFromRoutine(t, exerciseId), updatedAt: now }
          : t,
      );
      removeById(ctx.state.exercises, exerciseId);
      return ctx.reply(undefined);
    },
  };
}
