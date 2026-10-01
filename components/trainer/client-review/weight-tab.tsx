"use client";

import { useMemo, useState } from "react";
import { TrendChart } from "@/components/charts/trend-chart";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CivilDate, Review, WeightLog } from "@/lib/domain";
import { formatDecimal, formatSignedDecimal } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { reviewDate } from "./client-review-screen";

const t = es.screensTrainerReview.weight;

const month = (date: CivilDate) => date.slice(0, 7);
const shiftMonth = (ym: string, by: number) => {
  const [y, m] = ym.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/**
 * Calendario mensual de peso, explorable día a día. Arranca en el mes del peso de la revisión y en
 * el día de ese pesaje; el cliente puede tener a lo sumo un registro por día (I23).
 */
export function WeightTab({
  review,
  logs,
  today,
  stacked = false,
}: {
  review: Review;
  logs: WeightLog[];
  today: CivilDate;
  /** En una columna estrecha, calendario, detalle y tendencia van uno sobre otro. */
  stacked?: boolean;
}) {
  const sorted = useMemo(() => [...logs].sort((a, b) => a.date.localeCompare(b.date)), [logs]);
  const ofReview = sorted.find((l) => l.id === review.weightLogId);
  const anchor = ofReview?.date ?? sorted.at(-1)?.date ?? reviewDate(review) ?? today;

  const [selectedDate, setSelectedDate] = useState<CivilDate | undefined>(
    ofReview?.date ?? sorted.at(-1)?.date,
  );
  const [visible, setVisible] = useState(month(anchor));

  if (sorted.length === 0) return <p className="text-text-subtle text-[13px]">{t.noRecords}</p>;

  const monthLogs = sorted.filter((l) => month(l.date) === visible);
  const byDate = new Map(monthLogs.map((l) => [l.date, l]));
  const selected = sorted.find((l) => l.date === selectedDate);
  const selectedIndex = selected ? sorted.indexOf(selected) : -1;
  const previous = selectedIndex > 0 ? sorted[selectedIndex - 1] : undefined;
  const next = selectedIndex >= 0 ? sorted[selectedIndex + 1] : undefined;

  const select = (log: WeightLog | undefined) => {
    if (!log) return;
    setSelectedDate(log.date);
    setVisible(month(log.date));
  };

  const [y, m] = visible.split("-").map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Lunes primero: `getUTCDay` da 0 para domingo.
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;

  return (
    <div className={cn("grid gap-4", !stacked && "lg:grid-cols-[1fr_340px] lg:items-start")}>
      <Card className="gap-4 px-[22px] py-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.prevMonth}
              onClick={() => setVisible(shiftMonth(visible, -1))}
              className="size-8"
            >
              ‹
            </Button>
            <h2 className="section-title min-w-[10ch] text-center" aria-live="polite">
              {t.months[m - 1]} {y}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t.nextMonth}
              onClick={() => setVisible(shiftMonth(visible, 1))}
              className="size-8"
            >
              ›
            </Button>
          </div>
          <p className="text-text-subtle text-xs">
            {monthLogs.length} {monthLogs.length === 1 ? t.records.one : t.records.other}
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1.5 max-sm:gap-1">
          {t.weekdays.map((d) => (
            <p key={d} className="text-text-subtle py-1 text-center text-[11px] uppercase">
              {d}
            </p>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <span key={`blank-${i}`} aria-hidden />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const date = `${visible}-${String(day).padStart(2, "0")}`;
            const log = byDate.get(date);
            const isSelected = date === selectedDate;
            const base =
              "flex min-h-14 flex-col items-start justify-between rounded-md border px-2 py-1.5 text-left text-[11px] max-sm:px-1";
            if (!log) {
              return (
                <span key={date} className={cn(base, "border-border-subtle text-text-disabled")}>
                  {day}
                </span>
              );
            }
            return (
              <button
                key={date}
                type="button"
                onClick={() => select(log)}
                aria-pressed={isSelected}
                aria-label={`${day} ${t.months[m - 1]}: ${formatDecimal(log.weightKg)} kg`}
                className={cn(
                  base,
                  "focus-visible:ring-ring/50 cursor-pointer outline-none focus-visible:ring-[3px]",
                  isSelected
                    ? "border-accent-outline bg-accent-soft text-accent"
                    : "border-border-strong bg-surface-raised hover:border-border-emphasis",
                )}
              >
                <span>{day}</span>
                <span className="font-display text-[14px] font-bold">
                  {formatDecimal(log.weightKg)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-text-subtle text-xs">{t.hint}</p>
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="border-accent-outline gap-3 px-[22px] py-5">
          <p className="text-text-subtle tracking-label font-display text-[12px] uppercase">
            {t.selectedDay}
          </p>
          {selected ? (
            <>
              <h3 className="font-display text-[26px] leading-none font-bold uppercase">
                <time dateTime={selected.date}>
                  {Number(selected.date.slice(8))} {t.months[Number(selected.date.slice(5, 7)) - 1]}
                </time>
              </h3>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-[44px] leading-none font-bold">
                  {formatDecimal(selected.weightKg)}{" "}
                  <span className="text-text-muted text-sm font-normal">{t.kg}</span>
                </p>
                {previous ? (
                  <p className="text-text-muted text-xs">
                    <span className="font-display text-[18px] font-bold">
                      {formatSignedDecimal(
                        Math.round((selected.weightKg - previous.weightKg) * 10) / 10,
                      )}
                    </span>{" "}
                    {t.versus} {Number(previous.date.slice(8))}{" "}
                    {t.months[Number(previous.date.slice(5, 7)) - 1]!.slice(0, 3).toLowerCase()}
                  </p>
                ) : null}
              </div>
              {selected.note ? (
                <p className="text-text-muted text-[13px]">
                  {t.note}: «{selected.note}»
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 *:min-w-0">
                <Button
                  variant="outline"
                  disabled={!previous}
                  onClick={() => select(previous)}
                  className="h-auto min-h-10 px-2 py-2 leading-tight whitespace-normal"
                >
                  ‹ {t.prevRecord}
                </Button>
                <Button
                  variant="outline"
                  disabled={!next}
                  onClick={() => select(next)}
                  className="h-auto min-h-10 px-2 py-2 leading-tight whitespace-normal"
                >
                  {t.nextRecord} ›
                </Button>
              </div>
            </>
          ) : (
            <p className="text-text-subtle text-[13px]">{t.hint}</p>
          )}
        </Card>

        <Card className="gap-3 px-[22px] py-5">
          <h3 className="section-title">{t.trend}</h3>
          {monthLogs.length === 0 ? (
            <p className="text-text-subtle text-[13px]">{t.noMonthRecords}</p>
          ) : (
            <TrendChart
              height={140}
              unit="kg"
              series={[{ key: "kg", label: es.charts.weight.series }]}
              data={monthLogs.map((l) => ({
                label: String(Number(l.date.slice(8))),
                kg: l.weightKg,
              }))}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
