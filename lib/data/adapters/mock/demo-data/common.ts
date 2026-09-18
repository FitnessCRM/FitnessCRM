/** Constantes compartidas por los datos de demo. Extraídas de docs/design/demo-navegable.html. */
export const TRAINER_ID = "t-adrian";
export const CLIENT_IDS = {
  marta: "c-marta",
  jorge: "c-jorge",
  sara: "c-sara",
  david: "c-david",
  lucia: "c-lucia",
} as const;

/** "Hoy" en la demo: viernes 29 de agosto de 2026 según la maqueta. */
export const DEMO_TODAY = "2026-08-29";
export const DEMO_TZ = "Europe/Madrid";

/** Timestamp UTC a partir de una fecha civil y una hora. */
export const ts = (date: string, time = "08:00:00"): string => `${date}T${time}Z`;
