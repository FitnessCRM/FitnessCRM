import Link from "next/link";
import { Card } from "@/components/ui/card";
import { DAY_TYPES, type MacroTargets, type Menu, type Routine } from "@/lib/domain";
import { formatInteger } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensClientDetail;

function plural(n: number, forms: { one: string; other: string }) {
  return `${n} ${n === 1 ? forms.one : forms.other}`;
}

function PlanCard({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-1.5 px-5 py-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{title}</h2>
        <Link href={editHref} className="text-accent-hover hover:text-accent-emphasis text-xs">
          {t.edit}
        </Link>
      </div>
      {children}
    </Card>
  );
}

/** «Rutina asignada»: la activa del cliente y la plantilla de la que salió (copia, no enlace). */
export function RoutineCard({ routine, editHref }: { routine: Routine | null; editHref: string }) {
  return (
    <PlanCard title={t.plan.routineTitle} editHref={editHref}>
      {routine ? (
        <>
          <p className="text-[15px] font-semibold">{routine.name}</p>
          <p className="text-text-muted text-xs">
            {plural(routine.days.length, t.plan.days)}
            {routine.sourceTemplateName
              ? ` · ${t.plan.fromTemplate} “${routine.sourceTemplateName}”`
              : null}
          </p>
        </>
      ) : (
        <p className="text-text-subtle text-sm">{t.plan.noRoutine}</p>
      )}
    </PlanCard>
  );
}

/**
 * «Macros y menú»: kcal objetivo por tipo de día (las que escribió el entrenador, §5) y el resumen de
 * menús activos. Los menús son sugerencia; las macros que cuentan son las del objetivo.
 */
export function MacrosMenuCard({
  targets,
  menus,
  editHref,
}: {
  targets: MacroTargets[];
  menus: Menu[];
  editHref: string;
}) {
  const kcal = DAY_TYPES.map((dayType) => targets.find((m) => m.dayType === dayType))
    .filter((m): m is MacroTargets => m !== undefined)
    .map((m) => formatInteger(m.macros.kcal));

  const menuCounts = DAY_TYPES.map((dayType) => menus.filter((m) => m.dayType === dayType).length);
  const types = menuCounts.filter((n) => n > 0);
  const evenSplit = types.length > 0 && types.every((n) => n === types[0]);
  const menusSummary =
    types.length === 0
      ? t.plan.noMenus
      : `${plural(types.length, t.plan.dayTypes)} · ${
          evenSplit
            ? plural(types[0] ?? 0, t.plan.menusPerType)
            : plural(menus.length, t.plan.menus)
        }`;

  return (
    <PlanCard title={t.plan.macrosTitle} editHref={editHref}>
      {kcal.length ? (
        <p className="text-[15px] font-semibold">{kcal.join(" / ")} kcal</p>
      ) : (
        <p className="text-text-subtle text-sm">{t.plan.noMacros}</p>
      )}
      <p className="text-text-muted text-xs">{menusSummary}</p>
    </PlanCard>
  );
}
