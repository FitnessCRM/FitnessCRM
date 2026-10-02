import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import type { ReviewTrackingRow } from "@/lib/data/ports";
import { es } from "@/lib/i18n/es";
import { initialsOf } from "@/lib/utils";
import { isReviewComplete } from "@/lib/domain";

const t = es.components.dashboard;
const tStatus = es.status.review;

/** Las revisiones `enviada` más recientes, cada una con su cliente: nunca un nombre que falte. */
export function RecentReviews({ rows }: { rows: ReviewTrackingRow[] }) {
  return (
    <div className="border-border bg-surface flex flex-col gap-4 rounded-lg border p-6">
      <h2 className="text-text-primary text-sm font-semibold tracking-wider uppercase">
        {t.recentReviews}
      </h2>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-text-muted text-sm">{t.noReviews}</p>
        ) : (
          rows.map((row) => <ReviewRow key={row.review.id} row={row} />)
        )}
      </div>

      <Button asChild variant="link" size="sm" className="self-start px-0">
        <Link href="/reviews">{t.seeAll}</Link>
      </Button>
    </div>
  );
}

function ReviewRow({ row }: { row: ReviewTrackingRow }) {
  const { review, client } = row;
  const isComplete = isReviewComplete(review, review.requirements);
  const badgeType = review.status === "enviada" ? "nueva" : isComplete ? "completa" : "parcial";
  const clientName = `${client.firstName} ${client.lastName}`;

  return (
    <Link
      href={`/clients/${review.clientId}/review?review=${review.id}&from=dashboard`}
      className="border-border-emphasis bg-surface-raised hover:border-accent-outline focus-visible:ring-ring/50 flex items-center gap-3 rounded-md border p-3 transition-colors outline-none focus-visible:ring-[3px]"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <InitialsAvatar initials={initialsOf(client.firstName, client.lastName)} />
          <div className="min-w-0 flex-1">
            <p className="text-text-primary text-sm font-medium">{clientName}</p>
            <p className="text-text-muted text-xs">
              {es.common.week} {review.weekNumber}
            </p>
          </div>
        </div>
      </div>

      <ReviewBadge type={badgeType} />
    </Link>
  );
}

function ReviewBadge({ type }: { type: "nueva" | "parcial" | "completa" }) {
  const badgeConfig: Record<typeof type, { label: string; variant: "default" | "outline" }> = {
    nueva: { label: tStatus.enviada, variant: "default" },
    parcial: { label: es.status.reviewCompleteness.partial, variant: "outline" },
    completa: { label: es.status.reviewCompleteness.complete, variant: "outline" },
  };

  const config = badgeConfig[type];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
