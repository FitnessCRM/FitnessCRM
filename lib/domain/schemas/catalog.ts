import { z } from "zod";

/** Ciclo de vida de las entradas de catálogo (§7). Nunca se borran: se archivan (I13). */
export const catalogStatusSchema = z.enum(["activa", "archivada"]);
export type CatalogStatus = z.infer<typeof catalogStatusSchema>;
