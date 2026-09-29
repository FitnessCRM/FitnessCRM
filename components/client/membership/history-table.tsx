import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import type { Membership } from "@/lib/domain";
import { formatCivilDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { PaymentPill } from "@/components/ui/payment-pill";

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
        {/* En móvil cada fila es una ficha de dos líneas: a cuatro columnas, las fechas se partían
            en tres renglones. Sigue siendo la misma tabla, con sus cabeceras para lectores. */}
        <table className="w-full border-collapse text-left max-sm:block">
          <thead className="max-sm:sr-only">
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
          <tbody className="max-sm:block">
            {rows.map((row) => {
              const tag =
                row.id === currentId ? t.currentTag : row.id === nextId ? t.nextTag : null;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-border-subtle border-t text-[14px]",
                    "max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:gap-y-1.5 max-sm:px-5 max-sm:py-3.5",
                    row.id === currentId && "bg-surface-raised",
                  )}
                >
                  <th scope="row" className="px-5 py-3.5 font-semibold max-sm:p-0">
                    {es.status.membershipType[row.type]}
                    {tag ? (
                      <span className="text-text-muted ml-1.5 text-xs font-normal">· {tag}</span>
                    ) : null}
                  </th>
                  <td className="text-text-muted px-2 py-3.5 max-sm:order-3 max-sm:p-0">
                    <span className="text-text-subtle tracking-label mr-1.5 text-[11px] uppercase sm:hidden">
                      {t.start}
                    </span>
                    <time dateTime={row.startDate}>{formatCivilDate(row.startDate)}</time>
                  </td>
                  <td className="text-text-muted px-2 py-3.5 max-sm:order-4 max-sm:p-0 max-sm:text-right">
                    <span className="text-text-subtle tracking-label mr-1.5 text-[11px] uppercase sm:hidden">
                      {t.end}
                    </span>
                    <time dateTime={row.endDate}>{formatCivilDate(row.endDate)}</time>
                  </td>
                  <td className="px-5 py-3.5 max-sm:order-2 max-sm:justify-self-end max-sm:p-0">
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
