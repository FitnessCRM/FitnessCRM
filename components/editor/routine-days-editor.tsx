"use client";

import { ChevronDownIcon, ChevronUpIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";
import {
  moveItem,
  renumberDays,
  type Exercise,
  type RoutineDay,
  type RoutineDayExercise,
} from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { ExercisePicker } from "./exercise-picker";
import { NumberField } from "./number-field";

const t = es.editor.routine;

function newId(): string {
  return crypto.randomUUID();
}

/** Mueve un elemento del array con los botones subir/bajar: no hay arrastre, que en táctil falla. */
function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

/**
 * Días de una rutina con sus ejercicios. Es un componente controlado y no habla con datos:
 * recibe la biblioteca por props y devuelve los días nuevos, así que lo mismo sirve para una
 * plantilla que para el editor del plan de un cliente. Los días van numerados 1..n por orden.
 */
export function RoutineDaysEditor({
  days,
  library,
  onChange,
}: {
  days: RoutineDay[];
  /** Ejercicios que se pueden añadir (la biblioteca activa). */
  library: Exercise[];
  onChange: (days: RoutineDay[]) => void;
}) {
  const nameOf = (exerciseId: string) =>
    library.find((e) => e.id === exerciseId)?.name ?? t.unknownExercise;

  const updateDay = (dayId: string, change: (day: RoutineDay) => RoutineDay) =>
    onChange(days.map((day) => (day.id === dayId ? change(day) : day)));

  const addDay = () =>
    onChange(
      renumberDays([
        ...days,
        { id: newId(), dayNumber: days.length + 1, label: "", exercises: [] },
      ]),
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-muted text-[13px]">{t.hint}</p>
        <Button type="button" variant="secondary" size="sm" onClick={addDay}>
          {t.addDay}
        </Button>
      </div>

      {days.length === 0 ? (
        <EmptyState title={t.noDays.title} description={t.noDays.hint} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {days.map((day, dayIndex) => (
            <section
              key={day.id}
              aria-label={`${t.day} ${day.dayNumber}`}
              className="border-border-subtle bg-surface flex min-w-0 flex-col gap-3 rounded-xl border p-4"
            >
              <header className="flex items-center gap-1">
                <h3 className="font-display tracking-label shrink-0 text-[15px] font-bold uppercase">
                  {t.day} {day.dayNumber}
                </h3>
                <Input
                  value={day.label}
                  onChange={(event) =>
                    updateDay(day.id, (d) => ({ ...d, label: event.target.value }))
                  }
                  aria-label={t.dayLabel}
                  placeholder={t.dayLabelPlaceholder}
                  className="h-9 min-w-0 flex-1 px-2.5 text-[14px]"
                />
                <IconButton
                  label={t.moveDayUp}
                  disabled={dayIndex === 0}
                  onClick={() => onChange(renumberDays(moveItem(days, dayIndex, -1)))}
                >
                  <ChevronUpIcon />
                </IconButton>
                <IconButton
                  label={t.moveDayDown}
                  disabled={dayIndex === days.length - 1}
                  onClick={() => onChange(renumberDays(moveItem(days, dayIndex, 1)))}
                >
                  <ChevronDownIcon />
                </IconButton>
                <IconButton
                  label={t.removeDay}
                  onClick={() => onChange(renumberDays(days.filter((d) => d.id !== day.id)))}
                >
                  <XIcon />
                </IconButton>
              </header>

              {day.exercises.length === 0 ? (
                <p className="text-text-subtle text-[13px]">{t.noExercises}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {day.exercises.map((exercise, index) => (
                    <ExerciseRow
                      key={exercise.id}
                      exercise={exercise}
                      name={nameOf(exercise.exerciseId)}
                      isFirst={index === 0}
                      isLast={index === day.exercises.length - 1}
                      onChange={(next) =>
                        updateDay(day.id, (d) => ({
                          ...d,
                          exercises: d.exercises.map((e) => (e.id === next.id ? next : e)),
                        }))
                      }
                      onMove={(delta) =>
                        updateDay(day.id, (d) => ({
                          ...d,
                          exercises: moveItem(d.exercises, index, delta),
                        }))
                      }
                      onRemove={() =>
                        updateDay(day.id, (d) => ({
                          ...d,
                          exercises: d.exercises.filter((e) => e.id !== exercise.id),
                        }))
                      }
                    />
                  ))}
                </ul>
              )}

              <ExercisePicker
                library={library}
                label={`${t.addExercise} (${t.day} ${day.dayNumber})`}
                onPick={(exerciseId) =>
                  updateDay(day.id, (d) => ({
                    ...d,
                    exercises: [
                      ...d.exercises,
                      {
                        id: newId(),
                        exerciseId,
                        prescription: {
                          sets: 3,
                          repsMin: 8,
                          repsMax: 10,
                          rir: "",
                          rest: "",
                          note: "",
                        },
                      },
                    ],
                  }))
                }
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseRow({
  exercise,
  name,
  isFirst,
  isLast,
  onChange,
  onMove,
  onRemove,
}: {
  exercise: RoutineDayExercise;
  name: string;
  isFirst: boolean;
  isLast: boolean;
  onChange: (exercise: RoutineDayExercise) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const p = exercise.prescription;
  const set = (change: Partial<typeof p>) =>
    onChange({ ...exercise, prescription: { ...p, ...change } });
  return (
    <li className="bg-surface-raised flex flex-col gap-2 rounded-lg p-3">
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-[14px] font-semibold">{name}</p>
        <IconButton label={t.moveExerciseUp} disabled={isFirst} onClick={() => onMove(-1)}>
          <ChevronUpIcon />
        </IconButton>
        <IconButton label={t.moveExerciseDown} disabled={isLast} onClick={() => onMove(1)}>
          <ChevronDownIcon />
        </IconButton>
        <IconButton label={t.removeExercise} onClick={onRemove}>
          <XIcon />
        </IconButton>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberField
          label={t.sets}
          min={1}
          value={p.sets}
          onChange={(v) => set({ sets: v ?? 0 })}
        />
        <NumberField
          label={t.repsMin}
          min={1}
          value={p.repsMin}
          onChange={(v) => set({ repsMin: v ?? 0 })}
        />
        <NumberField
          label={t.repsMax}
          min={1}
          hint={t.repsMaxHint}
          placeholder={t.repsMaxPlaceholder}
          value={p.repsMax}
          onChange={(v) => set({ repsMax: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-text-subtle tracking-label text-[11px] uppercase">{t.rir}</Label>
          <Input
            value={p.rir}
            onChange={(event) => set({ rir: event.target.value })}
            className="h-10 px-2.5 text-[14px]"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-text-subtle tracking-label text-[11px] uppercase">{t.rest}</Label>
          <Input
            value={p.rest}
            onChange={(event) => set({ rest: event.target.value })}
            className="h-10 px-2.5 text-[14px]"
          />
        </div>
      </div>
    </li>
  );
}
