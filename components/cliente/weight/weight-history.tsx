import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { reviewUsingWeightLog, type CivilDate, type Review, type WeightLog } from "@/lib/domain";
import { formatCivilDate, formatDecimal } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screens.weight.history;

/** Historial descendente; «Día de revisión» cuando una revisión referencia el pesaje (I9). */
export function WeightHistory({
  logs,
  reviews,
  today,
}: {
  logs: WeightLog[];
  reviews: Review[];
  today: CivilDate;
}) {
  const rows = [...logs].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <Card className="gap-2.5 p-6 py-6">
      <CardHeader className="p-0">
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <EmptyState title={t.emptyTitle} description={t.emptyHint} />
        ) : (
          <ul>
            {rows.map((log, index) => {
              const isToday = log.date === today;
              const isReviewDay = reviewUsingWeightLog(log, reviews) !== null;
              return (
                <li
                  key={log.id}
                  className={cn(
                    "flex items-center justify-between gap-4 px-1 py-3",
                    index < rows.length - 1 && "border-border-subtle border-b",
                  )}
                >
                  <p
                    className={cn("text-[14px]", isToday ? "text-text-primary" : "text-text-muted")}
                  >
                    {isToday ? `${t.today} · ` : ""}
                    {formatCivilDate(log.date)}
                    {log.note ? ` · ${t.note}: ${log.note}` : ""}
                  </p>
                  <div className="flex items-baseline gap-4">
                    {isReviewDay ? (
                      <span className="text-accent-hover text-xs tracking-[1px] uppercase">
                        {t.reviewDay}
                      </span>
                    ) : null}
                    <span className="font-display text-lg font-semibold">
                      {formatDecimal(log.weightKg)} {es.screens.weight.chart.unit}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
