"use client";

import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
  civilDaysBetween,
  DAY_TYPES,
  menuSetPeriods,
  planChangeDays,
  planDays,
  planOverlaps,
  routinePeriods,
  type CivilDate,
  type Exercise,
  type Menu,
  type MenuSetPeriod,
  type PlanPeriod,
  type Prescription,
  type RoutinePeriod,
} from "@/lib/domain";
import { formatCivilDate, formatInteger, todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { PlansTimeline, type TimelineLane } from "./plans-timeline";

const t = es.screensClientDetail.previous;

type Forms = { one: string; other: string };

function unit(n: number, forms: Forms) {
  return n === 1 ? forms.one : forms.other;
}

function plural(n: number, forms: Forms) {
  return `${n} ${unit(n, forms)}`;
}

/** "Del 08-09-2026 al 05-10-2026", o "Desde el 05-10-2026" si sigue vigente. */
function periodLine(period: PlanPeriod): string {
  const from = formatCivilDate(period.from);
  return period.to === null
    ? t.periodOpen.replace("{from}", from)
    : t.period.replace("{from}", from).replace("{to}", formatCivilDate(period.to));
}

/** "11 días", "5 días en uso" o "Menos de un día". */
function durationLine(period: PlanPeriod, today: CivilDate): string {
  const n = planDays(period, today);
  if (n === 0) return t.lessThanDay;
  return plural(n, period.to === null ? t.daysInUse : t.days);
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

function macrosLine(menu: Menu): string {
  const { kcal, proteinG, carbsG, fatG } = menu.macros;
  return `${formatInteger(kcal)} ${es.common.kcal} · ${t.protein} ${proteinG} ${t.grams} · ${t.carbs} ${carbsG} ${t.grams} · ${t.fat} ${fatG} ${t.grams}`;
}

/** Un plan, plegado: lo que hace falta para reconocerlo y cuánto duró, y su contenido al abrirlo. */
function PlanItem({
  eyebrow,
  title,
  inUse,
  details,
  period,
  duration,
  children,
}: {
  eyebrow?: string;
  title: string;
  inUse: boolean;
  details: string[];
  period: string;
  duration: string;
  children: React.ReactNode;
}) {
  return (
    <details
      className={cn(
        "group bg-surface-raised/60 rounded-md border",
        inUse ? "border-accent-outline" : "border-border-subtle",
      )}
    >
      <summary className="focus-visible:ring-ring/50 flex min-h-[60px] cursor-pointer list-none items-center gap-3 rounded-md px-4 py-2.5 outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <span className="min-w-0 flex-1">
            {eyebrow ? <span className="text-text-muted block text-xs">{eyebrow}</span> : null}
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[15px] font-semibold">{title}</span>
              {inUse ? (
                <Badge
                  variant="ghost"
                  className="bg-accent-soft text-accent-emphasis px-2 py-0.5 font-semibold"
                >
                  {t.inUse}
                </Badge>
              ) : null}
            </span>
            {details.map((line) => (
              <span key={line} className="text-text-muted block text-xs">
                {line}
              </span>
            ))}
          </span>
          <span className="shrink-0 sm:text-right">
            <span className="block text-sm font-semibold tabular-nums">{period}</span>
            <span className="text-text-muted block text-xs">{duration}</span>
          </span>
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
  period,
  today,
  exercises,
}: {
  period: RoutinePeriod;
  today: CivilDate;
  exercises: Map<string, Exercise> | undefined;
}) {
  const { routine } = period;
  const template = routine.sourceTemplateName
    ? t.fromTemplate.replace("{name}", routine.sourceTemplateName)
    : t.noTemplate;
  return (
    <PlanItem
      title={routine.name}
      inUse={period.to === null}
      details={[`${template} · ${plural(routine.days.length, t.routineDays)}`]}
      period={periodLine(period)}
      duration={durationLine(period, today)}
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

/** Los menús de un tipo de día que se activaron y se archivaron a la vez, como un solo plan. */
function MenuSetItem({ period, today }: { period: MenuSetPeriod; today: CivilDate }) {
  const { menus } = period;
  const templates = [...new Set(menus.map((m) => m.sourceTemplateName).filter(Boolean))];
  const template = templates.length
    ? templates.map((name) => t.fromTemplate.replace("{name}", name!)).join(" · ")
    : t.noTemplate;
  // Con un solo menú, sus kcal ayudan a reconocerlo; con varios, cada uno las trae al abrirlo.
  const single = menus.length === 1 ? menus[0]! : null;
  return (
    <PlanItem
      eyebrow={`${es.editor.menu.dayTypes[period.dayType]} · ${plural(menus.length, t.menuCount)}`}
      title={menus.map((m) => m.name).join(" · ")}
      inUse={period.to === null}
      details={[
        single ? `${template} · ${formatInteger(single.macros.kcal)} ${es.common.kcal}` : template,
      ]}
      period={periodLine(period)}
      duration={durationLine(period, today)}
    >
      <div className="flex flex-col gap-4">
        {menus.map((menu) => (
          <div key={menu.id} className="flex flex-col gap-2">
            <div>
              <p className="text-sm font-semibold">{menu.name}</p>
              <p className="text-text-muted text-xs">{macrosLine(menu)}</p>
            </div>
            {menu.meals.length === 0 ? (
              <p className="text-text-subtle text-sm">{t.noMeals}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {menu.meals.map((meal) => (
                  <li key={meal.id}>
                    <p className="text-sm font-semibold">{meal.name}</p>
                    <p className="text-text-muted text-xs">
                      {meal.items
                        .map((item) => `${item.name} · ${item.grams} ${t.grams}`)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </PlanItem>
  );
}

const newestFirst = (a: PlanPeriod, b: PlanPeriod) => b.from.localeCompare(a.from);

/**
 * Pop-up de «Planes anteriores». Se abre con todo lo que el cliente ha llevado, de solo lectura:
 * una línea de tiempo (en pantallas anchas) y la lista de planes con lo que duró cada uno. Un
 * calendario opcional filtra por días (el primero y el último, o uno solo) y marca cuándo cambió
 * un plan. Las fechas de cada plan se deducen (`lib/domain/plan-periods.ts`).
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
  const [filterOpen, setFilterOpen] = useState(false);

  const routines = useClientRoutines(clientId);
  const activeMenus = useActiveMenus(clientId);
  const archivedMenus = useArchivedMenus(clientId);

  const routineP = useMemo(
    () => (routines.data ? routinePeriods(routines.data, timeZone) : []),
    [routines.data, timeZone],
  );
  const menuP = useMemo(
    () =>
      activeMenus.data && archivedMenus.data
        ? menuSetPeriods([...activeMenus.data, ...archivedMenus.data], timeZone)
        : [],
    [activeMenus.data, archivedMenus.data, timeZone],
  );
  const changeDays = useMemo(() => planChangeDays([...routineP, ...menuP]), [routineP, menuP]);
  const markedDays = useMemo(() => new Set(changeDays), [changeDays]);

  const start = range.start;
  const end = range.end ?? range.start;
  const selection = start !== null && end !== null ? { start, end } : null;
  const inSelection = (p: PlanPeriod) =>
    selection === null || planOverlaps(p, selection.start, selection.end);

  const visibleRoutines = routineP.filter(inSelection).sort(newestFirst);
  const visibleSets = menuP
    .filter(inSelection)
    .sort(
      (a, b) => newestFirst(a, b) || DAY_TYPES.indexOf(a.dayType) - DAY_TYPES.indexOf(b.dayType),
    );
  const exercises = useExercisesById(
    routines.data
      ? visibleRoutines
          .flatMap((p) => p.routine.days.flatMap((d) => d.exercises))
          .map((e) => e.exerciseId)
      : undefined,
  );

  const rangeLabel =
    start === null || end === null
      ? t.noneSelected
      : start === end
        ? t.selectedDay.replace("{date}", formatCivilDate(start))
        : t.selectedRange
            .replace("{from}", formatCivilDate(start))
            .replace("{to}", formatCivilDate(end));

  const totalPlans = routineP.length + menuP.length;
  const firstDay = [...routineP, ...menuP].map((p) => p.from).sort()[0];
  const shown = visibleRoutines.length + visibleSets.length;

  const lanes: TimelineLane[] = [];
  if (routineP.length > 0) {
    lanes.push({
      key: "routine",
      label: t.timelineRoutine,
      segments: routineP.map((p) => ({
        key: p.routine.id,
        label: p.routine.name,
        from: p.from,
        to: p.to,
      })),
    });
  }
  for (const dayType of DAY_TYPES) {
    const sets = menuP.filter((p) => p.dayType === dayType);
    if (sets.length === 0) continue;
    lanes.push({
      key: dayType,
      label: t.timelineMenus[dayType],
      segments: sets.map((p) => ({
        key: `${dayType}-${p.from}-${p.to}`,
        label: p.menus.map((m) => m.name).join(" · "),
        from: p.from,
        to: p.to,
      })),
    });
  }

  const ofTotal = (n: number, total: number) =>
    t.ofTotal.replace("{n}", String(n)).replace("{total}", String(total));

  const clearFilter = () => {
    setRange({ start: null, end: null });
    setFilterOpen(false);
  };

  const loading = routines.isPending || activeMenus.isPending || archivedMenus.isPending;
  const failed = routines.isError || activeMenus.isError || archivedMenus.isError;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.dialogDescription}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <LoadingState />
        ) : failed ? (
          <ErrorState message={t.loadError} />
        ) : totalPlans === 0 || firstDay === undefined ? (
          <p className="text-text-subtle text-sm">{t.noPlansAtAll}</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[15px] font-semibold">
                  {selection === null
                    ? t.allPlans
                    : selection.start === selection.end
                      ? t.plansOfDay.replace("{date}", formatCivilDate(selection.start))
                      : t.plansOfRange
                          .replace("{from}", formatCivilDate(selection.start))
                          .replace("{to}", formatCivilDate(selection.end))}
                </p>
                <p className="text-text-muted text-[13px]">
                  {selection === null
                    ? t.allPlansSince
                        .replace("{from}", formatCivilDate(firstDay))
                        .replace(
                          "{days}",
                          civilDaysBetween(firstDay, today) === 0
                            ? t.lessThanDay
                            : plural(civilDaysBetween(firstDay, today), t.days),
                        )
                    : t.inRange
                        .replace("{n}", String(shown))
                        .replace("{total}", String(totalPlans))}
                </p>
              </div>
              <Button
                variant="outline"
                aria-expanded={filterOpen}
                aria-controls="previous-plans-filter"
                className={cn(selection !== null && "border-accent-strong bg-accent-soft")}
                onClick={() => setFilterOpen((open) => !open)}
              >
                <CalendarIcon aria-hidden className="size-4" />
                {t.filter}
              </Button>
            </div>

            {filterOpen ? (
              <section
                id="previous-plans-filter"
                aria-label={t.datesLabel}
                className="border-border-subtle flex flex-wrap gap-6 rounded-lg border p-4"
              >
                <div className="min-w-0 flex-[1_1_300px]">
                  <RangeCalendar
                    start={range.start}
                    end={range.end}
                    max={today}
                    initialMonth={today}
                    onChange={setRange}
                    marked={markedDays}
                    markedLabel={t.markedLabel}
                  />
                </div>
                <div className="flex min-w-0 flex-[1_1_200px] flex-col justify-between gap-4">
                  <div className="flex flex-col gap-3.5">
                    <div>
                      <p className="text-text-muted text-xs">{t.chosenDates}</p>
                      <p aria-live="polite" className="text-[15px] font-semibold tabular-nums">
                        {rangeLabel}
                      </p>
                    </div>
                    <p className="text-text-muted text-[13px]">{t.pickHint}</p>
                    <p className="text-text-muted flex items-center gap-2 text-[13px]">
                      <span
                        aria-hidden
                        className="bg-accent-hover size-[5px] shrink-0 rounded-full"
                      />
                      {t.markedLegend}
                    </p>
                  </div>
                  <Button variant="outline" className="self-start" onClick={clearFilter}>
                    {t.clearFilter}
                  </Button>
                </div>
              </section>
            ) : null}

            <PlansTimeline
              lanes={lanes}
              start={firstDay}
              today={today}
              changeDays={changeDays}
              selection={selection}
            />

            {shown === 0 ? (
              <p className="text-text-subtle text-sm">{t.noPlans}</p>
            ) : (
              <>
                {visibleRoutines.length > 0 ? (
                  <section aria-label={t.routines} className="flex flex-col gap-2">
                    <h3 className="tracking-label text-text-subtle text-[11px] uppercase">
                      {t.routines} ·{" "}
                      {selection === null
                        ? visibleRoutines.length
                        : ofTotal(visibleRoutines.length, routineP.length)}
                    </h3>
                    {visibleRoutines.map((period) => (
                      <RoutineItem
                        key={period.routine.id}
                        period={period}
                        today={today}
                        exercises={exercises.data}
                      />
                    ))}
                  </section>
                ) : null}
                {visibleSets.length > 0 ? (
                  <section aria-label={t.menus} className="flex flex-col gap-2">
                    <h3 className="tracking-label text-text-subtle text-[11px] uppercase">
                      {t.menus} ·{" "}
                      {selection === null
                        ? plural(visibleSets.length, t.menuSets)
                        : `${ofTotal(visibleSets.length, menuP.length)} ${unit(menuP.length, t.menuSets)}`}
                    </h3>
                    {visibleSets.map((period) => (
                      <MenuSetItem
                        key={`${period.dayType}-${period.from}-${period.to}`}
                        period={period}
                        today={today}
                      />
                    ))}
                  </section>
                ) : null}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t.close}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
