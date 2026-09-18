import { DomainError } from "@/lib/domain";

/** Aislamiento multi-tenant (I1): todo lo que sale del adaptador se filtra por `trainerId`. */
export function own<T extends { trainerId: string }>(items: T[], trainerId: string): T[] {
  return items.filter((i) => i.trainerId === trainerId);
}

export function findOwn<T extends { id: string; trainerId: string }>(
  items: T[],
  trainerId: string,
  id: string,
  what: string,
): T {
  const found = items.find((i) => i.id === id && i.trainerId === trainerId);
  if (!found) throw new DomainError("not_found", `${what} ${id} no existe`);
  return found;
}

export function replaceById<T extends { id: string }>(items: T[], next: T): T {
  const index = items.findIndex((i) => i.id === next.id);
  if (index === -1) items.push(next);
  else items[index] = next;
  return next;
}

export function removeById<T extends { id: string }>(items: T[], id: string): void {
  const index = items.findIndex((i) => i.id === id);
  if (index !== -1) items.splice(index, 1);
}
