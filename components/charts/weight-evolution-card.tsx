"use client";

import { TrendChart } from "./trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeeklyWeightPoint } from "@/lib/domain";
import { formatSignedDecimal } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.charts.weight;

/**
 * Todas las semanas del cliente y el delta desde el primer pesaje, sin color. La usan el área de
 * cliente y la del entrenador, que la titula a su manera.
 */
export function WeightEvolutionCard({
  points,
  changeSinceStart,
  title = t.title,
}: {
  points: WeeklyWeightPoint[];
  changeSinceStart: number | null;
  title?: string;
}) {
  const hasData = points.some((p) => p.weightKg !== null);
  return (
    <Card className="gap-3 p-6 py-6">
      <CardHeader className="flex-row items-center justify-between p-0">
        <CardTitle>{title}</CardTitle>
        {changeSinceStart !== null ? (
          <span className="font-display text-[20px] font-semibold">
            {formatSignedDecimal(changeSinceStart)} {t.unit}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {hasData ? (
          <TrendChart
            unit={t.unit}
            height={200}
            series={[{ key: "kg", label: t.series }]}
            data={points.map((p) => ({ label: `S${p.week}`, kg: p.weightKg }))}
          />
        ) : (
          <p className="text-text-subtle py-8 text-center text-sm">{t.empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
