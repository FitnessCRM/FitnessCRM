"use client";

import { useState } from "react";
import { TrendChart, type TrendPoint } from "./trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tokens } from "@/lib/design/tokens";
import type { MeasurementSeries } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.charts.measurements;
const DEFAULT_VISIBLE = 3;

/**
 * Primera gráfica multi-serie: una línea por tipo de medida, con selector como en la demo.
 * Un tipo archivado conserva su serie (marcado «archivado»); las series son dispersas y de
 * distinta longitud, y un hueco se pinta como hueco.
 */
export function MeasurementsCard({
  series,
  title = t.title,
  emptyAction,
}: {
  series: MeasurementSeries[];
  title?: string;
  /** Lo que se ofrece bajo el vacío; cada área pone el suyo (el panel, el camino a Asignación). */
  emptyAction?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(series.slice(0, DEFAULT_VISIBLE).map((s) => s.typeId)),
  );
  const toggle = (typeId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });

  const visible = series.filter((s) => selected.has(s.typeId));
  const weeks = series[0]?.points.map((p) => p.week) ?? [];
  const data: TrendPoint[] = weeks.map((week, i) => ({
    label: `${es.common.weekShort}${week}`,
    ...Object.fromEntries(visible.map((s) => [s.typeId, s.points[i]?.value ?? null])),
  }));

  return (
    <Card className="gap-3 p-6 py-6">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 p-0">
        <CardTitle>{title}</CardTitle>
        {series.length ? (
          <div
            role="group"
            aria-label={t.hint}
            className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs"
          >
            {series.map((s, i) => {
              const on = selected.has(s.typeId);
              return (
                <button
                  key={s.typeId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s.typeId)}
                  className={cn(
                    // 32 px de alto: medían 15 y en el móvil se tocan con el dedo.
                    "focus-visible:ring-ring/50 flex min-h-8 items-center gap-1.5 rounded-sm px-2 transition-colors outline-none focus-visible:ring-[3px]",
                    on ? "text-text-primary" : "text-text-subtle hover:text-text-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className="h-[3px] w-2.5"
                    style={{
                      background: on
                        ? tokens.chart.series[i % tokens.chart.series.length]
                        : "transparent",
                      outline: on ? "none" : `1px solid ${tokens.color.textSubtle}`,
                    }}
                  />
                  {s.label}
                  {s.archived ? <span className="text-text-disabled">· {t.archived}</span> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {series.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm">
            <p className="text-text-subtle">{t.empty}</p>
            {emptyAction}
          </div>
        ) : visible.length === 0 ? (
          <p className="text-text-subtle py-8 text-center text-sm">{t.noneSelected}</p>
        ) : (
          <TrendChart
            height={180}
            data={data}
            series={visible.map((s) => ({
              key: s.typeId,
              label: `${s.label} (${s.unit})`,
              colorIndex: series.indexOf(s) % tokens.chart.series.length,
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
