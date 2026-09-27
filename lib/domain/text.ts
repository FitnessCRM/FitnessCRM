/**
 * Cotejo de texto libre escrito a mano. Los catálogos del entrenador (grupo y material de un
 * ejercicio, y mañana etiquetas de medidas) son campos libres: sin esto, «pierna», «Pierna» y
 * «PIERNA» se convierten en tres valores distintos y, como los filtros se derivan de los datos,
 * en tres filtros distintos.
 */

/** Forma comparable: sin espacios de sobra, en minúsculas y sin tildes ni diéresis. */
export function foldText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/**
 * Devuelve la grafía ya existente cuando el texto escrito coincide con ella al cotejar, y el
 * texto recortado cuando es nuevo. No corrige singulares ni plurales: «Piernas» sigue siendo un
 * valor distinto de «Pierna», porque eso ya sería decidir por el entrenador.
 */
export function canonicalText(value: string, known: readonly string[]): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed === "") return "";
  const folded = foldText(trimmed);
  return known.find((candidate) => foldText(candidate) === folded) ?? trimmed;
}
