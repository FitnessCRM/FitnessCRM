import { Card } from "@/components/ui/card";
import type { WeightSummary } from "@/lib/domain";
import { formatDecimal, formatSignedDecimal } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screens.weight.summary;

function Stat({ value, label, className }: { value: string; label: string; className?: string }) {
  return (
    <div>
      <p className={cn("font-display text-[30px] leading-none font-bold", className)}>{value}</p>
      <p className="text-text-subtle mt-1.5 text-xs tracking-[1px] uppercase">{label}</p>
    </div>
  );
}

/** Las tres cifras de la demo. Su definición vive en `lib/domain/weight.ts`, no aquí. */
export function WeightSummaryCard({ summary }: { summary: WeightSummary }) {
  const delta = summary.changeSinceStart;
  return (
    <Card className="flex-row gap-6 px-[22px] py-[22px]">
      <Stat
        value={summary.latest ? formatDecimal(summary.latest.weightKg) : t.none}
        label={t.latest}
      />
      <Stat
        value={summary.sevenDayAverage !== null ? formatDecimal(summary.sevenDayAverage) : t.none}
        label={t.sevenDayAverage}
      />
      <Stat
        value={delta !== null ? formatSignedDecimal(delta) : t.none}
        label={t.sinceStart}
        className={delta !== null && delta < 0 ? "text-success" : undefined}
      />
    </Card>
  );
}
