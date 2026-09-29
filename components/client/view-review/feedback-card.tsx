import { PlayIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensViewReview.feedback;

/** Host del enlace, para decir a dónde lleva antes de pulsarlo. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Feedback del entrenador. El vídeo es **siempre un enlace externo** (I20): la app no aloja
 * vídeo, así que se abre en una pestaña nueva y se dice de dónde viene antes de pulsar.
 */
export function FeedbackCard({ review }: { review: Review }) {
  const { feedbackVideoUrl: video, feedbackNote: note } = review;

  if (!video && !note) {
    return (
      <Card className="gap-2 px-[22px] py-[22px]">
        <h2 className="section-title">{t.pendingTitle}</h2>
        <p className="text-text-subtle text-[13px] leading-snug">
          {review.status === "vista" ? t.pendingSeen : t.pendingSent}
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-accent-outline gap-0 overflow-hidden px-0 py-0">
      {video ? (
        <div className="flex h-[180px] items-center justify-center bg-[repeating-linear-gradient(45deg,var(--color-surface-raised),var(--color-surface-raised)_8px,var(--color-surface-overlay)_8px,var(--color-surface-overlay)_16px)]">
          <span
            aria-hidden
            className="bg-accent text-on-accent flex size-14 items-center justify-center rounded-full pl-1"
          >
            <PlayIcon className="size-6 fill-current" />
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-3 px-[22px] py-5">
        <h2 className="font-display text-[17px] font-bold uppercase">
          {video ? t.videoTitle : t.title} — {es.screensReview.week} {review.weekNumber}
        </h2>
        {note ? (
          <p className="text-text-muted text-[14px] leading-relaxed whitespace-pre-line">{note}</p>
        ) : null}
        {video ? (
          <>
            <a
              href={video}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-accent text-on-accent hover:bg-accent-hover font-display tracking-label focus-visible:ring-ring/50 flex h-11 items-center justify-center gap-2 rounded-md text-[14px] font-semibold uppercase outline-none focus-visible:ring-[3px]"
            >
              <PlayIcon aria-hidden className="size-3.5 fill-current" />
              {t.watch}
            </a>
            <p className="text-text-subtle text-xs leading-snug">
              {t.external} {hostOf(video)}
            </p>
          </>
        ) : null}
      </div>
    </Card>
  );
}
