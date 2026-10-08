import type { Ref } from "react";
import {
  menuRemaining,
  menuTotal,
  roundGrams,
  type MacrosDraft,
  type Meal,
  type NutrientKey,
  type RemainingStatus,
} from "@/lib/domain";
import { formatDecimal } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { formatGrams, formatKcal } from "./nutrient-line";

const t = es.editor.menu.tally;
const KEYS: NutrientKey[] = ["kcal", "proteinG", "carbsG", "fatG"];

/** Una cifra declarada que aún no vale (vacía o mal escrita, «2.000») no es un objetivo. */
function declaredOf(macros: MacrosDraft): MacrosDraft {
  const valid = (value: number | null) => (value !== null && Number.isFinite(value) ? value : null);
  return {
    kcal: valid(macros.kcal),
    proteinG: valid(macros.proteinG),
    carbsG: valid(macros.carbsG),
    fatG: valid(macros.fatG),
  };
}

interface TallyFigure {
  nutrient: NutrientKey;
  got: number;
  target: number | null;
  status: RemainingStatus;
  /** Lo que llena la barra: lo que llevas frente a lo declarado, hasta el 100 %. */
  percent: number;
}

/**
 * Lo que dicen el panel y su resumen, calculado una vez: cada cifra frente a lo declarado, si falta
 * declarar alguna y cuántos alimentos escritos a mano no suman.
 */
function tallyOf(macros: MacrosDraft, meals: readonly Pick<Meal, "items">[]) {
  const declared = declaredOf(macros);
  const total = menuTotal({ meals });
  const remaining = menuRemaining(declared, total);
  const figures: TallyFigure[] = KEYS.map((nutrient) => {
    const got = total[nutrient];
    const target = declared[nutrient];
    const percent =
      target === null ? 0 : target > 0 ? Math.min(100, (got / target) * 100) : got > 0 ? 100 : 0;
    return { nutrient, got, target, status: remaining[nutrient], percent };
  });
  // Una fila vacía no es un alimento: no se puede guardar y no se avisa de ella.
  const nonCounting = meals.reduce(
    (count, meal) =>
      count + meal.items.filter((item) => !item.composition && item.name.trim() !== "").length,
    0,
  );
  return { figures, nonCounting, incomplete: KEYS.some((key) => declared[key] === null) };
}

/** El color del texto de una cifra según su estado: igual en el panel y en su resumen. */
const statusText = (status: RemainingStatus) =>
  cn(
    status.status === "over" && "text-danger font-semibold",
    status.status === "matches" && "text-success",
    status.status === "remaining" && "text-text-primary",
    status.status === "no_target" && "text-text-subtle",
  );

function Bar({ figure, className }: { figure: TallyFigure; className?: string }) {
  return (
    <div className={cn("bg-border-strong overflow-hidden rounded-full", className)} aria-hidden>
      <div
        className={cn(
          "h-full rounded-full",
          figure.status.status === "over" ? "bg-danger" : "bg-accent",
        )}
        style={{ width: `${figure.percent}%` }}
      />
    </div>
  );
}

const amountOf = (key: NutrientKey, value: number) =>
  key === "kcal" ? `${formatKcal(value)} ${es.common.kcal}` : `${formatGrams(value)} g`;

/**
 * «Lo que llevas» (I30): lo que suman los alimentos del menú que tienen composición frente a lo que
 * el entrenador declara para ese mismo menú, nunca frente a `MacroTargets` (§5). Avisa de lo que
 * queda o sobra, con el margen de «Cuadra», y de los alimentos escritos a mano, que no suman. No
 * bloquea nada ni rellena las macros declaradas. Es la lectura completa y accesible; el resumen
 * compacto del móvil (`MenuTallyStrip`) solo la repite para la vista.
 */
export function MenuTally({
  macros,
  meals,
  className,
  ref,
}: {
  macros: MacrosDraft;
  meals: readonly Pick<Meal, "items">[];
  className?: string;
  ref?: Ref<HTMLElement>;
}) {
  const { figures, nonCounting, incomplete } = tallyOf(macros, meals);

  return (
    <section
      ref={ref}
      aria-label={t.title}
      className={cn(
        "border-border-strong bg-background flex flex-col gap-3 rounded-[10px] border p-3 xl:gap-4 xl:p-4",
        className,
      )}
    >
      <header>
        <h3 className="font-display tracking-label text-text-muted text-[13px] uppercase">
          {t.title}
        </h3>
        <p className="text-text-subtle text-xs">{t.subtitle}</p>
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 xl:grid-cols-1 xl:gap-y-3.5">
        {figures.map((figure) => (
          <TallyRow key={figure.nutrient} figure={figure} />
        ))}
      </div>

      {incomplete || nonCounting > 0 ? (
        <div className="border-border-subtle flex flex-col gap-1 border-t pt-2.5">
          {incomplete ? <p className="text-text-subtle text-xs">{t.incomplete}</p> : null}
          {nonCounting > 0 ? (
            <p className="text-text-subtle text-xs">
              {(nonCounting === 1 ? t.nonCounting.one : t.nonCounting.other).replace(
                "{n}",
                String(nonCounting),
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function TallyRow({ figure }: { figure: TallyFigure }) {
  const { nutrient, got, target, status } = figure;
  const kcal = nutrient === "kcal";
  const shown = kcal ? formatKcal(got) : formatGrams(got);
  const message =
    status.status === "no_target"
      ? t.noTarget
      : status.status === "matches"
        ? t.matches
        : status.status === "remaining"
          ? t.remaining.replace("{amount}", amountOf(nutrient, status.amount))
          : t.over.replace("{amount}", amountOf(nutrient, status.amount));

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-col xl:flex-row xl:flex-wrap xl:items-baseline xl:justify-between xl:gap-x-2">
        <span className="text-text-subtle tracking-label text-[11px] uppercase">
          {t.rows[nutrient]}
        </span>
        <span className="text-text-muted text-[13px] whitespace-nowrap tabular-nums">
          <b className="font-display text-text-primary text-[17px] font-semibold xl:text-[20px]">
            {shown}
          </b>
          {target !== null ? ` / ${kcal ? formatKcal(target) : formatGrams(target)}` : ""}
          {kcal ? "" : " g"}
        </span>
      </div>
      {target !== null ? <Bar figure={figure} className="h-1.5" /> : null}
      <span className={cn("text-[13px] tabular-nums", statusText(status))}>{message}</span>
    </div>
  );
}

/**
 * La cifra corta del resumen: lo que queda («377», «12,0»), el exceso con signo («+17,5»), «✓» si
 * cuadra y «—» sin cifra declarada. Kcal enteras; gramos siempre con un decimal.
 */
function stripValue({ nutrient, status }: TallyFigure): string {
  if (status.status === "no_target") return t.strip.noTarget;
  if (status.status === "matches") return t.strip.matches;
  const amount =
    nutrient === "kcal" ? formatKcal(status.amount) : formatDecimal(roundGrams(status.amount));
  return status.status === "over" ? t.strip.over.replace("{amount}", amount) : amount;
}

/**
 * Resumen compacto de «Lo que llevas» para el móvil (por debajo de `sm`): una fila de 72 px como
 * mucho, con kcal, P, C y G, que se fija arriba cuando el panel completo sale de la pantalla. Es solo
 * para la vista (`aria-hidden`): lo accesible es el panel, que no cambia.
 */
export function MenuTallyStrip({
  macros,
  meals,
  ref,
}: {
  macros: MacrosDraft;
  meals: readonly Pick<Meal, "items">[];
  ref?: Ref<HTMLDivElement>;
}) {
  const { figures } = tallyOf(macros, meals);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="border-border-strong bg-background grid max-h-[72px] grid-cols-4 gap-3 rounded-[10px] border px-3 py-2 shadow-lg"
    >
      {figures.map((figure) => (
        <div key={figure.nutrient} className="flex min-w-0 flex-col gap-1">
          <span className="text-text-subtle tracking-label text-[11px] leading-none uppercase">
            {t.strip.labels[figure.nutrient]}
          </span>
          <span
            className={cn(
              "font-display truncate text-[15px] leading-tight tabular-nums",
              statusText(figure.status),
            )}
          >
            {stripValue(figure)}
          </span>
          <Bar figure={figure} className="h-1" />
        </div>
      ))}
    </div>
  );
}
