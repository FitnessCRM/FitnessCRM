import type { WeightLogPort, WorkoutLogPort } from "@/lib/data/ports";
import {
  DomainError,
  assertWeightLogDeletable,
  weightLogSchema,
  workoutLogSchema,
} from "@/lib/domain";
import { findOwn, own, ownClient, removeById, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createWeightLogPort(ctx: MockContext): WeightLogPort {
  return {
    listWeightLogs: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.weightLogs, trainerId)
          .filter((w) => w.clientId === clientId)
          .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
      ),
    saveWeightLog: async (input) => {
      ownClient(ctx.state, input.trainerId, input.clientId);
      const existing = ctx.state.weightLogs.find(
        (w) =>
          w.trainerId === input.trainerId && w.clientId === input.clientId && w.date === input.date,
      );
      const log = weightLogSchema.parse({
        ...input,
        // Nota vacía: se conserva la anterior (I23).
        note: input.note.trim() || existing?.note,
        id: existing?.id ?? ctx.newId(),
        createdAt: existing?.createdAt ?? ctx.now(),
      });
      return ctx.reply(replaceById(ctx.state.weightLogs, log));
    },
    deleteWeightLog: async (trainerId, weightLogId) => {
      findOwn(ctx.state.weightLogs, trainerId, weightLogId, "Pesaje");
      assertWeightLogDeletable(weightLogId, own(ctx.state.reviews, trainerId)); // I25
      removeById(ctx.state.weightLogs, weightLogId);
      // Solo puede quedar algún borrador apuntándolo: se queda sin peso.
      for (const review of ctx.state.reviews) {
        if (review.weightLogId === weightLogId) review.weightLogId = null;
      }
      return ctx.reply(undefined);
    },
  };
}

export function createWorkoutLogPort(ctx: MockContext): WorkoutLogPort {
  return {
    listWorkoutLogs: async (trainerId, clientId) =>
      ctx.reply(own(ctx.state.workoutLogs, trainerId).filter((l) => l.clientId === clientId)),
    saveWorkoutLog: async (input) => {
      ownClient(ctx.state, input.trainerId, input.clientId);
      // La serie se registra sobre una rutina de ese cliente y de ese entrenador.
      const routine = findOwn(ctx.state.routines, input.trainerId, input.routineId, "Rutina");
      if (routine.clientId !== input.clientId) {
        throw new DomainError("not_found", `Rutina ${input.routineId} no existe`);
      }
      const existing = ctx.state.workoutLogs.find(
        (l) =>
          l.trainerId === input.trainerId &&
          l.clientId === input.clientId &&
          l.routineDayExerciseId === input.routineDayExerciseId &&
          l.date === input.date &&
          l.setNumber === input.setNumber,
      );
      const log = workoutLogSchema.parse({
        ...input,
        id: existing?.id ?? ctx.newId(),
        createdAt: existing?.createdAt ?? ctx.now(),
      });
      return ctx.reply(replaceById(ctx.state.workoutLogs, log));
    },
    deleteWorkoutLog: async (trainerId, workoutLogId) => {
      findOwn(ctx.state.workoutLogs, trainerId, workoutLogId, "Serie");
      removeById(ctx.state.workoutLogs, workoutLogId);
      return ctx.reply(undefined);
    },
  };
}
