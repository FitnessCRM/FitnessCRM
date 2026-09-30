import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import type { Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { initialsOf } from "@/lib/utils";
import { isReviewComplete } from "@/lib/domain";

const t = es.components.dashboard;
const tStatus = es.status.review;

type ReviewWithClient = Review & { clientName: string };

export function RecentReviews({
  reviews,
  page,
  total,
  pageSize,
  onPageChange,
}: {
  reviews: ReviewWithClient[];
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-6">
      <h2 className="text-text-primary text-sm font-semibold tracking-wider uppercase">
        {t.recentReviews}
      </h2>

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <p className="text-text-muted text-sm">{t.noReviews}</p>
        ) : (
          reviews.map((review) => <ReviewRow key={review.id} review={review} />)
        )}
      </div>

      {totalPages > 1 && (
        <div className="border-border-emphasis mt-4 flex items-center justify-between gap-2 border-t pt-4">
          <span className="text-text-muted text-xs">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page === totalPages - 1}
              onClick={() => onPageChange(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewRow({ review }: { review: ReviewWithClient }) {
  const isComplete = isReviewComplete(review, review.requirements);
  const badgeType = review.status === "enviada" ? "nueva" : isComplete ? "completa" : "parcial";

  const nameParts = review.clientName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  return (
    <div className="border-border-emphasis bg-surface-raised flex items-center gap-3 rounded-md border p-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <InitialsAvatar initials={initialsOf(firstName, lastName)} />
          <div className="min-w-0 flex-1">
            <p className="text-text-primary text-sm font-medium">{review.clientName}</p>
            <p className="text-text-muted text-xs">Semana {review.weekNumber}</p>
          </div>
        </div>
      </div>

      <ReviewBadge type={badgeType} />
    </div>
  );
}

function ReviewBadge({ type }: { type: "nueva" | "parcial" | "completa" }) {
  const badgeConfig: Record<typeof type, { label: string; variant: "destructive" | "secondary" }> =
    {
      nueva: { label: tStatus.enviada, variant: "destructive" },
      parcial: { label: es.status.reviewCompleteness.partial, variant: "secondary" },
      completa: { label: es.status.reviewCompleteness.complete, variant: "secondary" },
    };

  const config = badgeConfig[type];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
