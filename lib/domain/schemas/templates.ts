import { z } from "zod";
import { menuBodySchema } from "./menu";
import {
  idSchema,
  isoTimestampSchema,
  nonEmptyTextSchema,
  optionalTextSchema,
  tenantFields,
} from "./primitives";
import { routineBodySchema } from "./routine";

/**
 * Plantillas: rutina o menú sin cliente. Se CLONAN al asignar, nunca se enlazan (§4):
 * editar una plantilla no toca el plan de ningún cliente.
 */
export const routineTemplateSchema = routineBodySchema.extend({
  ...tenantFields,
  description: optionalTextSchema,
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type RoutineTemplate = z.infer<typeof routineTemplateSchema>;

/** Un menú dentro de la plantilla (uno o varios por tipo de día). */
export const menuTemplateEntrySchema = menuBodySchema.extend({ id: idSchema });
export type MenuTemplateEntry = z.infer<typeof menuTemplateEntrySchema>;

export const menuTemplateSchema = z.object({
  ...tenantFields,
  name: nonEmptyTextSchema,
  description: optionalTextSchema,
  menus: z.array(menuTemplateEntrySchema),
  createdAt: isoTimestampSchema,
  updatedAt: isoTimestampSchema,
});
export type MenuTemplate = z.infer<typeof menuTemplateSchema>;
