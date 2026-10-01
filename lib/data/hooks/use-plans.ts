"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  planMenuPublish,
  type DayType,
  type Macros,
  type Menu,
  type MenuTemplateEntry,
  type Routine,
  type RoutineBody,
} from "@/lib/domain";
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

/** Todas las rutinas del cliente (activa, borradores y archivadas), la más reciente primero. */
export function useClientRoutines(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.routines(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.routines.listRoutines(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

/** Menús activos y en borrador del cliente: lo que se edita en el editor de plan. */
export function useEditableMenus(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.editableMenus(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.menus.listMenus(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

/**
 * Guarda y publica la rutina: actualiza la que se está editando (o crea una si no había) y, si era
 * un borrador, la activa. La activa anterior pasa a archivada (I4).
 */
export function usePublishRoutine(clientId: string | undefined) {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: async ({ target, body }: { target: Routine | null; body: RoutineBody }) => {
      const saved = target
        ? await ports.routines.updateRoutine(trainerId!, target.id, body)
        : await ports.routines.createRoutine(trainerId!, clientId!, body);
      return saved.status === "borrador"
        ? ports.routines.activateRoutine(trainerId!, saved.id)
        : saved;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.routines(trainerId!, clientId!) }),
  });
}

/** Aplica el plan de `planMenuPublish`: guarda cada menú y publica los tipos de día con borradores. */
export function usePublishMenus(clientId: string | undefined) {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: async ({
      current,
      next,
    }: {
      current: readonly Menu[];
      next: readonly MenuTemplateEntry[];
    }) => {
      const plan = planMenuPublish(current, next);
      for (const op of plan.ops) {
        if (op.type === "create") await ports.menus.createMenu(trainerId!, clientId!, op.body);
        else if (op.type === "update") await ports.menus.updateMenu(trainerId!, op.id, op.body);
        else await ports.menus.archiveMenu(trainerId!, op.id);
      }
      for (const dayType of plan.activate) {
        await ports.menus.activateMenus(trainerId!, clientId!, dayType);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.menus(trainerId!, clientId!) }),
  });
}
