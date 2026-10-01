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
 * Rutina, macros y menú del cliente (§7, I4): como máximo una rutina activa y unas macros por tipo
 * de día; de los menús, un conjunto activo por tipo de día. Lo activo nunca se edita en sitio:
 * publicar cambios crea una versión nueva en borrador (`revise*`) y activarla archiva la anterior.
 */
export interface RoutinePort {
  getActiveRoutine(trainerId: string, clientId: string): Promise<Routine | null>;
  listRoutines(trainerId: string, clientId: string): Promise<Routine[]>;
  /** Crea una rutina en borrador desde cero. */
  createRoutine(trainerId: string, clientId: string, body: RoutineBody): Promise<Routine>;
  /** Edita en sitio un borrador. Lanza `routine.not_draft` sobre una activa o archivada (§7). */
  updateRoutine(trainerId: string, routineId: string, body: RoutineBody): Promise<Routine>;
  /**
   * Versión nueva de la rutina activa: un borrador con `body` que conserva `sourceTemplateName`.
   * La activa no cambia hasta que se active el borrador. Los ids de días y ejercicios prescritos
   * que vienen en `body` se conservan: son los que dan continuidad a cada línea entre versiones.
   */
  reviseRoutine(trainerId: string, routineId: string, body: RoutineBody): Promise<Routine>;
  /** Publica: la rutina pasa a `activo` y la activa anterior a `archivado`. */
  activateRoutine(trainerId: string, routineId: string): Promise<Routine>;
}

export interface MacroTargetsPort {
  /** Objetivos activos del cliente, uno por tipo de día como máximo. */
  listMacroTargets(trainerId: string, clientId: string): Promise<MacroTargets[]>;
  /**
   * Fija kcal y macros de un tipo de día tal como los escribe el entrenador: las kcal se guardan,
   * no se derivan ni se comprueban con 4/4/9 (§5). Archiva los anteriores de ese tipo y activa los nuevos.
   */
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
  /** Edita en sitio un borrador. Lanza `menu.not_draft` sobre uno activo o archivado (§7). */
  updateMenu(trainerId: string, menuId: string, body: MenuBody): Promise<Menu>;
  /** Versión nueva de un menú activo: un borrador con `body` que conserva `sourceTemplateName`. */
  reviseMenu(trainerId: string, menuId: string, body: MenuBody): Promise<Menu>;
  /** Publica los menús en borrador de un tipo de día y archiva todo el conjunto activo de ese tipo. */
  activateMenus(trainerId: string, clientId: string, dayType: DayType): Promise<Menu[]>;
  archiveMenu(trainerId: string, menuId: string): Promise<void>;
}
