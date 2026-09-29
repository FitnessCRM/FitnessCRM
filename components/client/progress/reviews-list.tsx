import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import {
  groupReviewsByWeekPair,
  isReviewComplete,
  type CivilDate,
  type Review,
  type WeightLog,
} from "@/lib/domain";
import { formatDecimal, formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensProgress.reviews;

function subtitle(review: Review, logs: WeightLog[], today: CivilDate) {
  const date = (review.submittedAt ?? review.createdAt).slice(0, 10);
  const kg = logs.find((l) => l.id === review.weightLogId)?.weightKg;
  if (review.status === "borrador") {
    return `${date === today ? t.today : formatShortDate(date, today)} · ${t.inProgress}`;
  }
  return `${formatShortDate(date, today)}${kg !== undefined ? ` · ${formatDecimal(kg)} kg` : ""}`;
}

/** Histórico agrupado de dos en dos semanas (§8). Una semana saltada no tiene fila. */
export function ReviewsList({
  reviews,
  logs,
  today,
}: {
  reviews: Review[];
  logs: WeightLog[];
  today: CivilDate;
}) {
  if (reviews.length === 0) {
    return <EmptyState title={t.emptyTitle} description={t.emptyHint} />;
  }
  const groups = groupReviewsByWeekPair(reviews);
  const newest = groups[0]?.from;

  return (
    <div className="flex flex-col gap-[18px]">
      {groups.map((group) => (
        <section key={group.from} className="flex flex-col gap-2.5">
          <h3
            className={cn(
              "font-display text-[13px] tracking-wide uppercase",
              group.from === newest ? "text-accent-hover" : "text-text-subtle",
            )}
          >
            {t.week} {group.from}-{group.to}
          </h3>
          {group.reviews.map((review) => {
            const draft = review.status === "borrador";
            const completeness = isReviewComplete(review);
            const done = Object.values(completeness.blocks).filter(Boolean).length;
            const total = Object.keys(completeness.blocks).length;
            return (
              <Link
                key={review.id}
                href={draft ? "/review" : `/view-review?review=${review.id}`}
                className={cn(
                  "bg-surface flex items-center gap-3.5 rounded-xl border px-5 py-4 transition-colors",
                  draft
                    ? "border-accent-outline"
                    : "border-border-subtle hover:border-border-emphasis",
                )}
              >
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">
                    {t.item} {review.weekNumber}
                    {review.weekNumber === 1 ? (
                      <span className="text-text-subtle ml-1.5 text-xs font-normal">
                        {t.initial}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-text-muted text-xs">{subtitle(review, logs, today)}</p>
                </div>
                {draft ? (
                  <span className="text-accent-bright border-accent-outline tracking-label rounded-full border px-2.5 py-1 text-[11px] uppercase">
                    {done}/{total}
                  </span>
                ) : (
                  <span
                    className={cn(
                      "tracking-label text-[11px] uppercase",
                      completeness.complete ? "text-success" : "text-text-muted",
                    )}
                  >
                    {completeness.complete ? t.complete : t.partial}
                  </span>
                )}
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
