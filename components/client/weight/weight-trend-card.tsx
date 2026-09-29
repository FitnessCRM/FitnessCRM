"use client";

import { TrendChart } from "@/components/charts/trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeeklyWeightPoint } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screens.weight.chart;

/** «Últimas 6 semanas»: un punto por semana del cliente; una semana sin pesaje es un hueco. */
export function WeightTrendCard({ points }: { points: WeeklyWeightPoint[] }) {
  const hasData = points.some((p) => p.weightKg !== null);
  return (
    <Card className="gap-3.5 p-6 py-6">
      <CardHeader className="flex-row items-center justify-between p-0">
        <CardTitle>{t.title}</CardTitle>
        <span className="text-text-subtle text-xs">{t.unit}</span>
      </CardHeader>
      <CardContent className="p-0">
        {hasData ? (
          <TrendChart
            unit={t.unit}
            height={230}
            series={[{ key: "kg", label: t.series }]}
            data={points.map((p) => ({ label: `${t.weekPrefix}${p.week}`, kg: p.weightKg }))}
          />
        ) : (
          <p className="text-text-subtle py-10 text-center text-sm">{t.empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
