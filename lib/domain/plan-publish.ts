import { DAY_TYPES } from "./schemas";
import type { DayType, Menu, MenuTemplateEntry, Routine } from "./schemas";

/* ---------- Rutina: qué hace «Publicar cambios» (§7) ---------- */

export type RoutinePublishOp =
  { type: "create" } | { type: "update"; id: string } | { type: "revise"; id: string };

/**
 * Qué se publica en la rutina del cliente. Un borrador se edita en sitio; una rutina activa nunca:
 * publicar cambios sobre ella crea una versión nueva y, al activarla, la anterior se archiva (§7).
 * Si hay borrador, manda el borrador aunque haya una activa: si una publicación anterior se quedó
 * a medias (versión creada pero sin activar), volver a publicar reutiliza ese borrador y no crea
 * otro.
 */
export function routinePublishOp(
  routines: readonly Pick<Routine, "id" | "status">[],
): RoutinePublishOp {
  const draft = routines.find((r) => r.status === "borrador");
  if (draft) return { type: "update", id: draft.id };
  const active = routines.find((r) => r.status === "activo");
  if (active) return { type: "revise", id: active.id };
  return { type: "create" };
}

/* ---------- Menús: el conjunto de un tipo de día (§7, I4) ---------- */

export type MenuOp =
  | { type: "create"; body: MenuBody }
  | { type: "update"; id: string; body: MenuBody }
  | { type: "revise"; id: string; body: MenuBody }
  | { type: "archive"; id: string };

type MenuBody = Omit<MenuTemplateEntry, "id">;

export interface MenuPublishPlan {
  ops: MenuOp[];
  /** Tipos de día cuyo conjunto cambia: tras aplicar `ops` hay que activarlos (§7). */
  activate: DayType[];
}

function bodyOf(entry: MenuTemplateEntry): MenuBody {
  const body: Partial<MenuTemplateEntry> = { ...entry };
  delete body.id;
  return body as MenuBody;
}

function sameBody(entry: MenuTemplateEntry, menu: Menu): boolean {
  const current: MenuTemplateEntry = {
    id: menu.id,
    name: menu.name,
    dayType: menu.dayType,
    suggested: menu.suggested,
    macros: menu.macros,
    meals: menu.meals,
    note: menu.note,
  };
  return JSON.stringify(bodyOf(entry)) === JSON.stringify(bodyOf(current));
}

/**
 * Traduce lo que el entrenador deja en el editor de menús a operaciones sobre los menús del cliente
 * (`current`: los activos y los borradores). Los menús activos de un tipo de día forman un conjunto
 * y nunca se editan en sitio (§7): si algo cambia en un tipo de día —un menú nuevo, uno quitado, uno
 * editado o un borrador pendiente—, cada activo que se conserva se revisa a una versión nueva en
 * borrador, los borradores se editan en sitio y, al activar el tipo de día, todo el conjunto activo
 * anterior se archiva. Un tipo de día sin cambios no se toca. Lo que se quitó del editor se archiva.
 */
export function planMenuPublish(
  current: readonly Menu[],
  next: readonly MenuTemplateEntry[],
): MenuPublishPlan {
  // Un menú se conserva si sigue en el editor y en su mismo tipo de día. Si cambió de tipo de día,
  // cuenta como quitado de uno y creado en el otro: cada conjunto se versiona por su lado.
  const kept = new Map<string, Menu>();
  for (const entry of next) {
    const existing = current.find((m) => m.id === entry.id);
    if (existing && existing.dayType === entry.dayType) kept.set(entry.id, existing);
  }

  const changed = (dayType: DayType) =>
    current.some((m) => m.dayType === dayType && (m.status !== "activo" || !kept.has(m.id))) ||
    next.some((entry) => {
      if (entry.dayType !== dayType) return false;
      const existing = kept.get(entry.id);
      return !existing || !sameBody(entry, existing);
    });
  const touched = DAY_TYPES.filter(changed);

  const ops: MenuOp[] = [];
  for (const menu of current) {
    if (!kept.has(menu.id)) ops.push({ type: "archive", id: menu.id });
  }
  for (const entry of next) {
    if (!touched.includes(entry.dayType)) continue;
    const existing = kept.get(entry.id);
    const body = bodyOf(entry);
    if (!existing) ops.push({ type: "create", body });
    else if (existing.status === "activo") ops.push({ type: "revise", id: existing.id, body });
    else ops.push({ type: "update", id: existing.id, body });
  }
  // Activar un tipo de día exige borradores: si se quedó vacío, basta con archivar lo quitado.
  const activate = touched.filter((dayType) => next.some((entry) => entry.dayType === dayType));
  return { ops, activate };
}
