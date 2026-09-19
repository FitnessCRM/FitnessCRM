import type { WeightLogPort, WorkoutLogPort } from "@/lib/data/ports";
import { weightLogSchema, workoutLogSchema } from "@/lib/domain";
import { findOwn, own, removeById, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createWeightLogPort(ctx: MockContext): WeightLogPort {
  return {
    listWeightLogs: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.weightLogs, trainerId)
          .filter((w) => w.clientId === clientId)
          .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
      ),
    addWeightLog: async (input) => {
      const log = weightLogSchema.parse({ ...input, id: ctx.newId(), createdAt: ctx.now() });
      ctx.state.weightLogs.push(log);
      return ctx.reply(log);
    },
    deleteWeightLog: async (trainerId, weightLogId) => {
      findOwn(ctx.state.weightLogs, trainerId, weightLogId, "Pesaje");
      removeById(ctx.state.weightLogs, weightLogId);
      for (const review of ctx.state.reviews) {
        if (review.weightLogId === weightLogId) review.weightLogId = null;
      }
      return ctx.reply(undefined);
    },
  };
}

export function createWorkoutLogPort(ctx: MockContext): WorkoutLogPort {
  return {
    listWorkoutLogs: async (trainerId, clientId, routineId) =>
      ctx.reply(
        own(ctx.state.workoutLogs, trainerId).filter(
          (l) => l.clientId === clientId && l.routineId === routineId,
        ),
      ),
    saveWorkoutLog: async (input) => {
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
