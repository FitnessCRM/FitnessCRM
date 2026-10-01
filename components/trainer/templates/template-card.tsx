import { EllipsisIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  civilDateInTimeZone,
  countTemplateDayTypes,
  countTemplateExercises,
  type CivilDate,
} from "@/lib/domain";
import type { MenuTemplateSummary, RoutineTemplateSummary } from "@/lib/data/ports";
import { formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensTemplates;

export type TemplateItem =
  | { kind: "routine"; template: RoutineTemplateSummary }
  | { kind: "menu"; template: MenuTemplateSummary };

function plural(n: number, forms: { one: string; other: string }) {
  return `${n} ${n === 1 ? forms.one : forms.other}`;
}

/** Resumen derivado del contenido: días y ejercicios, o tipos de día y menús. */
function details(item: TemplateItem): string {
  const parts =
    item.kind === "routine"
      ? [
          plural(item.template.days.length, t.days),
          item.template.description,
          plural(countTemplateExercises(item.template), t.exercises),
        ]
      : [
          plural(countTemplateDayTypes(item.template), t.dayTypes),
          item.template.description,
          plural(item.template.menus.length, t.menus),
        ];
  return parts.filter(Boolean).join(" · ");
}

function usageLabel(count: number): string {
  if (count === 0) return t.usage.none;
  return count === 1 ? t.usage.one : t.usage.other.replace("{n}", String(count));
}

/**
 * Tarjeta de plantilla: tipo, nombre, resumen del contenido y, a pie, a cuántos clientes se ha
 * copiado y cuándo se editó. El menú «⋯» ofrece duplicar y eliminar.
 */
export function TemplateCard({
  item,
  today,
  timeZone,
  onDuplicate,
  onDelete,
}: {
  item: TemplateItem;
  today: CivilDate;
  timeZone: string | undefined;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { template } = item;
  const edited = civilDateInTimeZone(template.updatedAt, timeZone ?? "Europe/Madrid");
  return (
    <article className="border-border-subtle bg-surface flex flex-col rounded-xl border p-5">
      <div className="flex items-start justify-between gap-3">
        <Badge variant={item.kind === "routine" ? "destructive" : "outline"}>
          {item.kind === "routine" ? t.kindRoutine : t.kindMenu}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`${t.options}: ${template.name}`}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onDuplicate}>{t.duplicate}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              {t.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h2 className="font-display mt-3 text-[20px] font-bold uppercase">{template.name}</h2>
      <p className="text-text-muted mt-1 text-[13px]">{details(item)}</p>
      <p className="border-border-subtle text-text-subtle mt-4 border-t pt-3 text-xs">
        {usageLabel(template.usageCount)} · {t.edited}{" "}
        <time dateTime={edited}>{formatShortDate(edited, today)}</time>
      </p>
    </article>
  );
}
