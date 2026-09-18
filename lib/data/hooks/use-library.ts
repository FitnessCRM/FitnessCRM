"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExerciseChanges, ExerciseInput } from "@/lib/data/ports";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

export function useExercises() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.exercises(trainerId ?? ""),
    queryFn: () => ports.exercises.listExercises(trainerId!),
    enabled: trainerId !== undefined,
  });
}

export function useExerciseUsage(exerciseId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.exerciseUsage(trainerId ?? "", exerciseId ?? ""),
    queryFn: () => ports.exercises.getExerciseUsage(trainerId!, exerciseId!),
    enabled: trainerId !== undefined && exerciseId !== undefined,
  });
}

export function useSaveExercise() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (
      input:
        | { exerciseId: string; changes: ExerciseChanges }
        | { create: Omit<ExerciseInput, "trainerId"> },
    ) =>
      "create" in input
        ? ports.exercises.createExercise({ ...input.create, trainerId: trainerId! })
        : ports.exercises.updateExercise(trainerId!, input.exerciseId, input.changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.exercises(trainerId!) }),
  });
}

/** Archiva el ejercicio y lo retira de las rutinas: invalida biblioteca y rutinas. */
export function useArchiveExercise() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (exerciseId: string) => ports.exercises.archiveExercise(trainerId!, exerciseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises(trainerId!) });
      void queryClient.invalidateQueries({ queryKey: ["routines", trainerId!] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.routineTemplates(trainerId!) });
    },
  });
}
