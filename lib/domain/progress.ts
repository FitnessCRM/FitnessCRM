import type { MeasurementType, Review } from "./schemas";

export interface MeasurementSeriesPoint {
  week: number;
  /** `null` = esa semana no tiene revisión o la revisión no midió este tipo: hueco, no interpolación. */
  value: number | null;
}

export interface MeasurementSeries {
  typeId: string;
  label: string;
  unit: string;
  /** Archivado en el catálogo (o ya no existe): conserva su histórico, no entra en revisiones nuevas. */
  archived: boolean;
  points: MeasurementSeriesPoint[];
}

/**
 * Una serie por tipo de medida que aparezca en las revisiones del cliente, de `fromWeek` a
 * `toWeek`. Los tipos van en el orden del catálogo; los que ya no están en él, al final.
 * Etiqueta y unidad salen del catálogo si existe y, si no, de la última copia congelada (I12).
 * Series dispersas y de distinta longitud: cada semana sin valor es `null`.
 */
export function measurementSeries(
  reviews: readonly Review[],
  catalog: readonly MeasurementType[],
  fromWeek: number,
  toWeek: number,
): MeasurementSeries[] {
  const seen = new Map<string, { label: string; unit: string }>();
  for (const review of [...reviews].sort((a, b) => a.weekNumber - b.weekNumber)) {
    for (const m of review.measurements)
      seen.set(m.measurementTypeId, { label: m.label, unit: m.unit });
  }
  const order = new Map(catalog.map((t, i) => [t.id, i]));
  const typeIds = [...seen.keys()].sort(
    (a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
  const byWeek = new Map(reviews.map((r) => [r.weekNumber, r]));

  return typeIds.map((typeId) => {
    const type = catalog.find((t) => t.id === typeId);
    const frozen = seen.get(typeId)!;
    const points: MeasurementSeriesPoint[] = [];
    for (let week = Math.max(1, fromWeek); week <= toWeek; week++) {
      const value = byWeek
        .get(week)
        ?.measurements.find((m) => m.measurementTypeId === typeId)?.value;
      points.push({ week, value: value ?? null });
    }
    return {
      typeId,
      label: type?.label ?? frozen.label,
      unit: type?.unit ?? frozen.unit,
      archived: type === undefined || type.status === "archivada",
      points,
    };
  });
}

/** Pareja de semanas a la que pertenece una semana: 1-2, 3-4, 5-6… Presentación pura (§8). */
export function weekPair(week: number): { from: number; to: number } {
  const from = week % 2 === 0 ? week - 1 : week;
  return { from, to: from + 1 };
}

export interface ReviewWeekGroup {
  from: number;
  to: number;
  /** Revisiones de la pareja, semana más reciente primero. */
  reviews: Review[];
}

/** Agrupa el histórico de dos en dos semanas, pareja más reciente primero. */
export function groupReviewsByWeekPair(reviews: readonly Review[]): ReviewWeekGroup[] {
  const groups = new Map<number, ReviewWeekGroup>();
  for (const review of reviews) {
    const pair = weekPair(review.weekNumber);
    const group = groups.get(pair.from) ?? { ...pair, reviews: [] };
    group.reviews.push(review);
    groups.set(pair.from, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, reviews: [...g.reviews].sort((a, b) => b.weekNumber - a.weekNumber) }))
    .sort((a, b) => b.from - a.from);
}
