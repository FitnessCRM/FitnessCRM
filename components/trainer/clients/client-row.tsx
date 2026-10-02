import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { PaymentPill } from "@/components/ui/payment-pill";
import type { ClientTrackingRow } from "@/lib/data/ports";
import { weekNumberOrNull } from "@/lib/domain";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";

const t = es.screensClients;

/** Columnas de escritorio; por debajo de `lg` la fila se apila como tarjeta. */
export const ROW_GRID = "lg:grid lg:grid-cols-[1.8fr_1.4fr_0.5fr_1.1fr_1.1fr_1.1fr] lg:gap-4";

/** Etiqueta de la celda: solo por debajo de `lg`, donde no hay cabecera de columnas. */
function CellLabel({ children }: { children: string }) {
  return (
    <span className="tracking-label text-text-subtle text-[11px] uppercase lg:hidden">
      {children}
    </span>
  );
}

/** Semana en curso desde el alta; `null` si el alta es futura y todavía no tiene semana. */
function currentWeek(startDate: string, timeZone: string): number | null {
  return weekNumberOrNull(startDate, todayCivil(timeZone), timeZone);
}

export function ClientRow({ row, timeZone }: { row: ClientTrackingRow; timeZone: string }) {
  const { client, routineName, newReviewWeek, membership } = row;
  const fullName = `${client.firstName} ${client.lastName}`;
  const week = currentWeek(client.startDate, timeZone);

  return (
    <li className="border-border-subtle border-b last:border-b-0">
      <Link
        href={`/clients/${client.id}`}
        aria-label={`${t.openDetail} ${fullName}`}
        className={cn(
          ROW_GRID,
          "hover:bg-surface-raised/50 focus-visible:ring-ring/50 grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset lg:items-center",
        )}
      >
        <span className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
          <InitialsAvatar initials={initialsOf(client.firstName, client.lastName)} />
          <span className="min-w-0">
            <span className="text-text-primary block truncate font-semibold">{fullName}</span>
            {client.goal ? (
              <span className="text-text-muted block truncate text-[13px]">{client.goal}</span>
            ) : null}
          </span>
        </span>

        <span className="col-span-2 flex min-w-0 flex-col gap-1 lg:col-span-1">
          <CellLabel>{t.columns.plan}</CellLabel>
          <span
            className={cn(
              "text-[13px] lg:text-[14px]",
              routineName ? "text-text-muted" : "text-text-subtle",
            )}
          >
            {routineName ?? t.noPlan}
          </span>
        </span>

        <span className="flex flex-col gap-1">
          <CellLabel>{t.columns.week}</CellLabel>
          <span className="text-text-muted text-[13px] lg:text-[14px]">
            {week === null ? es.common.none : `${t.weekShort}${week}`}
          </span>
        </span>

        <span className="flex flex-col items-start gap-1 lg:order-last">
          <CellLabel>{t.columns.status}</CellLabel>
          <span
            className={cn(
              "flex items-center gap-1.5 text-[13px]",
              client.status === "activo" ? "text-success" : "text-text-muted",
            )}
          >
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {es.status.client[client.status]}
          </span>
        </span>

        <span className="flex flex-col items-start gap-1">
          <CellLabel>{t.columns.review}</CellLabel>
          {newReviewWeek !== null ? (
            <span className="bg-accent-soft text-accent border-accent/35 tracking-label inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap uppercase">
              {t.newReview} · {t.weekShort}
              {newReviewWeek}
            </span>
          ) : (
            <span className="text-text-subtle text-[13px]">{t.noReview}</span>
          )}
        </span>

        <span className="flex flex-col items-start gap-1">
          <CellLabel>{t.columns.membership}</CellLabel>
          {membership ? (
            <PaymentPill status={membership.paymentStatus} />
          ) : (
            <span className="text-text-subtle text-[13px]">{t.noMembership}</span>
          )}
        </span>
      </Link>
    </li>
  );
}
