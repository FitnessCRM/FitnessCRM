import type { Menu, MenuTemplate, Routine, RoutineTemplate } from "./schemas";

export type NewId = () => string;

interface CloneContext {
  trainerId: string;
  clientId: string;
  newId: NewId;
  now: string;
}

/**
 * Clona una plantilla de rutina en una rutina de cliente en estado `borrador` (§4: copiar, no
 * enlazar). Todos los ids internos son nuevos; el nombre de la plantilla queda congelado.
 */
export function cloneRoutineTemplate(template: RoutineTemplate, ctx: CloneContext): Routine {
  return {
    id: ctx.newId(),
    trainerId: ctx.trainerId,
    clientId: ctx.clientId,
    name: template.name,
    note: template.note,
    days: template.days.map((day) => ({
      id: ctx.newId(),
      dayNumber: day.dayNumber,
      label: day.label,
      exercises: day.exercises.map((ex) => ({
        id: ctx.newId(),
        exerciseId: ex.exerciseId,
        prescription: { ...ex.prescription },
      })),
    })),
    status: "borrador",
    sourceTemplateName: template.name,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

/** Clona cada menú de la plantilla en un menú de cliente en `borrador`. */
export function cloneMenuTemplate(template: MenuTemplate, ctx: CloneContext): Menu[] {
  return template.menus.map((entry) => ({
    id: ctx.newId(),
    trainerId: ctx.trainerId,
    clientId: ctx.clientId,
    name: entry.name,
    dayType: entry.dayType,
    suggested: entry.suggested,
    macros: { ...entry.macros },
    note: entry.note,
    meals: entry.meals.map((meal) => ({
      id: ctx.newId(),
      name: meal.name,
      items: meal.items.map((item) => ({ id: ctx.newId(), name: item.name, grams: item.grams })),
    })),
    status: "borrador",
    sourceTemplateName: template.name,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }));
}
