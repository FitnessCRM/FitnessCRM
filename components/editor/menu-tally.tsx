import {
  menuRemaining,
  menuTotal,
  type MacrosDraft,
  type Meal,
  type NutrientKey,
  type RemainingStatus,
} from "@/lib/domain";
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

const amountOf = (key: NutrientKey, value: number) =>
  key === "kcal" ? `${formatKcal(value)} ${es.common.kcal}` : `${formatGrams(value)} g`;

/**
 * «Lo que llevas» (I30): lo que suman los alimentos del menú que tienen composición frente a lo que
 * el entrenador declara para ese mismo menú, nunca frente a `MacroTargets` (§5). Avisa de lo que
 * queda o sobra, con el margen de «Cuadra», y de los alimentos escritos a mano, que no suman. No
 * bloquea nada ni rellena las macros declaradas.
 */
export function MenuTally({
  macros,
  meals,
  className,
}: {
  macros: MacrosDraft;
  meals: readonly Pick<Meal, "items">[];
  className?: string;
}) {
  const declared = declaredOf(macros);
  const total = menuTotal({ meals });
  const remaining = menuRemaining(declared, total);
  // Una fila vacía no es un alimento: no se puede guardar y no se avisa de ella.
  const nonCounting = meals.reduce(
    (count, meal) =>
      count + meal.items.filter((item) => !item.composition && item.name.trim() !== "").length,
    0,
  );
  const incomplete = KEYS.some((key) => declared[key] === null);

  return (
    <section
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
        {KEYS.map((key) => (
          <TallyRow
            key={key}
            nutrient={key}
            got={total[key]}
            target={declared[key]}
            status={remaining[key]}
          />
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

function TallyRow({
  nutrient,
  got,
  target,
  status,
}: {
  nutrient: NutrientKey;
  got: number;
  target: number | null;
  status: RemainingStatus;
}) {
  const kcal = nutrient === "kcal";
  const shown = kcal ? formatKcal(got) : formatGrams(got);
  const percent =
    target === null ? 0 : target > 0 ? Math.min(100, (got / target) * 100) : got > 0 ? 100 : 0;
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
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
      {target !== null ? (
        <div className="bg-border-strong h-1.5 overflow-hidden rounded-full" aria-hidden>
          <div
            className={cn(
              "h-full rounded-full",
              status.status === "over" ? "bg-danger" : "bg-accent",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      <span
        className={cn(
          "text-[13px] tabular-nums",
          status.status === "over" && "text-danger font-semibold",
          status.status === "matches" && "text-success",
          status.status === "remaining" && "text-text-primary",
          status.status === "no_target" && "text-text-subtle",
        )}
      >
        {message}
      </span>
    </div>
  );
}
