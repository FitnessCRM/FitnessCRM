"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  planMenuPublish,
  type DayType,
  type Macros,
  type Menu,
  type MenuTemplateEntry,
  type RoutineBody,
  type RoutinePublishOp,
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

/**
 * Clona una plantilla al cliente. Invalida sus rutinas o menús, el seguimiento (que enseña el plan)
 * y la lista de plantillas de ese tipo (que cuenta en cuántos clientes se usa).
 */
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
    onSuccess: (_, input) => {
      const routine = input.kind === "routine";
      void queryClient.invalidateQueries({
        queryKey: routine
          ? queryKeys.routines(trainerId!, clientId!)
          : queryKeys.menus(trainerId!, clientId!),
      });
      void queryClient.invalidateQueries({
        queryKey: routine
          ? queryKeys.routineTemplates(trainerId!)
          : queryKeys.menuTemplates(trainerId!),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientsTrackingAll(trainerId!) });
    },
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
 * Guarda y publica la rutina según `routinePublishOp` (§7): crea una nueva, edita en sitio el
 * borrador o, sobre la activa, crea una versión nueva; y la activa, con lo que la anterior pasa a
 * archivada (I4). Lo activo nunca se edita en sitio.
 */
export function usePublishRoutine(clientId: string | undefined) {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: async ({ op, body }: { op: RoutinePublishOp; body: RoutineBody }) => {
      const r = ports.routines;
      const draft =
        op.type === "create"
          ? await r.createRoutine(trainerId!, clientId!, body)
          : op.type === "update"
            ? await r.updateRoutine(trainerId!, op.id, body)
            : await r.reviseRoutine(trainerId!, op.id, body);
      return r.activateRoutine(trainerId!, draft.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.routines(trainerId!, clientId!) });
      // El seguimiento enseña el nombre de la rutina activa.
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientsTrackingAll(trainerId!) });
    },
  });
}

/**
 * Aplica el plan de `planMenuPublish`: archiva lo quitado, guarda borradores y versiones nuevas, y
 * activa cada tipo de día que cambia, con lo que su conjunto activo anterior se archiva (§7).
 */
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
        else if (op.type === "revise") await ports.menus.reviseMenu(trainerId!, op.id, op.body);
        else await ports.menus.archiveMenu(trainerId!, op.id);
      }
      for (const dayType of plan.activate) {
        await ports.menus.activateMenus(trainerId!, clientId!, dayType);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.menus(trainerId!, clientId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.clientsTrackingAll(trainerId!) });
    },
  });
}
