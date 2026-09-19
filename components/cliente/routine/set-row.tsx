"use client";

import { useState, type FocusEvent, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import type { CivilDate, WorkoutLog } from "@/lib/domain";
import { formatNumber, formatShortDate, parseDecimalInput } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensRoutine.log;

type Status = "idle" | "saving" | "error" | "incomplete";

const isWeight = (value: number) => Number.isFinite(value) && value >= 0;
const isReps = (value: number) => Number.isInteger(value) && value >= 0;

/**
 * Una serie: peso y reps reales. Se guarda al salir de la fila (o con Enter) si están los dos;
 * vaciar los dos retira la serie registrada. Nada es obligatorio.
 */
export function SetRow({
  setNumber,
  log,
  reference,
  today,
  onSave,
  onDelete,
}: {
  setNumber: number;
  /** Registro de hoy, lo único que esta pantalla escribe. */
  log: WorkoutLog | undefined;
  /** Misma serie en el último día registrado antes de hoy: referencia, no se edita. */
  reference: { log: WorkoutLog; date: CivilDate } | undefined;
  /** Fecha civil de hoy, para escribir la fecha de la referencia en forma corta. */
  today: CivilDate;
  onSave: (values: { weightKg: number; reps: number }) => Promise<unknown>;
  onDelete: (workoutLogId: string) => Promise<unknown>;
}) {
  const [weight, setWeight] = useState(log ? formatNumber(log.weightKg) : "");
  const [reps, setReps] = useState(log ? String(log.reps) : "");
  const [status, setStatus] = useState<Status>("idle");

  async function run(action: () => Promise<unknown>) {
    setStatus("saving");
    try {
      await action();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function commit() {
    if (status === "saving") return;
    const weightKg = parseDecimalInput(weight);
    const repsDone = parseDecimalInput(reps);
    if (weight.trim() === "" && reps.trim() === "") {
      if (log) void run(() => onDelete(log.id));
      else setStatus("idle");
      return;
    }
    if (!isWeight(weightKg) || !isReps(repsDone)) {
      setStatus("incomplete");
      return;
    }
    if (log && log.weightKg === weightKg && log.reps === repsDone) {
      setStatus("idle");
      return;
    }
    void run(() => onSave({ weightKg, reps: repsDone }));
  }

  function onRowBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    commit();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
  }

  const invalid = status === "incomplete";
  const weightInvalid = invalid && !isWeight(parseDecimalInput(weight));
  const repsInvalid = invalid && !isReps(parseDecimalInput(reps));
  const feedback =
    status === "saving" ? (
      <span className="text-text-subtle">{t.saving}</span>
    ) : status === "error" ? (
      <span className="text-danger">{t.error}</span>
    ) : status === "incomplete" ? (
      <span className="text-danger">{t.incomplete}</span>
    ) : log ? (
      <span className="text-success">{t.saved}</span>
    ) : reference ? (
      <span className="text-text-subtle">
        {t.lastTime} ({formatShortDate(reference.date, today)}):{" "}
        {formatNumber(reference.log.weightKg)} kg × {reference.log.reps}
      </span>
    ) : null;

  return (
    <div
      role="group"
      aria-label={`${t.set} ${setNumber}`}
      onBlur={onRowBlur}
      className="grid grid-cols-[48px_140px_140px_1fr] items-center gap-3.5 max-sm:grid-cols-[32px_1fr_1fr]"
    >
      <span className="text-text-primary text-[15px]">{setNumber}</span>
      <Input
        inputMode="decimal"
        aria-label={`${t.weight} · ${t.set} ${setNumber}`}
        placeholder="—"
        value={weight}
        aria-invalid={weightInvalid || undefined}
        onChange={(e) => setWeight(e.target.value)}
        onKeyDown={onKeyDown}
        className="h-[37px] text-[14px]"
      />
      <Input
        inputMode="numeric"
        aria-label={`${t.reps} · ${t.set} ${setNumber}`}
        placeholder="—"
        value={reps}
        aria-invalid={repsInvalid || undefined}
        onChange={(e) => setReps(e.target.value)}
        onKeyDown={onKeyDown}
        className="h-[37px] text-[14px]"
      />
      <p aria-live="polite" className="text-right text-[13px] max-sm:col-span-3 max-sm:text-left">
        {feedback}
      </p>
    </div>
  );
}
