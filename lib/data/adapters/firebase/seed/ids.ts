/**
 * Ids de la siembra. Todos empiezan por `seed-`: es lo que distingue un documento sembrado de uno
 * que el entrenador o sus clientes crearon después, y lo que permite repetir la siembra sin duplicar.
 */
export const SEED_PREFIX = "seed-";

export const isSeedId = (id: string): boolean => id.startsWith(SEED_PREFIX);

/** `Pechuga de pollo` → `pechuga-de-pollo`. Solo para componer ids legibles. */
export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * El `newId` que piden las funciones del dominio (`cloneRoutineTemplate`, `recordMeasurement`…),
 * como contador con prefijo: la misma llamada da siempre los mismos ids, así que clonar dos veces la
 * misma plantilla cae sobre los mismos documentos.
 */
export function sequence(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
