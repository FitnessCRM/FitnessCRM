import type { Menu, MenuTemplate, Routine, RoutineTemplate } from "@/lib/domain";

export type RoutineTemplateInput = Omit<RoutineTemplate, "id" | "createdAt" | "updatedAt">;
export type MenuTemplateInput = Omit<MenuTemplate, "id" | "createdAt" | "updatedAt">;

/**
 * Modelo de lectura: la plantilla más cuántos clientes han recibido una copia suya. Es un dato
 * derivado (se cuenta sobre los planes cuyo `sourceTemplateName` coincide), no un campo del dominio:
 * la plantilla no sabe quién la usa, que es lo que significa clonar y no enlazar (§4).
 */
export type RoutineTemplateSummary = RoutineTemplate & { usageCount: number };
export type MenuTemplateSummary = MenuTemplate & { usageCount: number };

export interface TemplatePort {
  listRoutineTemplates(trainerId: string): Promise<RoutineTemplateSummary[]>;
  listMenuTemplates(trainerId: string): Promise<MenuTemplateSummary[]>;
  /** Copia la plantilla con ids nuevos y el nombre dado. La copia empieza con 0 usos. */
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
  /** Clona la plantilla en una rutina en borrador del cliente (§4: copiar, no enlazar). */
  assignRoutineTemplate(trainerId: string, clientId: string, templateId: string): Promise<Routine>;
  /** Clona cada menú de la plantilla en menús en borrador del cliente. */
  assignMenuTemplate(trainerId: string, clientId: string, templateId: string): Promise<Menu[]>;
}
