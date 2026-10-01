import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import {
  groupReviewsByWeekPair,
  isReviewComplete,
  reviewWeight,
  type CivilDate,
  type Review,
  type WeightLog,
} from "@/lib/domain";
import { formatDecimal, formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensClientDetail.reviews;

function subtitle(review: Review, logs: WeightLog[], today: CivilDate) {
  if (review.status === "borrador") {
    const values = Object.values(isReviewComplete(review).blocks);
    return `${t.inProgress} ${values.filter(Boolean).length}/${values.length}`;
  }
  const completeness = isReviewComplete(review).complete ? t.complete : t.partial;
  if (review.status === "revisada") {
    const sent = review.reviewedAt ? formatShortDate(review.reviewedAt.slice(0, 10), today) : null;
    return [es.status.review.revisada, sent ? `${t.feedbackSent} ${sent}` : null]
      .filter(Boolean)
      .join(" · ");
  }
  const date = (review.submittedAt ?? review.createdAt).slice(0, 10);
  const kg = weightOf(review, logs);
  const parts = [date === today ? t.today : formatShortDate(date, today)];
  // La revisión nueva enseña su peso en el subtítulo; las demás lo llevan a la derecha.
  if (review.status === "enviada" && kg !== undefined) parts.push(`${formatDecimal(kg)} kg`);
  parts.push(completeness);
  return parts.join(" · ");
}

function weightOf(review: Review, logs: WeightLog[]) {
  return reviewWeight(review, logs)?.weightKg; // I24
}

/** Histórico de dos en dos semanas (§8). La revisión «enviada» es la pendiente: lleva «Nueva». */
export function ReviewsHistory({
  clientId,
  reviews,
  logs,
  today,
}: {
  clientId: string;
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
              "font-display tracking-label text-[13px] uppercase",
              group.from === newest ? "text-accent-hover" : "text-text-subtle",
            )}
          >
            {t.week} {group.from}-{group.to}
          </h3>
          {group.reviews.map((review) => {
            const fresh = review.status === "enviada";
            const row = (
              <>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">
                    {t.week} {review.weekNumber}
                    {review.weekNumber === 1 ? (
                      <span className="text-text-subtle ml-1.5 text-xs font-normal">
                        {t.initial}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-text-muted text-xs">{subtitle(review, logs, today)}</p>
                </div>
                {!fresh && weightOf(review, logs) !== undefined ? (
                  <span className="text-text-muted self-start text-xs">
                    {formatDecimal(weightOf(review, logs)!)} kg
                  </span>
                ) : null}
                {fresh ? (
                  <span className="bg-accent text-on-accent tracking-label rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase">
                    {es.status.review.enviada}
                  </span>
                ) : null}
              </>
            );
            const base = "bg-surface flex items-center gap-3.5 rounded-xl border px-5 py-4";
            // El borrador es del cliente: el entrenador lo ve avanzar, pero aún no hay qué abrir.
            return review.status === "borrador" ? (
              <div key={review.id} className={cn(base, "border-border-subtle")}>
                {row}
              </div>
            ) : (
              <Link
                key={review.id}
                href={`/clients/${clientId}/review?review=${review.id}`}
                className={cn(
                  base,
                  "transition-colors",
                  fresh
                    ? "border-accent-outline"
                    : "border-border-subtle hover:border-border-emphasis",
                )}
              >
                {row}
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
