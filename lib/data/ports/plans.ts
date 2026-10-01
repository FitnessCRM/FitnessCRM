import type {
  DayType,
  MacroTargets,
  Macros,
  Menu,
  MenuBody,
  Routine,
  RoutineBody,
} from "@/lib/domain";

/**
 * Rutina, macros y menú del cliente. Asignar uno nuevo archiva el anterior (§7) y garantiza I4:
 * como máximo una rutina activa, unas macros por tipo de día y un menú activo por tipo de día.
 */
export interface RoutinePort {
  getActiveRoutine(trainerId: string, clientId: string): Promise<Routine | null>;
  listRoutines(trainerId: string, clientId: string): Promise<Routine[]>;
  /** Crea una rutina en borrador desde cero. */
  createRoutine(trainerId: string, clientId: string, body: RoutineBody): Promise<Routine>;
  updateRoutine(trainerId: string, routineId: string, body: RoutineBody): Promise<Routine>;
  /** Publica: la rutina pasa a `activo` y la activa anterior a `archivado`. */
  activateRoutine(trainerId: string, routineId: string): Promise<Routine>;
}

export interface MacroTargetsPort {
  /** Objetivos activos del cliente, uno por tipo de día como máximo. */
  listMacroTargets(trainerId: string, clientId: string): Promise<MacroTargets[]>;
  /** Fija los macros de un tipo de día: archiva los anteriores de ese tipo y activa los nuevos. */
  setMacroTargets(
    trainerId: string,
    clientId: string,
    dayType: DayType,
    macros: Macros,
  ): Promise<MacroTargets>;
}

export interface MenuPort {
  /** Menús activos del cliente (varios por tipo de día; uno sugerido). */
  listActiveMenus(trainerId: string, clientId: string): Promise<Menu[]>;
  /** Menús del cliente que se pueden editar: los activos y los borradores, no los archivados. */
  listMenus(trainerId: string, clientId: string): Promise<Menu[]>;
  createMenu(trainerId: string, clientId: string, body: MenuBody): Promise<Menu>;
  updateMenu(trainerId: string, menuId: string, body: MenuBody): Promise<Menu>;
  /** Publica los menús en borrador de un tipo de día y archiva los activos de ese tipo. */
  activateMenus(trainerId: string, clientId: string, dayType: DayType): Promise<Menu[]>;
  archiveMenu(trainerId: string, menuId: string): Promise<void>;
}
