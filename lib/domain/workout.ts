import type { CivilDate, Routine, RoutineDay, WorkoutLog } from "./schemas";

/** Orden cronológico de registro: fecha civil y, a igualdad, el creado más tarde. */
function newestFirst(a: WorkoutLog, b: WorkoutLog): number {
  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
}

function dayExerciseIds(day: RoutineDay): Set<string> {
  return new Set(day.exercises.map((e) => e.id));
}

/**
 * Día que se abre por defecto: el siguiente al último día con registros, en el orden de la
 * rutina y volviendo al primero tras el último. Sin registros, el primero.
 *
 * Los días numéricos no tienen ancla de calendario: esto no dice qué toca "hoy", solo continúa
 * donde el cliente lo dejó. Un cliente que nunca registre verá siempre el primer día.
 */
export function defaultRoutineDay(
  routine: Pick<Routine, "days">,
  logs: readonly WorkoutLog[],
): RoutineDay | undefined {
  const { days } = routine;
  const first = days[0];
  if (!first) return undefined;
  for (const log of [...logs].sort(newestFirst)) {
    const index = days.findIndex((d) => dayExerciseIds(d).has(log.routineDayExerciseId));
    if (index !== -1) return days[(index + 1) % days.length];
  }
  return first;
}

/** Registros de un día de rutina en una fecha concreta. */
export interface DayRecord {
  /** Fecha del registro, o `null` si no hay ninguno. */
  date: CivilDate | null;
  /** Series registradas en esa fecha, una por ejercicio prescrito y número de serie. */
  logs: WorkoutLog[];
  /** Series prescritas en el día. */
  totalSets: number;
  /** Cuántas de las prescritas tienen registro en esa fecha. */
  loggedSets: number;
}

function recordOf(day: RoutineDay, own: WorkoutLog[], date: CivilDate | null): DayRecord {
  const totalSets = day.exercises.reduce((sum, e) => sum + e.prescription.sets, 0);
  if (date === null) return { date, logs: [], totalSets, loggedSets: 0 };

  const onDate = own.filter((l) => l.date === date).sort((a, b) => -newestFirst(a, b));
  const bySet = new Map<string, WorkoutLog>();
  for (const log of onDate) bySet.set(`${log.routineDayExerciseId}#${log.setNumber}`, log);
  const unique = [...bySet.values()];

  const setsOf = new Map(day.exercises.map((e) => [e.id, e.prescription.sets]));
  const loggedSets = unique.filter(
    (l) => l.setNumber <= (setsOf.get(l.routineDayExerciseId) ?? 0),
  ).length;
  return { date, logs: unique, totalSets, loggedSets };
}

function dayLogs(day: RoutineDay, logs: readonly WorkoutLog[]): WorkoutLog[] {
  const ids = dayExerciseIds(day);
  return logs.filter((l) => ids.has(l.routineDayExerciseId));
}

/**
 * Registros del día en una fecha exacta. Es lo que la pantalla de rutina deja escribir: desde
 * ahí solo se toca el día en curso, nunca el histórico.
 */
export function dayRecordOn(
  day: RoutineDay,
  logs: readonly WorkoutLog[],
  date: CivilDate,
): DayRecord {
  return recordOf(day, dayLogs(day, logs), date);
}

/**
 * Registros del día en su fecha de registro más reciente, opcionalmente anterior a `before`.
 * Alimenta la referencia de solo lectura ("última vez"), no la rejilla editable. Una serie por
 * encima de las prescritas (la prescripción bajó después de registrar) se devuelve pero no suma.
 */
export function latestDayRecord(
  day: RoutineDay,
  logs: readonly WorkoutLog[],
  options: { before?: CivilDate } = {},
): DayRecord {
  const own = dayLogs(day, logs).filter(
    (l) => options.before === undefined || l.date < options.before,
  );
  const date = own.reduce<CivilDate | null>(
    (latest, l) => (latest === null || l.date > latest ? l.date : latest),
    null,
  );
  return recordOf(day, own, date);
}

/** Un día en el que el cliente registró series, con cuántas. */
export interface WorkoutDate {
  date: CivilDate;
  sets: number;
}

/**
 * Fechas con registros, de la más reciente a la más antigua, con su número de series. Cuenta una
 * serie por línea prescrita y número, como `dayRecordOn`: guardar dos veces la misma no suma.
 */
export function workoutDates(logs: readonly WorkoutLog[], limit?: number): WorkoutDate[] {
  const seen = new Set<string>();
  const counts = new Map<CivilDate, number>();
  for (const log of logs) {
    const key = `${log.date}#${log.routineDayExerciseId}#${log.setNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts.set(log.date, (counts.get(log.date) ?? 0) + 1);
  }
  const dates = [...counts]
    .map(([date, sets]) => ({ date, sets }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return limit === undefined ? dates : dates.slice(0, limit);
}
