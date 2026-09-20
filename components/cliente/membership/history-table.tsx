import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import type { Membership } from "@/lib/domain";
import { formatCivilDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { PaymentPill } from "./payment-pill";

const t = es.screensMembership.history;

/** Historial: cada renovación es una fila nueva, no una edición de la anterior (§7). */
export function HistoryTable({
  rows,
  currentId,
  nextId,
}: {
  rows: Membership[];
  currentId: string | undefined;
  nextId: string | undefined;
}) {
  if (rows.length === 0) {
    return (
      <>
        <h2 className="section-title">{t.title}</h2>
        <EmptyState title={t.empty.title} description={t.empty.hint} />
      </>
    );
  }

  return (
    <>
      <h2 className="section-title">{t.title}</h2>
      <Card className="gap-0 px-0 py-0">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-text-subtle tracking-label text-[11px] uppercase">
              <th scope="col" className="px-5 py-3 font-normal">
                {t.type}
              </th>
              <th scope="col" className="px-2 py-3 font-normal">
                {t.start}
              </th>
              <th scope="col" className="px-2 py-3 font-normal">
                {t.end}
              </th>
              <th scope="col" className="px-5 py-3 font-normal">
                {t.status}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tag =
                row.id === currentId ? t.currentTag : row.id === nextId ? t.nextTag : null;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-border-subtle border-t text-[14px]",
                    row.id === currentId && "bg-surface-raised",
                  )}
                >
                  <th scope="row" className="px-5 py-3.5 font-semibold">
                    {es.status.membershipType[row.type]}
                    {tag ? (
                      <span className="text-text-muted ml-1.5 text-xs font-normal">· {tag}</span>
                    ) : null}
                  </th>
                  <td className="text-text-muted px-2 py-3.5">
                    <time dateTime={row.startDate}>{formatCivilDate(row.startDate)}</time>
                  </td>
                  <td className="text-text-muted px-2 py-3.5">
                    <time dateTime={row.endDate}>{formatCivilDate(row.endDate)}</time>
                  </td>
                  <td className="px-5 py-3.5">
                    <PaymentPill status={row.paymentStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
