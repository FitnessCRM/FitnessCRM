import { civilDaysBetween, type CivilDate } from "@/lib/domain";
import { formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensClientDetail.previous;

export interface TimelineSegment {
  key: string;
  label: string;
  from: CivilDate;
  /** `null` = sigue en uso. */
  to: CivilDate | null;
}

export interface TimelineLane {
  key: string;
  label: string;
  segments: TimelineSegment[];
}

/**
 * Lo que ocupa un carácter de una fecha del eje, en % del ancho del eje (unos 6 px de 11 px de
 * letra sobre unos 480 px), y el aire que se deja entre dos fechas. Sirve para descartar las que se
 * pisarían sin medir el DOM.
 */
const AXIS_CHAR = 1.3;
const AXIS_PAD = 2;

/**
 * Los planes de un cliente sobre un eje de días, un carril por rutina y por tipo de día de los
 * menús. Es un adorno del listado de debajo, que lleva los mismos datos con todo su detalle, así que
 * no lo lee un lector de pantalla y se pinta solo en escritorio y tablet ancho (`lg`): en móvil los
 * carriles dejarían las barras sin ancho para leerse. Con `selection`, lo que cae dentro se
 * destaca y lo demás se apaga.
 */
export function PlansTimeline({
  lanes,
  start,
  today,
  changeDays,
  selection,
}: {
  lanes: TimelineLane[];
  start: CivilDate;
  today: CivilDate;
  changeDays: CivilDate[];
  selection: { start: CivilDate; end: CivilDate } | null;
}) {
  const total = Math.max(1, civilDaysBetween(start, today));
  const pct = (date: CivilDate) =>
    Math.min(100, Math.max(0, (civilDaysBetween(start, date) / total) * 100));

  const selectionLeft = selection ? pct(selection.start) : 0;
  const selectionWidth = selection
    ? Math.min(
        100 - selectionLeft,
        ((civilDaysBetween(selection.start, selection.end) + 1) / total) * 100,
      )
    : 0;

  // Fechas del eje por prioridad: la selección, el inicio, hoy y, si caben, los cambios.
  const candidates: { key: string; text: string; at: number; align: "start" | "end" | "center" }[] =
    [];
  if (selection) {
    const text =
      selection.start === selection.end
        ? formatShortDate(selection.start, today)
        : `${formatShortDate(selection.start, today)} – ${formatShortDate(selection.end, today)}`;
    candidates.push({ key: "selection", text, at: selectionLeft, align: "start" });
  }
  candidates.push({ key: "start", text: formatShortDate(start, today), at: 0, align: "start" });
  candidates.push({ key: "today", text: t.today, at: 100, align: "end" });
  for (const day of changeDays) {
    candidates.push({ key: day, text: formatShortDate(day, today), at: pct(day), align: "center" });
  }
  const extent = (c: (typeof candidates)[number]): [number, number] => {
    const width = c.text.length * AXIS_CHAR;
    if (c.align === "end") return [100 - width, 100];
    if (c.align === "center") return [c.at - width / 2, c.at + width / 2];
    return [c.at, c.at + width];
  };
  const axis: typeof candidates = [];
  for (const c of candidates) {
    const [lo, hi] = extent(c);
    const clear = axis.every((kept) => {
      const [keptLo, keptHi] = extent(kept);
      return hi + AXIS_PAD <= keptLo || lo >= keptHi + AXIS_PAD;
    });
    if (clear) axis.push(c);
  }

  return (
    <div
      aria-hidden
      className="border-border-subtle hidden gap-3 rounded-lg border px-4 pt-3.5 pb-4 lg:flex"
    >
      <div className="flex w-[92px] shrink-0 flex-col gap-1.5 pt-7">
        {lanes.map((lane) => (
          <p key={lane.key} className="text-text-muted flex h-[34px] items-center text-xs">
            {lane.label}
          </p>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="text-text-muted relative h-[22px] text-[11px]">
          {axis.map((c) => (
            <span
              key={c.key}
              className={cn(
                "absolute whitespace-nowrap",
                c.key === "selection" && "text-text-primary font-semibold",
                c.align === "end" && "right-0",
                c.align === "center" && "-translate-x-1/2",
              )}
              style={c.align === "end" ? undefined : { left: `${c.at}%` }}
            >
              {c.text}
            </span>
          ))}
        </div>
        <div className="relative flex flex-col gap-1.5">
          {lanes.map((lane) => (
            <div key={lane.key} className="relative h-[34px]">
              {lane.segments.map((segment) => {
                const left = pct(segment.from);
                const right = pct(segment.to ?? today);
                const inSelection =
                  selection !== null &&
                  segment.from <= selection.end &&
                  (segment.to === null || segment.to >= selection.start);
                const emphasised = selection === null ? segment.to === null : inSelection;
                return (
                  <div
                    key={segment.key}
                    title={segment.label}
                    className={cn(
                      "absolute inset-y-0 flex min-w-[3px] items-center overflow-hidden rounded-sm border px-2 text-xs whitespace-nowrap",
                      emphasised
                        ? selection === null
                          ? "border-accent-strong bg-accent-soft font-semibold"
                          : "border-border-emphasis bg-surface-raised"
                        : "border-border-subtle text-text-muted",
                    )}
                    style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
                  >
                    <span className="truncate">{segment.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {selection ? (
            <div
              className="border-accent bg-accent-soft pointer-events-none absolute -inset-y-1 rounded-sm border-2"
              style={{ left: `${selectionLeft}%`, width: `${selectionWidth}%` }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
