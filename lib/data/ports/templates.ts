import type { Menu, MenuTemplate, Routine, RoutineTemplate } from "@/lib/domain";

export type RoutineTemplateInput = Omit<RoutineTemplate, "id" | "createdAt" | "updatedAt">;
export type MenuTemplateInput = Omit<MenuTemplate, "id" | "createdAt" | "updatedAt">;

export interface TemplatePort {
  listRoutineTemplates(trainerId: string): Promise<RoutineTemplate[]>;
  listMenuTemplates(trainerId: string): Promise<MenuTemplate[]>;
  saveRoutineTemplate(input: RoutineTemplateInput & { id?: string }): Promise<RoutineTemplate>;
  saveMenuTemplate(input: MenuTemplateInput & { id?: string }): Promise<MenuTemplate>;
  deleteRoutineTemplate(trainerId: string, templateId: string): Promise<void>;
  deleteMenuTemplate(trainerId: string, templateId: string): Promise<void>;
  /** Clona la plantilla en una rutina en borrador del cliente (§4: copiar, no enlazar). */
  assignRoutineTemplate(trainerId: string, clientId: string, templateId: string): Promise<Routine>;
  /** Clona cada menú de la plantilla en menús en borrador del cliente. */
  assignMenuTemplate(trainerId: string, clientId: string, templateId: string): Promise<Menu[]>;
}
