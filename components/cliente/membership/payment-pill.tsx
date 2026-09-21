import type { PaymentStatus } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

/** Píldora de estado de pago. Solo dice si está pagada: nunca importes ni datos de pago (I21). */
export function PaymentPill({ status, className }: { status: PaymentStatus; className?: string }) {
  const paid = status === "pagada";
  return (
    <span
      className={cn(
        "tracking-label inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap uppercase",
        paid
          ? "bg-success-soft text-success border-success/35 border"
          : "bg-danger-soft text-danger border-danger/35 border",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", paid ? "bg-success" : "bg-danger")}
      />
      {es.status.payment[status]}
    </span>
  );
}
