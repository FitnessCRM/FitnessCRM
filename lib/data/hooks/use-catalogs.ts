"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ResponseFormat } from "@/lib/domain";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

export function useMeasurementTypes() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.measurementTypes(trainerId ?? ""),
    queryFn: () => ports.measurementTypes.listMeasurementTypes(trainerId!),
    enabled: trainerId !== undefined,
  });
}

export function useQuestions() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.questions(trainerId ?? ""),
    queryFn: () => ports.questionnaire.listQuestions(trainerId!),
    enabled: trainerId !== undefined,
  });
}

/**
 * Qué preguntas tienen ya alguna respuesta: I15 congela su formato desde ese momento, y la
 * pantalla lo enseña deshabilitado en vez de negarlo al intentar guardarlo.
 */
export function useQuestionsWithResponses(questionIds: readonly string[] | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  const ids = [...new Set(questionIds ?? [])].sort();
  return useQuery({
    queryKey: queryKeys.questionsWithResponses(trainerId ?? "", ids),
    queryFn: async () => {
      const flags = await Promise.all(
        ids.map((id) => ports.questionnaire.questionHasResponses(trainerId!, id)),
      );
      return new Set(ids.filter((_, i) => flags[i]));
    },
    enabled: trainerId !== undefined && questionIds !== undefined,
  });
}

type QuestionMutation =
  | { create: { prompt: string; format: ResponseFormat } }
  | { questionId: string; changes: Partial<{ prompt: string; format: ResponseFormat }> }
  | { archive: string }
  | { unarchive: string }
  | { reorder: string[] };

export function useSaveQuestion() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: async (input: QuestionMutation): Promise<unknown> => {
      const q = ports.questionnaire;
      if ("create" in input) return q.createQuestion(trainerId!, input.create);
      if ("archive" in input) return q.archiveQuestion(trainerId!, input.archive);
      if ("unarchive" in input) return q.unarchiveQuestion(trainerId!, input.unarchive);
      if ("reorder" in input) return q.reorderQuestions(trainerId!, input.reorder);
      return q.updateQuestion(trainerId!, input.questionId, input.changes);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.questions(trainerId!) }),
  });
}

type MeasurementTypeMutation =
  | { create: { label: string; unit: string } }
  | { typeId: string; changes: Partial<{ label: string; unit: string }> }
  | { archive: string }
  | { unarchive: string }
  | { reorder: string[] };

export function useSaveMeasurementType() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: async (input: MeasurementTypeMutation): Promise<unknown> => {
      const m = ports.measurementTypes;
      if ("create" in input) return m.createMeasurementType(trainerId!, input.create);
      if ("archive" in input) return m.archiveMeasurementType(trainerId!, input.archive);
      if ("unarchive" in input) return m.unarchiveMeasurementType(trainerId!, input.unarchive);
      if ("reorder" in input) return m.reorderMeasurementTypes(trainerId!, input.reorder);
      return m.updateMeasurementType(trainerId!, input.typeId, input.changes);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.measurementTypes(trainerId!) }),
  });
}
