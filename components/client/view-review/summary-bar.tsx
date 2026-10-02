import { Card } from "@/components/ui/card";
import { isReviewComplete, type Review } from "@/lib/domain";
import { formatDecimal, formatSignedDecimal } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensViewReview.summary;

/** Cabecera de cifras: peso, las dos primeras medidas, el cambio de peso y si quedó completa. */
export function SummaryBar({
  className,
  review,
  weightKg,
  previousWeightKg,
  previousWeek,
}: {
  className?: string;
  review: Review;
  weightKg: number | undefined;
  previousWeightKg: number | undefined;
  previousWeek: number | undefined;
}) {
  const measurements = review.measurements.slice(0, 2);
  const delta =
    weightKg !== undefined && previousWeightKg !== undefined
      ? weightKg - previousWeightKg
      : undefined;
  const complete = isReviewComplete(review).complete;

  return (
    <Card
      className={cn("flex-row flex-wrap items-end justify-between gap-6 px-[22px] py-5", className)}
    >
      <div className="flex flex-wrap items-end gap-x-9 gap-y-4">
        <Figure
          label={t.weight}
          value={weightKg === undefined ? t.noWeight : `${formatDecimal(weightKg)} ${es.common.kg}`}
        />
        {measurements.map((m) => (
          <Figure key={m.id} label={m.label} value={`${formatDecimal(m.value)} ${m.unit}`} />
        ))}
        {delta !== undefined && previousWeek !== undefined ? (
          <Figure
            label={`${t.versus} ${previousWeek}`}
            value={`${formatSignedDecimal(delta)} ${es.common.kg}`}
          />
        ) : null}
      </div>
      <p
        className={cn(
          "tracking-label text-[13px] uppercase",
          complete ? "text-success" : "text-text-muted",
        )}
      >
        {complete ? t.complete : t.partial}
      </p>
    </Card>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-text-subtle tracking-label text-[11px] uppercase">{label}</p>
      <p className="font-display mt-1 text-[24px] leading-none font-bold">{value}</p>
    </div>
  );
}
