import { describe, expect, it } from "vitest";
import { measurementType, review } from "./__tests__/fixtures";
import { groupReviewsByWeekPair, measurementSeries, weekPair } from "./progress";
import type { BodyMeasurement } from "./schemas";

const bm = (typeId: string, value: number, label = typeId, unit = "cm"): BodyMeasurement => ({
  id: `${typeId}-${value}`,
  measurementTypeId: typeId,
  value,
  label,
  unit,
});

const catalog = [
  measurementType({ id: "mt-cuello", label: "Cuello", order: 0 }),
  measurementType({ id: "mt-cintura", label: "Cintura", order: 1 }),
  measurementType({ id: "mt-cadera", label: "Cadera", order: 2, status: "archivada" }),
];

const reviews = [
  review({
    id: "r1",
    weekNumber: 1,
    measurements: [bm("mt-cintura", 74), bm("mt-cadera", 98), bm("mt-viejo", 10, "Antiguo", "mm")],
  }),
  review({ id: "r2", weekNumber: 2, measurements: [bm("mt-cintura", 73.2)] }),
  // semana 3 saltada
  review({
    id: "r4",
    weekNumber: 4,
    measurements: [bm("mt-cintura", 71.8), bm("mt-cadera", 96.8)],
  }),
];

describe("measurementSeries", () => {
  it("builds one sparse series per type over the week range, with nulls where nothing was measured", () => {
    const series = measurementSeries(reviews, catalog, 1, 5);
    const cintura = series.find((s) => s.typeId === "mt-cintura")!;
    expect(cintura.points.map((p) => p.value)).toEqual([74, 73.2, null, 71.8, null]);
    const cadera = series.find((s) => s.typeId === "mt-cadera")!;
    expect(cadera.points.map((p) => p.value)).toEqual([98, null, null, 96.8, null]);
  });

  it("keeps the history of an archived type and marks it, and orders by catalog", () => {
    const series = measurementSeries(reviews, catalog, 1, 4);
    expect(series.map((s) => s.typeId)).toEqual(["mt-cintura", "mt-cadera", "mt-viejo"]);
    expect(series.find((s) => s.typeId === "mt-cadera")?.archived).toBe(true);
    expect(series.find((s) => s.typeId === "mt-cintura")?.archived).toBe(false);
  });

  it("falls back to the frozen label and unit when the type is gone from the catalog (I12)", () => {
    const viejo = measurementSeries(reviews, catalog, 1, 4).find((s) => s.typeId === "mt-viejo")!;
    expect(viejo).toMatchObject({ label: "Antiguo", unit: "mm", archived: true });
    expect(viejo.points.map((p) => p.value)).toEqual([10, null, null, null]);
  });

  it("omits catalog types never measured and returns nothing without reviews", () => {
    expect(measurementSeries(reviews, catalog, 1, 4).some((s) => s.typeId === "mt-cuello")).toBe(
      false,
    );
    expect(measurementSeries([], catalog, 1, 4)).toEqual([]);
  });
});

describe("week pairs (§8 presentation)", () => {
  it("pairs weeks 1-2, 3-4, 5-6", () => {
    expect(weekPair(1)).toEqual({ from: 1, to: 2 });
    expect(weekPair(2)).toEqual({ from: 1, to: 2 });
    expect(weekPair(5)).toEqual({ from: 5, to: 6 });
  });

  it("groups reviews by pair, most recent first, and leaves skipped weeks without a row", () => {
    const groups = groupReviewsByWeekPair([...reviews, review({ id: "r5", weekNumber: 5 })]);
    expect(groups.map((g) => [g.from, g.to])).toEqual([
      [5, 6],
      [3, 4],
      [1, 2],
    ]);
    expect(groups[1]?.reviews.map((r) => r.weekNumber)).toEqual([4]);
    expect(groups[2]?.reviews.map((r) => r.weekNumber)).toEqual([2, 1]);
  });
});
