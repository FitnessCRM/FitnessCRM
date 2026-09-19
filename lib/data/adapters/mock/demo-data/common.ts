import { addCivilDays, type CivilDate } from "@/lib/domain";

/** Constantes compartidas por los datos de demo. Extraídas de docs/design/demo-navegable.html. */
export const TRAINER_ID = "t-adrian";
export const CLIENT_IDS = {
  marta: "c-marta",
  jorge: "c-jorge",
  sara: "c-sara",
  david: "c-david",
  lucia: "c-lucia",
} as const;

export const DEMO_TZ = "Europe/Madrid";

/** Timestamp UTC a partir de una fecha civil y una hora. */
export const ts = (date: string, time = "08:00:00"): string => `${date}T${time}Z`;

/**
 * Los datos de demo son relativos a "hoy" para que la maqueta no envejezca: hoy Marta está en
 * la semana 5 (su primer día), Jorge en la 8, Sara en la 3, David en la 11, como en el panel.
 */
export function demoDates(today: CivilDate) {
  const daysAgo = (n: number): CivilDate => addCivilDays(today, -n);
  return {
    today,
    daysAgo,
    daysAhead: (n: number): CivilDate => addCivilDays(today, n),
    yesterday: daysAgo(1),
    martaStart: daysAgo(28),
    jorgeStart: daysAgo(49),
    saraStart: daysAgo(15),
    davidStart: daysAgo(70),
    luciaStart: daysAgo(140),
  };
}
export type DemoDates = ReturnType<typeof demoDates>;
