import { Card } from "@/components/ui/card";
import type { CivilDate, DayRecord, RoutineDay } from "@/lib/domain";
import { formatCivilDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensRoutine;

/** "Día 2 · Pierna", o "Día 2" sin etiqueta. */
export function dayTitle(day: RoutineDay): string {
  const base = `${t.day} ${day.dayNumber}`;
  return day.label ? `${base} · ${day.label}` : base;
}

/**
 * Tarjeta lateral del día seleccionado. El contador es el de hoy: son registros fechados hoy,
 * no una suposición sobre qué día de rutina toca, que los días numéricos no la permiten.
 */
export function DaySummaryCard({
  day,
  record,
  previousDate,
}: {
  day: RoutineDay;
  /** Registro de hoy: el contador es "X de Y series registradas hoy". */
  record: DayRecord;
  /** Último día registrado antes de hoy, si lo hay. */
  previousDate: CivilDate | null;
}) {
  const ratio = record.totalSets === 0 ? 0 : record.loggedSets / record.totalSets;
  return (
    <Card className="gap-4 px-[22px] py-[22px]">
      <h2 className="section-title">{dayTitle(day)}</h2>
      <div className="flex gap-8">
        <div>
          <p className="font-display text-[28px] leading-none font-bold">{day.exercises.length}</p>
          <p className="text-text-subtle tracking-label mt-1.5 text-[11px] uppercase">
            {t.summary.exercises}
          </p>
        </div>
        <div>
          <p className="font-display text-[28px] leading-none font-bold">{record.totalSets}</p>
          <p className="text-text-subtle tracking-label mt-1.5 text-[11px] uppercase">
            {t.summary.sets}
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={record.totalSets}
        aria-valuenow={record.loggedSets}
        className="bg-surface-overlay h-1.5 overflow-hidden rounded-full"
      >
        <div className="bg-accent h-full rounded-full" style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="text-text-muted flex flex-col gap-1 text-[13px] leading-snug">
        <p>
          {record.loggedSets} {t.summary.of} {record.totalSets} {t.summary.logged}
          {previousDate ? (
            <>
              {" · "}
              {t.summary.lastDate}{" "}
              <time dateTime={previousDate}>{formatCivilDate(previousDate)}</time>
            </>
          ) : null}
        </p>
        <p className="text-text-subtle">{t.summary.optional}</p>
      </div>
    </Card>
  );
}
