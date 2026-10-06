"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.calendar;

/** Fecha civil `YYYY-MM-DD`. Todo se calcula en UTC: un día civil no depende de la zona horaria. */
type CivilDate = string;

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (year: number, month: number, day: number): CivilDate =>
  `${year}-${pad(month)}-${pad(day)}`;

/**
 * Calendario mensual para elegir un periodo: un primer toque marca el día de inicio y un segundo el
 * último; un tercero empieza de nuevo. Con un solo toque el periodo es ese día. Semana desde el
 * lunes. `max` bloquea los días posteriores (no hay planes futuros que consultar).
 */
export function RangeCalendar({
  start,
  end,
  onChange,
  max,
  initialMonth,
}: {
  start: CivilDate | null;
  /** `null` mientras solo hay inicio. */
  end: CivilDate | null;
  onChange: (range: { start: CivilDate; end: CivilDate | null }) => void;
  max?: CivilDate;
  /** Mes que se enseña al abrir, `YYYY-MM-DD` (se usa su año y su mes). Por defecto, el de `start`. */
  initialMonth?: CivilDate;
}) {
  const seed = initialMonth ?? start ?? max ?? "2026-01-01";
  const [year, setYear] = useState(Number(seed.slice(0, 4)));
  const [month, setMonth] = useState(Number(seed.slice(5, 7)));

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // 0 = lunes. `getUTCDay` da 0 para domingo.
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const rangeEnd = end ?? start;

  const move = (delta: -1 | 1) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
  };

  const pick = (date: CivilDate) => {
    if (start === null || end !== null) onChange({ start: date, end: null });
    else if (date < start) onChange({ start: date, end: null });
    else onChange({ start, end: date });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label={t.previousMonth}
          className="text-text-muted hover:text-text-primary focus-visible:ring-ring/50 grid size-10 place-items-center rounded-md outline-none focus-visible:ring-[3px]"
        >
          <ChevronLeftIcon aria-hidden className="size-4" />
        </button>
        <p aria-live="polite" className="text-[15px] font-semibold">
          {t.months[month - 1]} {year}
        </p>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label={t.nextMonth}
          className="text-text-muted hover:text-text-primary focus-visible:ring-ring/50 grid size-10 place-items-center rounded-md outline-none focus-visible:ring-[3px]"
        >
          <ChevronRightIcon aria-hidden className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {t.weekdays.map((d) => (
          <p key={d} className="text-text-subtle py-1 text-center text-[11px] uppercase">
            {d}
          </p>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} aria-hidden />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const date = toDate(year, month, day);
          const disabled = max !== undefined && date > max;
          const isEdge = date === start || date === rangeEnd;
          const inside = start !== null && rangeEnd !== null && date > start && date < rangeEnd;
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => pick(date)}
              aria-pressed={isEdge || inside}
              aria-label={`${day} ${t.months[month - 1]} ${year}`}
              className={cn(
                "focus-visible:ring-ring/50 h-10 text-[14px] transition-colors outline-none focus-visible:z-10 focus-visible:ring-[3px]",
                "rounded-md",
                isEdge
                  ? "bg-accent text-on-accent font-semibold"
                  : inside
                    ? "bg-accent-soft text-text-primary rounded-none"
                    : "text-text-primary hover:bg-surface-overlay",
                disabled && "text-text-disabled pointer-events-none",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
