import type { MeasurementType } from "./schemas";

/**
 * I26: la unidad de un tipo de medida es inmutable desde la primera medida registrada de ese tipo,
 * igual que el formato de una pregunta (I15) y con el mismo criterio: cuenta cualquier revisión
 * que la tenga, borradores incluidos. Para cambiarla se archiva el tipo y se crea otro. La etiqueta
 * se edita siempre.
 */
export function canUpdateMeasurementType(
  type: Pick<MeasurementType, "unit">,
  next: Pick<MeasurementType, "label" | "unit">,
  hasMeasurements: boolean,
): boolean {
  return next.unit === type.unit || !hasMeasurements;
}
