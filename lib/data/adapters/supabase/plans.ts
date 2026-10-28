import type { MacroTargetsPort, MenuPort, RoutinePort } from "@/lib/data/ports";
import {
  assertExercisesInLibrary,
  DomainError,
  macrosSchema,
  menuBodySchema,
  routineBodySchema,
  type DayType,
  type Menu,
  type MenuBody,
  type Routine,
  type RoutineBody,
} from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise } from "./errors";
import { EXERCISE_COLUMNS, exerciseFromRow } from "./catalog-rows";
import {
  MACRO_TARGETS_COLUMNS,
  MENU_SELECT,
  ROUTINE_SELECT,
  macroTargetsFromRow,
  menuFromRow,
  routineFromRow,
  type MacroTargetsRow,
  type MenuRow,
  type RoutineRow,
} from "./plan-rows";
import { rowsOf } from "./queries";

/**
 * Lectura de una rutina o de un menú con sus hijos. Las usan también las plantillas al asignarlas.
 * Un plan que no es del entrenador no existe para él: devuelve `null`.
 */
export async function readRoutine(
  client: SupabaseClient,
  trainerId: string,
  routineId: string,
): Promise<Routine | null> {
  const { data, error } = await client
    .from("routines")
    .select(ROUTINE_SELECT)
    .eq("trainer_id", trainerId)
    .eq("id", routineId)
    .maybeSingle();
  raise(error);
  return data ? routineFromRow(data as unknown as RoutineRow) : null;
}

export async function readMenu(
  client: SupabaseClient,
  trainerId: string,
  menuId: string,
): Promise<Menu | null> {
  const { data, error } = await client
    .from("menus")
    .select(MENU_SELECT)
    .eq("trainer_id", trainerId)
    .eq("id", menuId)
    .maybeSingle();
  raise(error);
  return data ? menuFromRow(data as unknown as MenuRow) : null;
}

/** Los ejercicios activos de la biblioteca: lo que una rutina puede prescribir (I3). */
export async function activeLibrary(client: SupabaseClient, trainerId: string) {
  return rowsOf(
    client
      .from("exercises")
      .select(EXERCISE_COLUMNS)
      .eq("trainer_id", trainerId)
      .eq("status", "activo"),
    exerciseFromRow,
  );
}

// Las escrituras de un borrador van por RPC: cabecera, días o comidas y líneas o alimentos se
// guardan en una sola transacción (migración plan_writes).

export function createRoutinePort(client: SupabaseClient): RoutinePort {
  const routinesOf = (trainerId: string, clientId: string) =>
    client
      .from("routines")
      .select(ROUTINE_SELECT)
      .eq("trainer_id", trainerId)
      .eq("client_id", clientId);

  /** Lo que se escribe en una rutina: el cuerpo validado y con sus ejercicios de la biblioteca. */
  const checkedBody = async (trainerId: string, body: RoutineBody): Promise<RoutineBody> => {
    const parsed = routineBodySchema.parse(body);
    assertExercisesInLibrary(parsed, await activeLibrary(client, trainerId));
    return parsed;
  };

  const requireRoutine = async (trainerId: string, routineId: string): Promise<Routine> => {
    const routine = await readRoutine(client, trainerId, routineId);
    if (!routine) throw notFoundError("Rutina");
    return routine;
  };

  return {
    getActiveRoutine: async (trainerId, clientId) => {
      const { data, error } = await routinesOf(trainerId, clientId)
        .eq("status", "activo")
        .maybeSingle();
      raise(error);
      return data ? routineFromRow(data as unknown as RoutineRow) : null;
    },

    listRoutines: async (trainerId, clientId) =>
      rowsOf(
        routinesOf(trainerId, clientId).order("created_at", { ascending: false }),
        (row: RoutineRow) => routineFromRow(row),
      ),

    createRoutine: async (trainerId, clientId, body) => {
      const checked = await checkedBody(trainerId, body);
      const { data, error } = await client.rpc("create_routine_draft", {
        p_client_id: clientId,
        p_body: checked,
      });
      raise(error);
      return requireRoutine(trainerId, data as string);
    },

    updateRoutine: async (trainerId, routineId, body) => {
      await requireRoutine(trainerId, routineId);
      const checked = await checkedBody(trainerId, body);
      const { error } = await client.rpc("replace_routine_draft", {
        p_routine_id: routineId,
        p_body: checked,
      });
      raise(error);
      return requireRoutine(trainerId, routineId);
    },

    reviseRoutine: async (trainerId, routineId, body) => {
      const checked = await checkedBody(trainerId, body);
      const { data, error } = await client.rpc("revise_routine_draft", {
        p_routine_id: routineId,
        p_body: checked,
      });
      raise(error);
      return requireRoutine(trainerId, data as string);
    },

    activateRoutine: async (trainerId, routineId) => {
      const current = await requireRoutine(trainerId, routineId);
      // Una rutina archivada no vuelve: la función solo activa borradores (§7).
      if (current.status === "archivado") {
        throw new DomainError("routine.archived", "Una rutina archivada no se reactiva");
      }
      const { error } = await client.rpc("activate_routine", { p_routine_id: routineId });
      raise(error);
      return requireRoutine(trainerId, routineId);
    },
  };
}

export function createMacroTargetsPort(client: SupabaseClient): MacroTargetsPort {
  return {
    listMacroTargets: async (trainerId, clientId) =>
      rowsOf(
        client
          .from("macro_targets")
          .select(MACRO_TARGETS_COLUMNS)
          .eq("trainer_id", trainerId)
          .eq("client_id", clientId)
          .eq("status", "activo"),
        (row: MacroTargetsRow) => macroTargetsFromRow(row),
      ),

    // Las kcal se guardan tal como las escribe el entrenador (§5). La función archiva el objetivo
    // anterior de ese tipo de día y activa el nuevo.
    setMacroTargets: async (trainerId, clientId, dayType: DayType, macros) => {
      const checked = macrosSchema.parse(macros);
      const { data, error } = await client.rpc("set_macro_targets", {
        p_client_id: clientId,
        p_day_type: dayType,
        p_kcal: checked.kcal,
        p_protein_g: checked.proteinG,
        p_carbs_g: checked.carbsG,
        p_fat_g: checked.fatG,
      });
      raise(error);

      const { data: row, error: readError } = await client
        .from("macro_targets")
        .select(MACRO_TARGETS_COLUMNS)
        .eq("trainer_id", trainerId)
        .eq("id", data as string)
        .maybeSingle();
      raise(readError);
      if (!row) throw notFoundError("Macros");
      return macroTargetsFromRow(row as MacroTargetsRow);
    },
  };
}

export function createMenuPort(client: SupabaseClient): MenuPort {
  const menusOf = (trainerId: string, clientId: string) =>
    client.from("menus").select(MENU_SELECT).eq("trainer_id", trainerId).eq("client_id", clientId);

  const requireMenu = async (trainerId: string, menuId: string): Promise<Menu> => {
    const menu = await readMenu(client, trainerId, menuId);
    if (!menu) throw notFoundError("Menú");
    return menu;
  };

  const checkedBody = (body: MenuBody): MenuBody => menuBodySchema.parse(body);

  return {
    listActiveMenus: async (trainerId, clientId) =>
      rowsOf(menusOf(trainerId, clientId).eq("status", "activo"), (row: MenuRow) =>
        menuFromRow(row),
      ),

    // Los activos y los borradores, no los archivados.
    listMenus: async (trainerId, clientId) =>
      rowsOf(menusOf(trainerId, clientId).in("status", ["borrador", "activo"]), (row: MenuRow) =>
        menuFromRow(row),
      ),

    listArchivedMenus: async (trainerId, clientId) =>
      rowsOf(menusOf(trainerId, clientId).eq("status", "archivado"), (row: MenuRow) =>
        menuFromRow(row),
      ),

    createMenu: async (trainerId, clientId, body) => {
      const { data, error } = await client.rpc("create_menu_draft", {
        p_client_id: clientId,
        p_body: checkedBody(body),
      });
      raise(error);
      return requireMenu(trainerId, data as string);
    },

    updateMenu: async (trainerId, menuId, body) => {
      await requireMenu(trainerId, menuId);
      const { error } = await client.rpc("replace_menu_draft", {
        p_menu_id: menuId,
        p_body: checkedBody(body),
      });
      raise(error);
      return requireMenu(trainerId, menuId);
    },

    reviseMenu: async (trainerId, menuId, body) => {
      const { data, error } = await client.rpc("revise_menu_draft", {
        p_menu_id: menuId,
        p_body: checkedBody(body),
      });
      raise(error);
      return requireMenu(trainerId, data as string);
    },

    // La función archiva el conjunto activo del tipo de día y publica sus borradores; sin borradores
    // falla (menu.no_drafts) y no toca nada.
    activateMenus: async (trainerId, clientId, dayType) => {
      const { error } = await client.rpc("activate_menus", {
        p_client_id: clientId,
        p_day_type: dayType,
      });
      raise(error);
      return rowsOf(
        menusOf(trainerId, clientId).eq("day_type", dayType).eq("status", "activo"),
        (row: MenuRow) => menuFromRow(row),
      );
    },

    archiveMenu: async (trainerId, menuId) => {
      await requireMenu(trainerId, menuId);
      const { error } = await client.rpc("archive_menu", { p_menu_id: menuId });
      raise(error);
    },
  };
}
