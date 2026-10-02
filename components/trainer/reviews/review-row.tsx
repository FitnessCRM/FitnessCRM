import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import type { ReviewTrackingRow } from "@/lib/data/ports";
import { isReviewComplete } from "@/lib/domain";
import type { CivilDate } from "@/lib/domain";
import { civilDateOf, formatCivilDate, formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";

const t = es.screensReviews;

/** Columnas de escritorio; por debajo de `lg` la fila se apila como tarjeta. */
export const ROW_GRID = "lg:grid lg:grid-cols-[2fr_0.6fr_1fr_1fr_1fr] lg:gap-4";

/** Etiqueta de la celda: solo por debajo de `lg`, donde no hay cabecera de columnas. */
function CellLabel({ children }: { children: string }) {
  return (
    <span className="tracking-label text-text-subtle text-[11px] uppercase lg:hidden">
      {children}
    </span>
  );
}

export function ReviewRow({
  row,
  today,
  timeZone,
}: {
  row: ReviewTrackingRow;
  today: CivilDate;
  timeZone: string;
}) {
  const { review, client } = row;
  const fullName = `${client.firstName} ${client.lastName}`;
  // Día del envío en la zona del entrenador, no en UTC.
  const sentOn = review.submittedAt ? civilDateOf(review.submittedAt, timeZone) : null;
  const complete = isReviewComplete(review, review.requirements);

  return (
    <li className="border-border-subtle border-b last:border-b-0">
      <Link
        href={`/clients/${client.id}/review?review=${review.id}&from=reviews`}
        aria-label={`${t.openReview} ${fullName}, ${t.weekShort}${review.weekNumber}`}
        className={cn(
          ROW_GRID,
          "hover:bg-surface-raised/50 focus-visible:ring-ring/50 grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset lg:items-center",
        )}
      >
        <span className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
          <InitialsAvatar initials={initialsOf(client.firstName, client.lastName)} />
          <span className="text-text-primary min-w-0 truncate font-semibold">{fullName}</span>
        </span>

        <span className="flex flex-col gap-1">
          <CellLabel>{t.columns.week}</CellLabel>
          <span className="text-text-muted text-[13px] lg:text-[14px]">
            {t.weekShort}
            {review.weekNumber}
          </span>
        </span>

        <span className="flex flex-col gap-1">
          <CellLabel>{t.columns.sent}</CellLabel>
          {sentOn ? (
            <time
              dateTime={sentOn}
              title={formatCivilDate(sentOn)}
              className="text-text-muted text-[13px] lg:text-[14px]"
            >
              {formatShortDate(sentOn, today)}
            </time>
          ) : (
            <span className="text-text-subtle text-[13px]">—</span>
          )}
        </span>

        <span className="flex flex-col items-start gap-1">
          <CellLabel>{t.columns.status}</CellLabel>
          <Badge variant={review.status === "enviada" ? "default" : "outline"}>
            {es.status.review[review.status]}
          </Badge>
        </span>

        <span className="flex flex-col items-start gap-1">
          <CellLabel>{t.columns.content}</CellLabel>
          <span className={cn("text-[13px]", complete ? "text-success" : "text-text-muted")}>
            {complete
              ? es.status.reviewCompleteness.complete
              : es.status.reviewCompleteness.partial}
          </span>
        </span>
      </Link>
    </li>
  );
}
