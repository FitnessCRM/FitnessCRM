import { DAY_TYPES } from "./schemas";
import type { DayType, Menu, MenuTemplateEntry } from "./schemas";

export type MenuOp =
  | { type: "create"; body: MenuBody }
  | { type: "update"; id: string; body: MenuBody }
  | { type: "archive"; id: string };

type MenuBody = Omit<MenuTemplateEntry, "id">;

export interface MenuPublishPlan {
  ops: MenuOp[];
  /** Tipos de día con menús en borrador tras aplicar `ops`: hay que publicarlos (§7). */
  activate: DayType[];
}

function bodyOf(entry: MenuTemplateEntry): MenuBody {
  const body: Partial<MenuTemplateEntry> = { ...entry };
  delete body.id;
  return body as MenuBody;
}

/**
 * Traduce lo que el entrenador deja en el editor de menús a operaciones sobre los menús del cliente
 * (`current`: los activos y los borradores). Publicar un tipo de día archiva sus menús activos
 * (I4), así que si un tipo de día tiene borradores, los activos que se conservan se vuelven a crear
 * como borrador y se archiva el original: el resultado es que todo lo del editor queda activo y
 * nada se pierde por el camino. Lo que se quitó del editor se archiva.
 */
export function planMenuPublish(
  current: readonly Menu[],
  next: readonly MenuTemplateEntry[],
): MenuPublishPlan {
  const byId = new Map(current.map((m) => [m.id, m]));
  const kept = next.map((entry) => ({ entry, existing: byId.get(entry.id) }));

  const hasDraft = (dayType: DayType) =>
    kept.some(({ entry, existing }) => entry.dayType === dayType && existing?.status !== "activo");
  const activate = DAY_TYPES.filter(hasDraft);

  const ops: MenuOp[] = [];
  const nextIds = new Set(next.map((m) => m.id));
  for (const menu of current) {
    if (!nextIds.has(menu.id)) ops.push({ type: "archive", id: menu.id });
  }
  for (const { entry, existing } of kept) {
    const body = bodyOf(entry);
    if (!existing) {
      ops.push({ type: "create", body });
    } else if (existing.status === "activo" && activate.includes(entry.dayType)) {
      // Se republica: copia como borrador y el original se archiva.
      ops.push({ type: "create", body }, { type: "archive", id: existing.id });
    } else {
      ops.push({ type: "update", id: existing.id, body });
    }
  }
  return { ops, activate };
}
