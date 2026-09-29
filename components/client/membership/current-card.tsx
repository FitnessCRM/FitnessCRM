import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import type { Membership } from "@/lib/domain";
import { formatCivilDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { PaymentPill } from "./payment-pill";

const t = es.screensMembership.current;

/** La membresía en curso, con lo que queda por delante. El cliente solo lee. */
export function CurrentCard({
  membership,
  daysLeft,
  elapsed,
}: {
  membership: Membership | null;
  daysLeft: number | null;
  elapsed: number | null;
}) {
  if (!membership) {
    return <EmptyState title={t.none.title} description={t.none.hint} />;
  }

  return (
    <Card className="border-accent-outline gap-5 px-[22px] py-[22px]">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-[26px] leading-none font-bold uppercase">
          {es.status.membershipType[membership.type]}
        </h2>
        <PaymentPill status={membership.paymentStatus} />
      </div>

      <div className="flex gap-10">
        <div>
          <p className="text-text-subtle tracking-label text-[11px] uppercase">{t.start}</p>
          <p className="font-display mt-1 text-[17px] font-semibold">
            <time dateTime={membership.startDate}>{formatCivilDate(membership.startDate)}</time>
          </p>
        </div>
        <div>
          <p className="text-text-subtle tracking-label text-[11px] uppercase">{t.end}</p>
          <p className="font-display mt-1 text-[17px] font-semibold">
            <time dateTime={membership.endDate}>{formatCivilDate(membership.endDate)}</time>
          </p>
        </div>
      </div>

      {daysLeft !== null && elapsed !== null ? (
        <div>
          <div className="flex items-baseline justify-between gap-4 text-[13px]">
            <span className="text-text-muted">{t.remaining}</span>
            <span className="text-text-primary">
              {daysLeft === 0 ? t.lastDay : `${daysLeft} ${t.days}`}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(elapsed * 100)}
            className="bg-surface-overlay mt-2 h-1.5 overflow-hidden rounded-full"
          >
            <div className="bg-accent h-full rounded-full" style={{ width: `${elapsed * 100}%` }} />
          </div>
        </div>
      ) : null}
    </Card>
  );
}
