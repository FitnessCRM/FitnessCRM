import type { Menu, MenuTemplate, Routine, RoutineTemplate } from "@/lib/domain";

export type RoutineTemplateInput = Omit<RoutineTemplate, "id" | "createdAt" | "updatedAt">;
export type MenuTemplateInput = Omit<MenuTemplate, "id" | "createdAt" | "updatedAt">;

/** I32: sustituir el borrador que ya tiene el cliente, después de que el entrenador lo confirme. */
export interface AssignTemplateOptions {
  replaceDraft?: boolean;
}

export interface TemplatePort {
  listRoutineTemplates(trainerId: string): Promise<RoutineTemplate[]>;
  listMenuTemplates(trainerId: string): Promise<MenuTemplate[]>;
  /** Copia la plantilla con ids nuevos y el nombre dado. */
  duplicateRoutineTemplate(
    trainerId: string,
    templateId: string,
    name: string,
  ): Promise<RoutineTemplate>;
  duplicateMenuTemplate(trainerId: string, templateId: string, name: string): Promise<MenuTemplate>;
  saveRoutineTemplate(input: RoutineTemplateInput & { id?: string }): Promise<RoutineTemplate>;
  saveMenuTemplate(input: MenuTemplateInput & { id?: string }): Promise<MenuTemplate>;
  deleteRoutineTemplate(trainerId: string, templateId: string): Promise<void>;
  deleteMenuTemplate(trainerId: string, templateId: string): Promise<void>;
  /**
   * Clona la plantilla en una rutina en borrador del cliente (§4: copiar, no enlazar). Si el cliente
   * ya tiene una rutina en borrador, lanza `plan.draft_exists` (I32), salvo con `replaceDraft`, que
   * la borra y pone la nueva en su lugar.
   */
  assignRoutineTemplate(
    trainerId: string,
    clientId: string,
    templateId: string,
    options?: AssignTemplateOptions,
  ): Promise<Routine>;
  /**
   * Clona cada menú de la plantilla en menús en borrador del cliente. Si ya hay menús en borrador en
   * alguno de los tipos de día de la plantilla, lanza `plan.draft_exists` (I32), salvo con
   * `replaceDraft`, que borra esos borradores.
   */
  assignMenuTemplate(
    trainerId: string,
    clientId: string,
    templateId: string,
    options?: AssignTemplateOptions,
  ): Promise<Menu[]>;
}
