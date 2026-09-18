import { z } from "zod";

/** Ciclo de vida compartido por rutina, macros y menú (§7). Asignar uno nuevo archiva el anterior. */
export const planStatusSchema = z.enum(["borrador", "activo", "archivado"]);
export type PlanStatus = z.infer<typeof planStatusSchema>;

/** Tipo de día al que se aplican macros y menús. */
export const dayTypeSchema = z.enum(["entrenamiento", "descanso"]);
export type DayType = z.infer<typeof dayTypeSchema>;
