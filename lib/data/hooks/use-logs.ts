"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WeightLogInput, WorkoutLogInput } from "@/lib/data/ports";
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

export function useAddWeightLog(clientId: string | undefined) {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (input: Omit<WeightLogInput, "trainerId" | "clientId">) =>
      ports.weightLogs.addWeightLog({ ...input, trainerId: trainerId!, clientId: clientId! }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.weightLogs(trainerId!, clientId!) }),
  });
}

export function useWorkoutLogs(clientId: string | undefined, routineId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.workoutLogs(trainerId ?? "", clientId ?? "", routineId ?? ""),
    queryFn: () => ports.workoutLogs.listWorkoutLogs(trainerId!, clientId!, routineId!),
    enabled: trainerId !== undefined && clientId !== undefined && routineId !== undefined,
  });
}

export function useSaveWorkoutLog(clientId: string | undefined) {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (input: Omit<WorkoutLogInput, "trainerId" | "clientId">) =>
      ports.workoutLogs.saveWorkoutLog({ ...input, trainerId: trainerId!, clientId: clientId! }),
    onSuccess: (log) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.workoutLogs(trainerId!, clientId!, log.routineId),
      }),
  });
}

export function useDeleteWorkoutLog(clientId: string | undefined, routineId: string | undefined) {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (workoutLogId: string) =>
      ports.workoutLogs.deleteWorkoutLog(trainerId!, workoutLogId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.workoutLogs(trainerId!, clientId!, routineId!),
      }),
  });
}
