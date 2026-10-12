import { TZDate } from "@date-fns/tz";
import type { CivilDate, IsoTimestamp, TimeZone } from "@/lib/domain";

/** Reloj de la siembra: la zona del entrenador y el instante de la ejecución. */
export interface SeedClock {
  timeZone: TimeZone;
  /** Instante de la ejecución, en UTC ISO. Ninguna marca de tiempo sembrada es posterior. */
  now: IsoTimestamp;
}

/**
 * El instante en que, en la zona del entrenador, son las `time` (`HH:mm`) del día `date`. Se
 * construye en esa zona y no con una `Z` pegada a la fecha: a las 08:00 UTC en Honolulu todavía es
 * el día anterior, y la fecha civil de una marca de tiempo tiene que ser la del dato que acompaña.
 * Lo que caería en el futuro —algo de «hoy» sembrado de madrugada— se queda en `now`.
 */
export function at(clock: SeedClock, date: CivilDate, time: string, plusMinutes = 0): IsoTimestamp {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const instant = new TZDate(y, m - 1, d, hh, mm, 0, clock.timeZone).getTime();
  const iso = new Date(instant + plusMinutes * 60_000).toISOString();
  return iso > clock.now ? clock.now : iso;
}

/**
 * Generador determinista (mulberry32). La siembra no usa `Math.random`: repetirla tiene que dar
 * exactamente los mismos pesajes y las mismas series.
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
