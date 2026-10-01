"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnswersCard } from "@/components/review/answers-card";
import { ReviewPhotos } from "@/components/review/review-photos";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { EmptyState } from "@/components/ui/states";
import { reviewWeight, type CivilDate, type Review, type WeightLog } from "@/lib/domain";
import { useClientReviews, useSessionClientId, useTrainer, useWeightLogs } from "@/lib/data/hooks";
import { formatDecimal, formatShortDate, todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { FeedbackCard } from "./feedback-card";
import { SummaryBar } from "./summary-bar";

const t = es.screensViewReview;

/** Fecha con la que se identifica una revisión enviada: cuándo se envió (si no, cuándo se abrió). */
const dateOf = (review: Review): CivilDate => (review.submittedAt ?? review.createdAt).slice(0, 10);

/**
 * Pantalla 08 · Ver revisión. Solo lectura de una revisión ya enviada: cifras, fotos, respuestas
 * congeladas y el feedback del entrenador, cuyo vídeo es un enlace externo (I20).
 */
export function ViewReviewScreen() {
  const clientId = useSessionClientId();
  const trainer = useTrainer();
  const reviews = useClientReviews(clientId);
  const logs = useWeightLogs(clientId);
  const today = todayCivil(trainer.data?.timeZone);

  return (
    <div className="flex flex-col gap-6">
      <QueryBoundary
        query={reviews}
        isEmpty={(data) => (data ?? []).every((r) => r.status === "borrador")}
        empty={
          <>
            <PageHeader eyebrow={t.eyebrow} title={es.pages.client.verRevision} />
            <EmptyState title={t.empty.title} description={t.empty.hint} />
          </>
        }
      >
        {(data) => <ViewReview reviews={data} logs={logs.data ?? []} today={today} />}
      </QueryBoundary>
    </div>
  );
}

function ViewReview({
  reviews,
  logs,
  today,
}: {
  reviews: Review[];
  logs: WeightLog[];
  today: CivilDate;
}) {
  const router = useRouter();
  const requested = useSearchParams().get("review");

  // Los borradores se rellenan en Revisión, no se leen aquí.
  const sent = [...reviews]
    .filter((r) => r.status !== "borrador")
    .sort((a, b) => b.weekNumber - a.weekNumber);
  const review = sent.find((r) => r.id === requested) ?? sent[0]!;
  const previous = sent.find((r) => r.weekNumber < review.weekNumber);
  const weightOf = (r: Review | undefined) => (r ? reviewWeight(r, logs)?.weightKg : undefined);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader eyebrow={t.eyebrow} title={es.pages.client.verRevision} />
        <label className="flex flex-col gap-1.5">
          <span className="text-text-subtle tracking-label text-[11px] uppercase">
            {t.picker.label}
          </span>
          <select
            value={review.id}
            onChange={(event) => router.replace(`/view-review?review=${event.target.value}`)}
            className="border-accent-outline bg-surface text-text-primary focus-visible:ring-ring/50 h-11 rounded-md border px-3.5 text-[14px] outline-none focus-visible:ring-[3px]"
          >
            {sent.map((r, index) => (
              <option key={r.id} value={r.id}>
                {es.screensReview.week} {r.weekNumber} · {formatShortDate(dateOf(r), today)}
                {index === 0 ? ` · ${t.picker.latest}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* En móvil las dos columnas se disuelven (`contents`) y el orden lo pone cada bloque: el
          feedback sube justo después de las cifras, que es a lo que viene el cliente, en vez de
          quedar debajo de las fotos y las respuestas. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[1fr_400px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-4 max-lg:contents">
          <SummaryBar
            className="max-lg:order-1"
            review={review}
            weightKg={weightOf(review)}
            previousWeightKg={weightOf(previous)}
            previousWeek={previous?.weekNumber}
          />
          <div className="max-lg:order-3">
            <ReviewPhotos review={review} />
          </div>
          <div className="max-lg:order-4">
            <AnswersCard review={review} title={t.answers.title} emptyHint={t.answers.none} />
          </div>
        </div>

        <div className="flex flex-col gap-4 max-lg:contents">
          <div className="max-lg:order-2">
            <FeedbackCard review={review} />
          </div>
          <div className="flex flex-col gap-4 max-lg:order-5">
            <h2 className="section-title mt-1">{t.others.title}</h2>
            <OtherReviews reviews={sent} currentId={review.id} logs={logs} today={today} />
          </div>
        </div>
      </div>
    </>
  );
}

function OtherReviews({
  reviews,
  currentId,
  logs,
  today,
}: {
  reviews: Review[];
  currentId: string;
  logs: WeightLog[];
  today: CivilDate;
}) {
  const others = reviews.filter((r) => r.id !== currentId);
  if (others.length === 0) return <p className="text-text-subtle text-[13px]">{t.others.none}</p>;

  return (
    <div className="flex flex-col gap-2.5">
      {others.map((r) => {
        const kg = reviewWeight(r, logs)?.weightKg; // I24
        return (
          <Link
            key={r.id}
            href={`/view-review?review=${r.id}`}
            className={cn(
              "bg-surface border-border-subtle hover:border-border-emphasis rounded-xl border px-5 py-3.5 transition-colors",
            )}
          >
            <p className="text-[15px] font-semibold">
              {es.screensReview.week} {r.weekNumber} ·{" "}
              <time dateTime={dateOf(r)}>{formatShortDate(dateOf(r), today)}</time>
            </p>
            <p className="text-text-muted text-xs">
              {kg !== undefined ? `${formatDecimal(kg)} kg` : t.summary.noWeight}
              {r.feedbackVideoUrl ? ` · ${t.others.withVideo}` : ""}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
