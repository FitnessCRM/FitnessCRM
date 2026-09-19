import { Card } from "@/components/ui/card";
import { KCAL_PER_GRAM, derivedKcal, type MacroTargets } from "@/lib/domain";
import { formatInteger, formatNumber } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensMenu.target;

/**
 * El objetivo diario del cliente (`MacroTargets`). Es la cifra que NO hay que confundir con las
 * macros declaradas de cada menú: se titula «Tu objetivo del día» y lo dice en su subtítulo.
 */
export function TargetCard({
  target,
  other,
}: {
  target: MacroTargets | undefined;
  /** Objetivo del otro tipo de día, para la nota al pie. */
  other: MacroTargets | undefined;
}) {
  if (!target) {
    return (
      <Card className="gap-2 px-[22px] py-[22px]">
        <h2 className="section-title">{t.title}</h2>
        <p className="text-text-subtle text-[13px]">{t.empty}</p>
      </Card>
    );
  }

  const kcal = derivedKcal(target.macros);
  const rows = [
    { label: t.protein, grams: target.macros.proteinG, kcal: KCAL_PER_GRAM.protein },
    { label: t.carbs, grams: target.macros.carbsG, kcal: KCAL_PER_GRAM.carbs },
    { label: t.fat, grams: target.macros.fatG, kcal: KCAL_PER_GRAM.fat },
  ];

  return (
    <Card className="gap-4 px-[22px] py-[22px]">
      <div>
        <h2 className="section-title">{t.title}</h2>
        <p className="text-text-subtle mt-1.5 text-[13px] leading-snug">{t.hint}</p>
      </div>
      <p className="font-display leading-none font-bold">
        <span className="text-[40px]">{formatInteger(kcal)}</span>{" "}
        <span className="text-text-muted text-[15px]">{t.kcal}</span>
      </p>
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const share = kcal === 0 ? 0 : (row.grams * row.kcal) / kcal;
          return (
            <div key={row.label} title={`${Math.round(share * 100)} % ${t.shareOfKcal}`}>
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-text-primary">{row.label}</span>
                <span className="text-text-muted">
                  {formatNumber(row.grams)} {es.screensMenu.menus.grams}
                </span>
              </div>
              <div className="bg-surface-overlay mt-1.5 h-1.5 overflow-hidden rounded-full">
                <div
                  className="bg-accent h-full rounded-full"
                  style={{ width: `${share * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {other ? (
        <p className="text-text-subtle text-[13px] leading-snug">
          {t.otherPrefix} {es.status.dayTypeShort[other.dayType]} {t.otherMiddle}{" "}
          {formatInteger(derivedKcal(other.macros))} {t.kcal}.
        </p>
      ) : null}
    </Card>
  );
}
