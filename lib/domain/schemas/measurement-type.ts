import { z } from "zod";
import { catalogStatusSchema } from "./catalog";
import {
  isoTimestampSchema,
  nonEmptyTextSchema,
  nonNegativeIntSchema,
  tenantFields,
} from "./primitives";

/**
 * Tipo de medida del catálogo del entrenador: etiqueta + unidad + orden (I8).
 * Cada tipo declara su unidad; el valor se guarda en ella sin conversiones.
 */
export const measurementTypeSchema = z.object({
  ...tenantFields,
  label: nonEmptyTextSchema,
  unit: nonEmptyTextSchema,
  order: nonNegativeIntSchema,
  status: catalogStatusSchema,
  createdAt: isoTimestampSchema,
});
export type MeasurementType = z.infer<typeof measurementTypeSchema>;
