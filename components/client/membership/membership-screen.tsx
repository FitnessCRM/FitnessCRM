"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { membershipHistory, membershipStanding, type Membership } from "@/lib/domain";
import { useClientMemberships, useSessionClientId, useTrainer } from "@/lib/data/hooks";
import { formatCivilDate, todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { CurrentCard } from "./current-card";
import { HistoryTable } from "./history-table";
import { PaymentPill } from "./payment-pill";

const t = es.screensMembership;

/**
 * Pantalla 07 · Membresía. Solo lectura: el cliente no toca su membresía y el cobro pasa fuera
 * de la app (§10, I21). Una renovación es una fila nueva del historial, nunca una edición.
 */
export function MembershipScreen() {
  const clientId = useSessionClientId();
  const trainer = useTrainer();
  const memberships = useClientMemberships(clientId);
  const today = todayCivil(trainer.data?.timeZone);
  const trainerName = trainer.data?.name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={trainerName ? `${t.eyebrow} ${trainerName}` : undefined}
        title={es.pages.client.membresia}
      />
      <QueryBoundary query={memberships} isEmpty={() => false} empty={null}>
        {(data) => <MembershipView memberships={data} today={today} />}
      </QueryBoundary>
    </div>
  );
}

function MembershipView({ memberships, today }: { memberships: Membership[]; today: string }) {
  const { current, next, daysLeft, elapsed } = membershipStanding(memberships, today);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
      <div className="flex flex-col gap-4">
        <CurrentCard membership={current} daysLeft={daysLeft} elapsed={elapsed} />
        {next ? <NextCard membership={next} /> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <HistoryTable
          rows={membershipHistory(memberships)}
          currentId={current?.id}
          nextId={next?.id}
        />
        <p className="text-text-subtle text-[13px]">{t.footer}</p>
      </div>
    </div>
  );
}

/** La siguiente ya registrada. Si está sin pagar, el aviso lo dice sin pedirle nada al cliente. */
function NextCard({ membership }: { membership: Membership }) {
  const paid = membership.paymentStatus === "pagada";
  return (
    <Card className="gap-3 px-[22px] py-[22px]">
      <h2 className="section-title">{t.next.title}</h2>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[15px] font-semibold">
            {es.status.membershipType[membership.type]} ·{" "}
            <time dateTime={membership.startDate}>{formatCivilDate(membership.startDate)}</time> –{" "}
            <time dateTime={membership.endDate}>{formatCivilDate(membership.endDate)}</time>
          </p>
          <p className="text-text-subtle mt-1 text-[13px]">
            {paid ? t.next.paidHint : t.next.hint}
          </p>
        </div>
        <PaymentPill status={membership.paymentStatus} />
      </div>
    </Card>
  );
}
