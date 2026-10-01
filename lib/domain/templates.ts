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

interface DuplicateContext {
  newId: NewId;
  now: string;
  /** Nombre de la copia: lo decide quien llama, porque el sufijo es texto de interfaz. */
  name: string;
}

/** Copia una plantilla de rutina como plantilla nueva: ids nuevos y ningún vínculo con la original. */
export function duplicateRoutineTemplate(
  template: RoutineTemplate,
  ctx: DuplicateContext,
): RoutineTemplate {
  return {
    ...template,
    id: ctx.newId(),
    name: ctx.name,
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
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

/** Copia una plantilla de menú como plantilla nueva, con todos sus menús, comidas y alimentos. */
export function duplicateMenuTemplate(template: MenuTemplate, ctx: DuplicateContext): MenuTemplate {
  return {
    ...template,
    id: ctx.newId(),
    name: ctx.name,
    menus: template.menus.map((entry) => ({
      ...entry,
      id: ctx.newId(),
      macros: { ...entry.macros },
      meals: entry.meals.map((meal) => ({
        id: ctx.newId(),
        name: meal.name,
        items: meal.items.map((item) => ({ id: ctx.newId(), name: item.name, grams: item.grams })),
      })),
    })),
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

/** Cuántos ejercicios prescribe una plantilla de rutina, sumando todos los días. */
export function countTemplateExercises(template: RoutineTemplate): number {
  return template.days.reduce((total, day) => total + day.exercises.length, 0);
}

/** Cuántos tipos de día distintos cubre una plantilla de menú. */
export function countTemplateDayTypes(template: MenuTemplate): number {
  return new Set(template.menus.map((m) => m.dayType)).size;
}

/** Mueve un elemento una posición arriba (`-1`) o abajo (`1`). Fuera de rango no hace nada. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/** Numera los días 1..n según su orden: «Día 1, Día 2…», sin huecos ni repetidos. */
export function renumberDays<T extends { dayNumber: number }>(days: readonly T[]): T[] {
  return days.map((day, i) => ({ ...day, dayNumber: i + 1 }));
}

/**
 * Marca un menú como sugerido de su tipo de día y desmarca los demás de ese tipo (§3: uno por
 * tipo). Los de otro tipo de día no se tocan.
 */
export function setSuggestedMenu<T extends { id: string; dayType: string; suggested: boolean }>(
  menus: readonly T[],
  menuId: string,
): T[] {
  const chosen = menus.find((m) => m.id === menuId);
  if (!chosen) return [...menus];
  return menus.map((m) =>
    m.dayType === chosen.dayType ? { ...m, suggested: m.id === menuId } : m,
  );
}
