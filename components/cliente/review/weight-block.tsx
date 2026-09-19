import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { WeightLog } from "@/lib/domain";
import { formatCivilDate, formatDecimal } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensReview.weight;

/** I9: el peso es el pesaje más reciente dentro de la ventana; no se escribe aquí. */
export function WeightBlock({ log }: { log: WeightLog | null }) {
  return (
    <Card className="flex-row items-center gap-5 p-6 py-6">
      <div className="flex-1">
        <p className="font-display tracking-label text-[16px] font-semibold uppercase">{t.title}</p>
        <p className="text-text-muted mt-1 text-[13px]">
          {log ? `${t.taken} ${formatCivilDate(log.date)}` : t.missing}
        </p>
      </div>
      {log ? (
        <>
          <p className="font-display text-[34px] leading-none font-bold">
            {formatDecimal(log.weightKg)}{" "}
            <span className="text-text-muted text-[16px]">{t.unit}</span>
          </p>
          <span aria-hidden className="text-success text-xs">
            ✓
          </span>
        </>
      ) : (
        <Button asChild variant="secondary" size="sm">
          <Link href="/peso">{t.goToWeight}</Link>
        </Button>
      )}
    </Card>
  );
}
