"use client";

import { ChevronDownIcon, ChevronRightIcon, PlayIcon } from "lucide-react";
import { useState } from "react";
import type {
  CivilDate,
  Exercise,
  ExerciseLastTime,
  Prescription,
  RoutineDayExercise,
  WorkoutLog,
} from "@/lib/domain";
import { formatCivilDate, formatNumber, formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { SetRow } from "./set-row";

const t = es.screensRoutine;

/** "4 series · 6-8 reps · RIR 2 · descanso 3 min · por pierna". `repsMax` nulo = reps fijas. */
export function prescriptionLine(p: Prescription): string {
  const reps = p.repsMax === null ? `${p.repsMin}` : `${p.repsMin}-${p.repsMax}`;
  return [
    `${p.sets} ${p.sets === 1 ? t.exercise.set : t.exercise.sets}`,
    `${reps} ${t.exercise.reps}`,
    p.rir ? `${t.exercise.rir} ${p.rir}` : "",
    p.rest ? `${t.exercise.rest} ${p.rest}` : "",
    p.note,
  ]
    .filter(Boolean)
    .join(" · ");
}

function VideoThumb({
  exercise,
  highlighted,
}: {
  exercise: Exercise | undefined;
  highlighted: boolean;
}) {
  const base =
    "flex h-[70px] w-28 shrink-0 max-sm:h-14 max-sm:w-20 items-center justify-center rounded-md bg-[repeating-linear-gradient(45deg,var(--color-surface-raised),var(--color-surface-raised)_8px,var(--color-surface-overlay)_8px,var(--color-surface-overlay)_16px)]";
  const play = (
    <span
      aria-hidden
      className={cn(
        "flex size-[30px] items-center justify-center rounded-full pl-0.5",
        highlighted ? "bg-accent text-on-accent" : "bg-border-strong text-text-primary",
      )}
    >
      <PlayIcon className="size-3 fill-current" />
    </span>
  );
  if (!exercise?.videoUrl) return <div aria-hidden className={base} />;
  return (
    <a
      href={exercise.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${t.exercise.video}: ${exercise.name}`}
      className={cn(base, "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]")}
    >
      {play}
    </a>
  );
}

/** Ejercicio prescrito con su registro opcional desplegable (una fila por serie). */
export function ExerciseCard({
  item,
  exercise,
  logs,
  reference,
  lastTime,
  today,
  defaultOpen,
  hint = t.log.clearHint,
  onSave,
  onDelete,
}: {
  item: RoutineDayExercise;
  /** De `getExercise`: puede estar archivado. `undefined` si ya no existe. */
  exercise: Exercise | undefined;
  /** Series de este ejercicio registradas hoy. */
  logs: WorkoutLog[];
  /** Las mismas series en el último día registrado antes de hoy. */
  reference: { logs: WorkoutLog[]; date: CivilDate } | undefined;
  /** Lo que se hizo la última vez en este ejercicio, en el día de rutina que fuera. Sin él, no hay línea. */
  lastTime?: ExerciseLastTime | null;
  /** Fecha civil de hoy, para fechar la referencia en la fila. */
  today: CivilDate;
  defaultOpen: boolean;
  /** Pie del registro; por defecto el de la rejilla de hoy. */
  hint?: string;
  onSave: (setNumber: number, values: { weightKg: number; reps: number }) => Promise<unknown>;
  onDelete: (workoutLogId: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `log-${item.id}`;
  const sets = Array.from(
    { length: Math.max(item.prescription.sets, ...logs.map((l) => l.setNumber)) },
    (_, i) => i + 1,
  );

  return (
    <article className="border-border-subtle bg-surface rounded-xl border">
      <div className="flex items-center gap-[18px] px-5 py-[18px] max-sm:flex-wrap">
        <VideoThumb exercise={exercise} highlighted={open} />
        <div className="min-w-0 flex-1 max-sm:min-w-[55%]">
          <h2 className="font-display text-[20px] leading-tight font-bold uppercase">
            {exercise?.name ?? t.exercise.unknown}
          </h2>
          <p className="text-text-muted mt-1 text-[14px]">{prescriptionLine(item.prescription)}</p>
          {lastTime ? (
            <p className="text-text-subtle mt-0.5 text-[13px]">
              {t.exercise.lastTime} (
              <time dateTime={lastTime.date} title={formatCivilDate(lastTime.date)}>
                {formatShortDate(lastTime.date, today)}
              </time>
              ):{" "}
              {lastTime.logs
                .map((l) => `${formatNumber(l.weightKg)} ${es.common.kg} × ${l.reps}`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="border-border-emphasis text-text-muted hover:border-accent hover:text-text-primary tracking-label focus-visible:ring-ring/50 inline-flex min-h-8 items-center rounded-full border px-3.5 py-1.5 text-xs uppercase outline-none focus-visible:ring-[3px] max-sm:ml-auto"
        >
          {t.log.toggle}
          {open ? (
            <ChevronDownIcon aria-hidden className="ml-1 inline size-3" />
          ) : (
            <ChevronRightIcon aria-hidden className="ml-1 inline size-3" />
          )}
        </button>
      </div>

      {open ? (
        <div
          id={panelId}
          className="border-border-subtle flex flex-col gap-2.5 border-t px-5 pt-4 pb-5"
        >
          <div className="text-text-subtle tracking-label grid grid-cols-[48px_140px_140px_1fr] gap-3.5 text-[11px] uppercase max-sm:grid-cols-[32px_1fr_1fr]">
            <span>{t.log.set}</span>
            <span>{t.log.weight}</span>
            <span>{t.log.reps}</span>
            <span className="text-right max-sm:hidden">{t.log.optional}</span>
          </div>
          {sets.map((setNumber) => {
            const log = logs.find((l) => l.setNumber === setNumber);
            const previous = reference?.logs.find((l) => l.setNumber === setNumber);
            return (
              <SetRow
                key={`${setNumber}-${log?.id ?? "none"}-${log?.weightKg}-${log?.reps}`}
                setNumber={setNumber}
                log={log}
                today={today}
                reference={
                  previous && reference ? { log: previous, date: reference.date } : undefined
                }
                onSave={(values) => onSave(setNumber, values)}
                onDelete={onDelete}
              />
            );
          })}
          <p className="text-text-subtle mt-1 text-xs">{hint}</p>
        </div>
      ) : null}
    </article>
  );
}
