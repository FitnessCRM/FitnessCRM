"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { EmptyState } from "@/components/ui/states";
import {
  DomainError,
  dayRecordOn,
  defaultRoutineDay,
  latestDayRecord,
  weekNumber,
  type Exercise,
  type Routine,
  type WorkoutLog,
} from "@/lib/domain";
import {
  useActiveRoutine,
  useClient,
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
import { DaySummaryCard } from "./day-summary-card";
import { ExerciseCard } from "./exercise-card";
import { TrainerNoteCard } from "../trainer-note-card";

const t = es.screensRoutine;

/** Pantalla 02 · Rutina: días numéricos en pestañas, ejercicios a la izquierda, resumen a la derecha. */
export function RoutineScreen() {
  const clientId = useSessionClientId();
  const trainer = useTrainer();
  const client = useClient(clientId);
  const routine = useActiveRoutine(clientId);

  let eyebrow: string | undefined;
  if (trainer.data && client.data) {
    try {
      const today = todayCivil(trainer.data.timeZone);
      eyebrow = `${t.week} ${weekNumber(client.data.startDate, today, trainer.data.timeZone)}`;
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
    }
  }

  return (
    <QueryBoundary
      query={routine}
      empty={
        <div className="flex flex-col gap-6">
          <PageHeader eyebrow={eyebrow} title={es.pages.client.rutina} />
          <EmptyState title={t.empty.title} description={t.empty.hint} />
        </div>
      }
    >
      {(data) => (
        <RoutineLogs
          routine={data}
          clientId={clientId}
          eyebrow={eyebrow}
          trainerName={trainer.data?.name}
          timeZone={trainer.data?.timeZone}
        />
      )}
    </QueryBoundary>
  );
}

function RoutineLogs(props: {
  routine: Routine;
  clientId: string | undefined;
  eyebrow: string | undefined;
  trainerName: string | undefined;
  timeZone: string | undefined;
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
          {(exerciseMap) => <RoutineView {...props} logs={logData} exercises={exerciseMap} />}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}

function RoutineView({
  routine,
  clientId,
  eyebrow,
  trainerName,
  timeZone,
  logs,
  exercises,
}: {
  routine: Routine;
  clientId: string | undefined;
  eyebrow: string | undefined;
  trainerName: string | undefined;
  timeZone: string | undefined;
  logs: WorkoutLog[];
  exercises: Map<string, Exercise>;
}) {
  // La apertura por defecto se decide una vez; después manda lo que elija el cliente.
  const [selectedId, setSelectedId] = useState(() => defaultRoutineDay(routine, logs)?.id);
  const saveLog = useSaveWorkoutLog(clientId);
  const deleteLog = useDeleteWorkoutLog(clientId);

  // La rejilla es la de hoy; lo anterior solo se enseña como referencia.
  const today = todayCivil(timeZone);
  const day = routine.days.find((d) => d.id === selectedId) ?? routine.days[0];
  const record = day ? dayRecordOn(day, logs, today) : undefined;
  const previous = day ? latestDayRecord(day, logs, { before: today }) : undefined;

  return (
    // En móvil la columna lateral se reparte (CLAUDE.md, «Columna lateral en móvil»): la nota del
    // entrenador es contexto y sube antes de los días; el resumen de series es resumen y baja.
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-5 max-lg:contents">
        <div className="max-lg:order-1">
          <PageHeader eyebrow={eyebrow} title={routine.name} />
        </div>

        {routine.days.length > 0 ? (
          <div
            role="tablist"
            aria-label={t.daysLabel}
            className="flex flex-wrap gap-2 max-lg:order-3"
          >
            {routine.days.map((d) => {
              const active = d.id === day?.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    "font-display tracking-label focus-visible:ring-ring/50 h-[39px] rounded-md border px-[22px] text-[15px] uppercase transition-colors outline-none focus-visible:ring-[3px]",
                    active
                      ? "bg-accent text-on-accent border-accent font-bold"
                      : "border-border-emphasis bg-surface text-text-muted hover:text-text-primary",
                  )}
                >
                  {t.day} {d.dayNumber}
                </button>
              );
            })}
          </div>
        ) : null}

        {!day || !record || day.exercises.length === 0 ? (
          <EmptyState
            className="max-lg:order-4"
            title={t.emptyDay.title}
            description={t.emptyDay.hint}
          />
        ) : (
          <div role="tabpanel" className="flex flex-col gap-3 max-lg:order-4">
            {day.exercises.map((item, index) => {
              const itemLogs = record.logs.filter((l) => l.routineDayExerciseId === item.id);
              return (
                <ExerciseCard
                  key={`${day.id}-${item.id}`}
                  item={item}
                  exercise={exercises.get(item.exerciseId)}
                  logs={itemLogs}
                  today={today}
                  reference={
                    previous?.date
                      ? {
                          date: previous.date,
                          logs: previous.logs.filter((l) => l.routineDayExerciseId === item.id),
                        }
                      : undefined
                  }
                  defaultOpen={itemLogs.length > 0 || (record.logs.length === 0 && index === 0)}
                  onSave={(setNumber, values) =>
                    saveLog.mutateAsync({
                      exerciseId: item.exerciseId,
                      routineId: routine.id,
                      routineDayExerciseId: item.id,
                      date: today,
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

      <div className="flex flex-col gap-4 max-lg:contents lg:pt-3.5">
        {day && record ? (
          <div className="max-lg:order-5">
            <DaySummaryCard day={day} record={record} previousDate={previous?.date ?? null} />
          </div>
        ) : null}
        {routine.note ? (
          <div className="max-lg:order-2">
            <TrainerNoteCard note={routine.note} trainerName={trainerName} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
