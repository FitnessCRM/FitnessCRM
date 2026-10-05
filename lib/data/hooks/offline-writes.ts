import type { QueryClient } from "@tanstack/react-query";
import type { DataPorts, WeightLogInput, WorkoutLogInput } from "@/lib/data/ports";
import { queryKeys } from "./query-keys";
import { PERSIST_MAX_AGE_MS } from "./query-persister";

/**
 * Escrituras del cliente que se encolan sin conexión. TanStack Query pausa una mutación mientras no
 * hay red, la guarda con la caché (`query-persister.ts`) y la reanuda al volver. Las funciones no se
 * guardan en disco, así que cada mutación se identifica por su clave y su función se registra aquí,
 * antes de restaurar la caché. Todo el dato que necesita para ejecutarse viaja en sus variables.
 */
export const writeKeys = {
  saveWorkoutLog: ["write", "save-workout-log"] as const,
  deleteWorkoutLog: ["write", "delete-workout-log"] as const,
  saveWeightLog: ["write", "save-weight-log"] as const,
};

export interface DeleteWorkoutLogVars {
  trainerId: string;
  clientId: string;
  workoutLogId: string;
}

/**
 * Misma cola para las tres: se ejecutan de una en una y en el orden en que se hicieron, así que un
 * borrado posterior a una edición de la misma serie no la adelanta. Cada serie y cada pesaje tiene
 * un id fijo (§7, I23), por lo que reenviar una escritura no duplica nada.
 */
const QUEUE = { id: "client-log-writes" };

export function registerOfflineWrites(queryClient: QueryClient, ports: DataPorts): void {
  const invalidateWorkoutLogs = (trainerId: string, clientId: string) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.workoutLogs(trainerId, clientId) });

  queryClient.setMutationDefaults(writeKeys.saveWorkoutLog, {
    mutationFn: (input: WorkoutLogInput) => ports.workoutLogs.saveWorkoutLog(input),
    onSuccess: (_log, input: WorkoutLogInput) =>
      invalidateWorkoutLogs(input.trainerId, input.clientId),
    scope: QUEUE,
    gcTime: PERSIST_MAX_AGE_MS,
  });
  queryClient.setMutationDefaults(writeKeys.deleteWorkoutLog, {
    mutationFn: (vars: DeleteWorkoutLogVars) =>
      ports.workoutLogs.deleteWorkoutLog(vars.trainerId, vars.workoutLogId),
    onSuccess: (_void, vars: DeleteWorkoutLogVars) =>
      invalidateWorkoutLogs(vars.trainerId, vars.clientId),
    scope: QUEUE,
    gcTime: PERSIST_MAX_AGE_MS,
  });
  queryClient.setMutationDefaults(writeKeys.saveWeightLog, {
    mutationFn: (input: WeightLogInput) => ports.weightLogs.saveWeightLog(input),
    onSuccess: (_log, input: WeightLogInput) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.weightLogs(input.trainerId, input.clientId),
      }),
    scope: QUEUE,
    gcTime: PERSIST_MAX_AGE_MS,
  });
}
