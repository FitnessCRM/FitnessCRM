"use client";

import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { dayTitle } from "@/components/client/routine/day-summary-card";
import { ExerciseCard } from "@/components/client/routine/exercise-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { EmptyState } from "@/components/ui/states";
import {
  dayRecordOn,
  defaultRoutineDay,
  latestDayRecord,
  type CivilDate,
  type Exercise,
  type Routine,
  type WorkoutLog,
} from "@/lib/domain";
import {
  useActiveRoutine,
  useDeleteWorkoutLog,
  useExercisesById,
  useSaveWorkoutLog,
  useSessionClientId,
  useTrainer,
  useWorkoutLogs,
} from "@/lib/data/hooks";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensWorkoutDay;
const routineT = es.screensRoutine;

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Día civil anterior: aritmética en UTC sobre la fecha, sin zona horaria de por medio. */
function previousDay(date: CivilDate): CivilDate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Una fecha es válida si existe en el calendario y no es futura. */
function isPastOrToday(raw: string, today: CivilDate): boolean {
  return (
    CIVIL_DATE.test(raw) && !Number.isNaN(new Date(`${raw}T00:00:00Z`).getTime()) && raw <= today
  );
}

/**
 * Corregir o añadir el entreno de un día que no es hoy. Es la salida de la deuda anotada en
 * Rutina: allí la rejilla es solo la de hoy (así escribir no vacía casillas ni borrar toca
 * histórico) y aquí la fecha se elige de forma explícita. Reutiliza las mismas filas de serie.
 */
export function WorkoutDayScreen() {
  const clientId = useSessionClientId();
  const trainer = useTrainer();
  const routine = useActiveRoutine(clientId);

  const header = (
    <>
      <Link
        href="/progress"
        className="text-text-muted hover:text-text-primary inline-flex min-h-8 items-center gap-1 text-sm"
      >
        <ChevronLeftIcon aria-hidden className="size-4" />
        {t.back}
      </Link>
      <PageHeader eyebrow={t.eyebrow} title={t.title} />
    </>
  );

  return (
    <QueryBoundary query={trainer} isEmpty={() => false} empty={null}>
      {(trainerData) => (
        <QueryBoundary
          query={routine}
          empty={
            <div className="flex flex-col gap-4">
              {header}
              <EmptyState title={routineT.empty.title} description={routineT.empty.hint} />
            </div>
          }
        >
          {(data) => (
            <WorkoutDayLogs
              routine={data}
              clientId={clientId}
              timeZone={trainerData.timeZone}
              header={header}
            />
          )}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}

function WorkoutDayLogs(props: {
  routine: Routine;
  clientId: string | undefined;
  timeZone: string;
  header: ReactNode;
}) {
  // Los de todas las versiones de la rutina: cada serie casa con su línea por id (§7).
  const logs = useWorkoutLogs(props.clientId);
  const exercises = useExercisesById(
    props.routine.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)),
  );
  return (
    <QueryBoundary query={logs} isEmpty={() => false} empty={null}>
      {(logData) => (
        <QueryBoundary query={exercises} isEmpty={() => false} empty={null}>
          {(exerciseMap) => <WorkoutDayView {...props} logs={logData} exercises={exerciseMap} />}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}

function WorkoutDayView({
  routine,
  clientId,
  timeZone,
  header,
  logs,
  exercises,
}: {
  routine: Routine;
  clientId: string | undefined;
  timeZone: string;
  header: ReactNode;
  logs: WorkoutLog[];
  exercises: Map<string, Exercise>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = todayCivil(timeZone);
  const requested = params.get("date") ?? "";

  // Sin fecha en la URL se abre en ayer: hoy ya tiene su sitio en Rutina.
  const [date, setDate] = useState<CivilDate>(() =>
    isPastOrToday(requested, today) ? requested : previousDay(today),
  );
  const [draft, setDraft] = useState(date);
  const [picked, setPicked] = useState<{ date: CivilDate; dayId: string } | null>(null);
  const saveLog = useSaveWorkoutLog(clientId);
  const deleteLog = useDeleteWorkoutLog(clientId);

  const dateValid = isPastOrToday(draft, today);

  function changeDate(value: string) {
    setDraft(value);
    if (!isPastOrToday(value, today)) return;
    setDate(value);
    router.replace(`${pathname}?date=${value}`, { scroll: false });
  }

  // Día de rutina: el que eligió el cliente para esta fecha; si no, el que ya tiene registros en
  // ella; si no, el que sigue a lo último que registró antes de esa fecha.
  const withLogs = routine.days.find((d) => dayRecordOn(d, logs, date).logs.length > 0);
  const day =
    routine.days.find((d) => d.id === (picked?.date === date ? picked.dayId : undefined)) ??
    withLogs ??
    defaultRoutineDay(
      routine,
      logs.filter((l) => l.date < date),
    ) ??
    routine.days[0];
  const record = day ? dayRecordOn(day, logs, date) : undefined;
  const previous = day ? latestDayRecord(day, logs, { before: date }) : undefined;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-2">{header}</div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="workout-date">{t.date}</Label>
        <Input
          id="workout-date"
          type="date"
          max={today}
          value={draft}
          aria-invalid={dateValid ? undefined : true}
          onChange={(e) => changeDate(e.target.value)}
          className="h-11 w-full sm:w-56"
        />
        {dateValid ? null : (
          <p role="alert" className="text-danger text-sm">
            {t.dateInvalid}
          </p>
        )}
      </div>

      {routine.days.length > 0 ? (
        <div role="tablist" aria-label={routineT.daysLabel} className="flex flex-wrap gap-2">
          {routine.days.map((d) => {
            const active = d.id === day?.id;
            return (
              <button
                key={d.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPicked({ date, dayId: d.id })}
                className={cn(
                  "font-display tracking-label focus-visible:ring-ring/50 h-[39px] rounded-md border px-[22px] text-[15px] uppercase transition-colors outline-none focus-visible:ring-[3px]",
                  active
                    ? "bg-accent text-on-accent border-accent font-bold"
                    : "border-border-emphasis bg-surface text-text-muted hover:text-text-primary",
                )}
              >
                {routineT.day} {d.dayNumber}
              </button>
            );
          })}
        </div>
      ) : null}

      {!day || !record || day.exercises.length === 0 ? (
        <EmptyState title={routineT.emptyDay.title} description={routineT.emptyDay.hint} />
      ) : (
        <div role="tabpanel" className="flex flex-col gap-3">
          <p className="text-text-muted text-[13px]">
            {dayTitle(day)} · {record.loggedSets} {routineT.summary.of} {record.totalSets}{" "}
            {t.summaryLogged}
          </p>
          {day.exercises.map((item) => {
            const itemLogs = record.logs.filter((l) => l.routineDayExerciseId === item.id);
            return (
              <ExerciseCard
                key={`${date}-${day.id}-${item.id}`}
                item={item}
                exercise={exercises.get(item.exerciseId)}
                logs={itemLogs}
                today={today}
                hint={t.clearHint}
                reference={
                  previous?.date
                    ? {
                        date: previous.date,
                        logs: previous.logs.filter((l) => l.routineDayExerciseId === item.id),
                      }
                    : undefined
                }
                defaultOpen
                onSave={(setNumber, values) =>
                  saveLog.mutateAsync({
                    exerciseId: item.exerciseId,
                    routineId: routine.id,
                    routineDayExerciseId: item.id,
                    date,
                    setNumber,
                    ...values,
                  })
                }
                onDelete={(id) => deleteLog.mutateAsync(id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
