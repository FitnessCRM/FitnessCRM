"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import type { WeightLog, WorkoutLog } from "@/lib/domain";
import type { WeightLogInput, WorkoutLogInput } from "@/lib/data/ports";
import { writeKeys, type DeleteWorkoutLogVars } from "./offline-writes";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

export function useWeightLogs(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.weightLogs(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.weightLogs.listWeightLogs(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

/**
 * Sin conexión la mutación queda en cola (`isPaused`) y `mutateAsync` no resuelve hasta que se
 * envía. La función que la ejecuta vive en `offline-writes.ts`, no aquí: la de una mutación
 * restaurada de disco no puede ser la de un componente que ya no existe.
 */
export function useSaveWeightLog(clientId: string | undefined) {
  const trainerId = useTrainerId();
  const mutation = useMutation<WeightLog, Error, WeightLogInput>({
    mutationKey: writeKeys.saveWeightLog,
  });
  return {
    isPending: mutation.isPending,
    isPaused: mutation.isPaused,
    isError: mutation.isError,
    mutateAsync: (input: Omit<WeightLogInput, "trainerId" | "clientId">) =>
      mutation.mutateAsync({ ...input, trainerId: trainerId!, clientId: clientId! }),
  };
}

/** Registros del cliente de todas las versiones de su rutina: «última vez» los casa por línea (§7). */
export function useWorkoutLogs(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.workoutLogs(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.workoutLogs.listWorkoutLogs(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

export function useSaveWorkoutLog(clientId: string | undefined) {
  const trainerId = useTrainerId();
  const mutation = useMutation<WorkoutLog, Error, WorkoutLogInput>({
    mutationKey: writeKeys.saveWorkoutLog,
  });
  return {
    isPending: mutation.isPending,
    isPaused: mutation.isPaused,
    isError: mutation.isError,
    mutateAsync: (input: Omit<WorkoutLogInput, "trainerId" | "clientId">) =>
      mutation.mutateAsync({ ...input, trainerId: trainerId!, clientId: clientId! }),
  };
}

export function useDeleteWorkoutLog(clientId: string | undefined) {
  const trainerId = useTrainerId();
  const mutation = useMutation<void, Error, DeleteWorkoutLogVars>({
    mutationKey: writeKeys.deleteWorkoutLog,
  });
  return {
    isPending: mutation.isPending,
    isPaused: mutation.isPaused,
    isError: mutation.isError,
    mutateAsync: (workoutLogId: string) =>
      mutation.mutateAsync({ trainerId: trainerId!, clientId: clientId!, workoutLogId }),
  };
}
