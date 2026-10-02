import { PlayIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CivilDate, Review } from "@/lib/domain";
import { civilDateOf, formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensTrainerReview.feedback;

/** Host del enlace, para decir a dónde lleva antes de pulsarlo. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/** Lo que ya se envió al cliente. El feedback no se edita: la revisión pasó a `revisada`. */
export function SentFeedback({
  review,
  today,
  timeZone,
}: {
  review: Review;
  today: CivilDate;
  timeZone: string;
}) {
  const video = review.feedbackVideoUrl;
  const note = review.feedbackNote;
  // Día del feedback en la zona del entrenador, no en UTC.
  const sent = review.reviewedAt ? civilDateOf(review.reviewedAt, timeZone) : undefined;

  return (
    <Card className="border-accent-outline gap-3 px-[22px] py-5">
      <h2 className="section-title">
        {t.sentTitle}
        {sent ? (
          <>
            {" "}
            {t.sentOn} <time dateTime={sent}>{formatShortDate(sent, today)}</time>
          </>
        ) : null}
      </h2>
      {note ? (
        <p className="text-text-muted text-[14px] leading-relaxed whitespace-pre-line">{note}</p>
      ) : null}
      {video ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={video}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-hover hover:text-accent-emphasis focus-visible:ring-ring/50 inline-flex min-h-8 items-center gap-2 rounded-md text-[14px] font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]"
          >
            <PlayIcon aria-hidden className="size-3.5 fill-current" />
            {t.watch}
          </a>
          <p className="text-text-subtle text-xs">
            {t.external} {hostOf(video)}
          </p>
        </div>
      ) : null}
    </Card>
  );
}
