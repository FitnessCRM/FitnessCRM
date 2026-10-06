"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RangeCalendar } from "@/components/ui/range-calendar";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  useActiveMenus,
  useArchivedMenus,
  useClientRoutines,
  useExercisesById,
} from "@/lib/data/hooks";
import {
  menuSetPeriods,
  planOverlaps,
  routinePeriods,
  type CivilDate,
  type Exercise,
  type Menu,
  type PlanPeriod,
  type Prescription,
  type Routine,
} from "@/lib/domain";
import { formatCivilDate, formatInteger, todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensClientDetail.previous;
const tPlan = es.screensClientDetail.plan;

function plural(n: number, forms: { one: string; other: string }) {
  return `${n} ${n === 1 ? forms.one : forms.other}`;
}

/** "Del 08-09-2026 al 05-10-2026", o "Desde el 05-10-2026 · en uso" si sigue vigente. */
function periodLine(period: PlanPeriod): string {
  const from = formatCivilDate(period.from);
  return period.to === null
    ? t.periodOpen.replace("{from}", from)
    : t.period.replace("{from}", from).replace("{to}", formatCivilDate(period.to));
}

/** "4 series · 6-8 reps · RIR 2 · descanso 3 min · nota". `repsMax` nulo = reps fijas. */
function prescriptionLine(p: Prescription): string {
  const reps = p.repsMax === null ? `${p.repsMin}` : `${p.repsMin}-${p.repsMax}`;
  return [
    `${p.sets} ${p.sets === 1 ? t.set : t.sets}`,
    `${reps} ${t.reps}`,
    p.rir ? `${t.rir} ${p.rir}` : "",
    p.rest ? `${t.rest} ${p.rest}` : "",
    p.note,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Un plan, plegado: lo que hace falta para reconocerlo, y su contenido al abrirlo. */
function PlanItem({
  title,
  details,
  children,
}: {
  title: string;
  details: string[];
  children: React.ReactNode;
}) {
  return (
    <details className="group border-border-subtle bg-surface-raised/60 rounded-md border">
      <summary className="focus-visible:ring-ring/50 flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-4 py-2.5 outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{title}</span>
          {details.map((line) => (
            <span key={line} className="text-text-muted block text-xs">
              {line}
            </span>
          ))}
        </span>
        <ChevronDownIcon
          aria-hidden
          className="text-text-muted size-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-border-subtle border-t px-4 py-3">{children}</div>
    </details>
  );
}

function RoutineItem({
  routine,
  period,
  exercises,
}: {
  routine: Routine;
  period: PlanPeriod;
  exercises: Map<string, Exercise> | undefined;
}) {
  return (
    <PlanItem
      title={routine.name}
      details={[
        routine.sourceTemplateName
          ? t.fromTemplate.replace("{name}", routine.sourceTemplateName)
          : t.noTemplate,
        periodLine(period),
        plural(routine.days.length, tPlan.days),
      ]}
    >
      <ol className="flex flex-col gap-4">
        {routine.days.map((day) => (
          <li key={day.id}>
            <p className="tracking-label text-text-subtle text-[11px] uppercase">
              {t.day} {day.dayNumber} · {day.label}
            </p>
            {day.exercises.length === 0 ? (
              <p className="text-text-subtle mt-1 text-sm">{t.noExercises}</p>
            ) : (
              <ul className="mt-1.5 flex flex-col gap-2">
                {day.exercises.map((ex) => (
                  <li key={ex.id}>
                    <p className="text-sm font-semibold">
                      {exercises?.get(ex.exerciseId)?.name ?? t.unknownExercise}
                    </p>
                    <p className="text-text-muted text-xs">{prescriptionLine(ex.prescription)}</p>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </PlanItem>
  );
}

function MenuItem({ menu }: { menu: Menu }) {
  const { kcal, proteinG, carbsG, fatG } = menu.macros;
  return (
    <PlanItem
      title={menu.name}
      details={[
        menu.sourceTemplateName
          ? t.fromTemplate.replace("{name}", menu.sourceTemplateName)
          : t.noTemplate,
        `${formatInteger(kcal)} ${es.common.kcal} · ${t.protein} ${proteinG} ${t.grams} · ${t.carbs} ${carbsG} ${t.grams} · ${t.fat} ${fatG} ${t.grams}`,
      ]}
    >
      {menu.meals.length === 0 ? (
        <p className="text-text-subtle text-sm">{t.noMeals}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {menu.meals.map((meal) => (
            <li key={meal.id}>
              <p className="text-sm font-semibold">{meal.name}</p>
              <p className="text-text-muted text-xs">
                {meal.items.map((item) => `${item.name} · ${item.grams} ${t.grams}`).join(" · ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PlanItem>
  );
}

/** Los planes que estuvieron vigentes algún día entre `start` y `end`. Solo se monta al pedirlo. */
function PlansInPeriod({
  clientId,
  timeZone,
  start,
  end,
}: {
  clientId: string;
  timeZone: string;
  start: CivilDate;
  end: CivilDate;
}) {
  const routines = useClientRoutines(clientId);
  const activeMenus = useActiveMenus(clientId);
  const archivedMenus = useArchivedMenus(clientId);

  const routinesInPeriod = routines.data
    ? routinePeriods(routines.data, timeZone).filter((p) => planOverlaps(p, start, end))
    : [];
  const exercises = useExercisesById(
    routines.data
      ? routinesInPeriod
          .flatMap((p) => p.routine.days.flatMap((d) => d.exercises))
          .map((e) => e.exerciseId)
      : undefined,
  );

  if (routines.isPending || activeMenus.isPending || archivedMenus.isPending) {
    return <LoadingState />;
  }
  if (routines.isError || activeMenus.isError || archivedMenus.isError) {
    return <ErrorState message={t.loadError} />;
  }

  const menusInPeriod = menuSetPeriods([...activeMenus.data, ...archivedMenus.data], timeZone)
    .filter((p) => planOverlaps(p, start, end))
    .sort((a, b) => a.from.localeCompare(b.from));
  if (routinesInPeriod.length === 0 && menusInPeriod.length === 0) {
    return <p className="text-text-subtle text-sm">{t.noPlans}</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {routinesInPeriod.length > 0 ? (
        <section aria-label={t.routines} className="flex flex-col gap-2.5">
          <h3 className="tracking-label text-text-subtle text-[11px] uppercase">{t.routines}</h3>
          {routinesInPeriod
            .sort((a, b) => a.from.localeCompare(b.from))
            .map((period) => (
              <RoutineItem
                key={period.routine.id}
                routine={period.routine}
                period={period}
                exercises={exercises.data}
              />
            ))}
        </section>
      ) : null}
      {menusInPeriod.length > 0 ? (
        <section aria-label={t.menus} className="flex flex-col gap-4">
          <h3 className="tracking-label text-text-subtle text-[11px] uppercase">{t.menus}</h3>
          {menusInPeriod.map((set) => (
            <div key={`${set.dayType}-${set.from}-${set.to}`} className="flex flex-col gap-2.5">
              <p className="text-text-muted text-xs">
                {es.editor.menu.dayTypes[set.dayType]} · {periodLine(set)}
              </p>
              {set.menus.map((menu) => (
                <MenuItem key={menu.id} menu={menu} />
              ))}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Pop-up de «Planes anteriores». Primer paso, un calendario para elegir los días (el primero y el
 * último, o uno solo); segundo, los planes que estuvieron vigentes en ese periodo, de solo lectura.
 * Las fechas de cada plan se deducen (`lib/domain/plan-periods.ts`).
 */
export function PreviousPlansDialog({
  clientId,
  timeZone,
  onOpenChange,
}: {
  clientId: string;
  timeZone: string;
  onOpenChange: (open: boolean) => void;
}) {
  const today = todayCivil(timeZone);
  const [range, setRange] = useState<{ start: CivilDate | null; end: CivilDate | null }>({
    start: null,
    end: null,
  });
  const [seeing, setSeeing] = useState(false);

  const start = range.start;
  const end = range.end ?? range.start;
  const label =
    start === null || end === null
      ? t.noneSelected
      : start === end
        ? t.selectedDay.replace("{date}", formatCivilDate(start))
        : t.selectedRange
            .replace("{from}", formatCivilDate(start))
            .replace("{to}", formatCivilDate(end));

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.dialogDescription}</DialogDescription>
        </DialogHeader>

        {seeing && start !== null && end !== null ? (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] font-semibold">{label}</p>
            <PlansInPeriod clientId={clientId} timeZone={timeZone} start={start} end={end} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-[15px] font-semibold">{t.pickTitle}</p>
              <p className="text-text-muted text-[13px]">{t.pickHint}</p>
            </div>
            <RangeCalendar
              start={range.start}
              end={range.end}
              max={today}
              initialMonth={today}
              onChange={setRange}
            />
            <p aria-live="polite" className="text-text-muted text-sm">
              {label}
            </p>
          </div>
        )}

        <DialogFooter>
          {seeing ? (
            <>
              <Button variant="secondary" onClick={() => setSeeing(false)}>
                {t.back}
              </Button>
              <Button onClick={() => onOpenChange(false)}>{t.close}</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                {t.cancel}
              </Button>
              <Button disabled={start === null} onClick={() => setSeeing(true)}>
                {t.see}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
