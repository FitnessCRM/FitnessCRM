"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DayType, Macros } from "@/lib/domain";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

export function useActiveRoutine(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.activeRoutine(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.routines.getActiveRoutine(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

export function useMacroTargets(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.macroTargets(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.macroTargets.listMacroTargets(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

export function useSetMacroTargets(clientId: string | undefined) {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: ({ dayType, macros }: { dayType: DayType; macros: Macros }) =>
      ports.macroTargets.setMacroTargets(trainerId!, clientId!, dayType, macros),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.macroTargets(trainerId!, clientId!) }),
  });
}

export function useActiveMenus(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.menus(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.menus.listActiveMenus(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

export function useRoutineTemplates() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.routineTemplates(trainerId ?? ""),
    queryFn: () => ports.templates.listRoutineTemplates(trainerId!),
    enabled: trainerId !== undefined,
  });
}

export function useMenuTemplates() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.menuTemplates(trainerId ?? ""),
    queryFn: () => ports.templates.listMenuTemplates(trainerId!),
    enabled: trainerId !== undefined,
  });
}

/** Clona una plantilla al cliente. Invalida sus rutinas o menús. */
export function useAssignTemplate(clientId: string | undefined) {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: async (input: {
      kind: "routine" | "menu";
      templateId: string;
    }): Promise<unknown> =>
      input.kind === "routine"
        ? ports.templates.assignRoutineTemplate(trainerId!, clientId!, input.templateId)
        : ports.templates.assignMenuTemplate(trainerId!, clientId!, input.templateId),
    onSuccess: (_, input) =>
      queryClient.invalidateQueries({
        queryKey:
          input.kind === "routine"
            ? queryKeys.routines(trainerId!, clientId!)
            : queryKeys.menus(trainerId!, clientId!),
      }),
  });
}
