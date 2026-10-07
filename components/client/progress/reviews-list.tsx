"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/ui/states";
import {
  groupReviewsByWeekPair,
  isReviewComplete,
  reviewWeight,
  type CivilDate,
  type Review,
  type WeightLog,
} from "@/lib/domain";
import { civilDateOf, formatDecimal, formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensProgress.reviews;

/**
 * Parejas de semanas que se ven sin pedir más (≈ 6 semanas). El histórico crece una revisión por
 * semana y sin tope la pantalla se alarga cada vez más; el resto queda tras «Ver todas». El borrador
 * en curso está siempre en la pareja más reciente, así que nunca se esconde.
 */
const RECENT_GROUPS = 3;

function subtitle(review: Review, logs: WeightLog[], today: CivilDate, timeZone: string) {
  const date = civilDateOf(review.submittedAt ?? review.createdAt, timeZone);
  const kg = reviewWeight(review, logs)?.weightKg; // I24
  if (review.status === "borrador") {
    return `${date === today ? t.today : formatShortDate(date, today)} · ${t.inProgress}`;
  }
  return `${formatShortDate(date, today)}${kg !== undefined ? ` · ${formatDecimal(kg)} ${es.common.kg}` : ""}`;
}

/** Histórico agrupado de dos en dos semanas (§8). Una semana saltada no tiene fila. */
export function ReviewsList({
  reviews,
  logs,
  today,
  timeZone,
}: {
  reviews: Review[];
  logs: WeightLog[];
  today: CivilDate;
  /** Zona del entrenador: el día de un envío se cuenta en ella, no en UTC. */
  timeZone: string;
}) {
  const [showAll, setShowAll] = useState(false);
  if (reviews.length === 0) {
    return <EmptyState title={t.emptyTitle} description={t.emptyHint} />;
  }
  const groups = groupReviewsByWeekPair(reviews);
  const newest = groups[0]?.from;
  const visible = showAll ? groups : groups.slice(0, RECENT_GROUPS);

  return (
    <div className="flex flex-col gap-[18px]">
      {visible.map((group) => (
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
                  <p className="text-text-muted text-xs">
                    {subtitle(review, logs, today, timeZone)}
                  </p>
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
      {groups.length > RECENT_GROUPS ? (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((open) => !open)}
          className="border-border-emphasis text-text-muted hover:border-accent hover:text-text-primary tracking-label focus-visible:ring-ring/50 inline-flex min-h-8 items-center justify-center self-center rounded-full border px-3.5 py-1.5 text-xs uppercase outline-none focus-visible:ring-[3px]"
        >
          {showAll ? t.showRecent : t.showAll.replace("{n}", String(reviews.length))}
        </button>
      ) : null}
    </div>
  );
}
