"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DayType, Macros } from "@/lib/domain";
import type { MenuTemplateInput, RoutineTemplateInput } from "@/lib/data/ports";
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

/** Copia una plantilla con otro nombre. Refresca la lista de su tipo. */
export function useDuplicateTemplate() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: async (input: {
      kind: "routine" | "menu";
      templateId: string;
      name: string;
    }): Promise<unknown> =>
      input.kind === "routine"
        ? ports.templates.duplicateRoutineTemplate(trainerId!, input.templateId, input.name)
        : ports.templates.duplicateMenuTemplate(trainerId!, input.templateId, input.name),
    onSuccess: (_, input) =>
      queryClient.invalidateQueries({
        queryKey:
          input.kind === "routine"
            ? queryKeys.routineTemplates(trainerId!)
            : queryKeys.menuTemplates(trainerId!),
      }),
  });
}

/** Borra una plantilla. Los planes ya asignados no se tocan: son copias (§4). */
export function useDeleteTemplate() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: async (input: { kind: "routine" | "menu"; templateId: string }): Promise<void> =>
      input.kind === "routine"
        ? ports.templates.deleteRoutineTemplate(trainerId!, input.templateId)
        : ports.templates.deleteMenuTemplate(trainerId!, input.templateId),
    onSuccess: (_, input) =>
      queryClient.invalidateQueries({
        queryKey:
          input.kind === "routine"
            ? queryKeys.routineTemplates(trainerId!)
            : queryKeys.menuTemplates(trainerId!),
      }),
  });
}

/** Crea o actualiza una plantilla de rutina. Refresca la lista. */
export function useSaveRoutineTemplate() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (input: Omit<RoutineTemplateInput, "trainerId"> & { id?: string }) =>
      ports.templates.saveRoutineTemplate({ ...input, trainerId: trainerId! }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.routineTemplates(trainerId!) }),
  });
}

/** Crea o actualiza una plantilla de menú. Refresca la lista. */
export function useSaveMenuTemplate() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (input: Omit<MenuTemplateInput, "trainerId"> & { id?: string }) =>
      ports.templates.saveMenuTemplate({ ...input, trainerId: trainerId! }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.menuTemplates(trainerId!) }),
  });
}
