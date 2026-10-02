import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FrozenWeight } from "@/lib/domain";
import { formatCivilDate, formatDecimal } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensReview.weight;

/**
 * Peso de la revisión; no se escribe aquí. `weight` es el que vale ahora (I24): el pesaje enlazado
 * mientras es editable, la copia desde `vista`. `next` es el pesaje más reciente de la ventana
 * cuando no es el enlazado: el que tomará la revisión al guardarla.
 */
export function WeightBlock({
  weight,
  next = null,
}: {
  weight: FrozenWeight | null;
  next?: FrozenWeight | null;
}) {
  return (
    <Card className="gap-3 p-6 py-6">
      <div className="flex flex-row items-center gap-5">
        <div className="flex-1">
          <p className="font-display tracking-label text-[16px] font-semibold uppercase">
            {t.title}
          </p>
          <p className="text-text-muted mt-1 text-[13px]">
            {weight ? `${t.taken} ${formatCivilDate(weight.date)}` : t.missing}
          </p>
        </div>
        {weight ? (
          <>
            <p className="font-display text-[34px] leading-none font-bold">
              {formatDecimal(weight.weightKg)}{" "}
              <span className="text-text-muted text-[16px]">{t.unit}</span>
            </p>
            <span aria-hidden className="text-success text-xs">
              ✓
            </span>
          </>
        ) : (
          <Button asChild variant="secondary" size="sm">
            <Link href="/weight">{t.goToWeight}</Link>
          </Button>
        )}
      </div>
      {next ? (
        <p className="text-text-muted text-[13px]">
          {t.willUpdate
            .replace("{date}", formatCivilDate(next.date))
            .replace("{kg}", formatDecimal(next.weightKg))}
        </p>
      ) : null}
    </Card>
  );
}
