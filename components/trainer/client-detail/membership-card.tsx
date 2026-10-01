"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PaymentPill } from "@/components/ui/payment-pill";
import { membershipStanding, overlappingMembershipIds, type Membership } from "@/lib/domain";
import { formatCivilDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { RenewMembershipDialog } from "./renew-membership-dialog";

const t = es.screensClientDetail.membership;

function daysLeftLabel(days: number) {
  if (days === 0) return t.daysLeft.zero;
  const form = days === 1 ? t.daysLeft.one : t.daysLeft.other;
  return form.replace("{days}", String(days));
}

/**
 * «Membresía»: la vigente hoy con su estado de pago, aviso si el cliente tiene periodos
 * solapados, y las dos salidas del entrenador: gestionar (la tabla de Membresías ya filtrada por
 * este cliente) y renovar (fila nueva, nunca edición de la anterior, §7).
 */
export function MembershipCard({
  clientId,
  memberships,
  today,
}: {
  clientId: string;
  memberships: Membership[];
  today: string;
}) {
  const [renewing, setRenewing] = useState(false);
  const { current, next, daysLeft } = membershipStanding(memberships, today);
  const overlapping = overlappingMembershipIds(memberships).size > 0;

  return (
    <Card className="gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="section-title">{t.title}</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/memberships?clientId=${clientId}`}>{t.manage}</Link>
          </Button>
          <Button size="sm" onClick={() => setRenewing(true)}>
            {t.renew}
          </Button>
        </div>
      </div>

      {current ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <PaymentPill status={current.paymentStatus} />
          <p className="text-[15px] font-semibold">{es.status.membershipType[current.type]}</p>
          <p className="text-text-muted text-xs">
            <time dateTime={current.startDate}>{formatCivilDate(current.startDate)}</time>
            {" → "}
            <time dateTime={current.endDate}>{formatCivilDate(current.endDate)}</time>
            {daysLeft !== null ? ` · ${daysLeftLabel(daysLeft)}` : null}
          </p>
        </div>
      ) : (
        <p className="text-text-subtle text-sm">
          {memberships.length === 0 ? t.noneAtAll : t.none}
        </p>
      )}

      {next ? (
        <p className="text-text-muted flex flex-wrap items-center gap-2 text-xs">
          {t.upcoming.replace("{start}", formatCivilDate(next.startDate))}
          <PaymentPill status={next.paymentStatus} className="px-2 py-0.5 text-[10px]" />
        </p>
      ) : null}

      {overlapping ? (
        <p role="note" className="text-accent-emphasis text-xs">
          {t.overlapHint}
        </p>
      ) : null}

      <RenewMembershipDialog
        open={renewing}
        onOpenChange={setRenewing}
        clientId={clientId}
        memberships={memberships}
        today={today}
      />
    </Card>
  );
}
