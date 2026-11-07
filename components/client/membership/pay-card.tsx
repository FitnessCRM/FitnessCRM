"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMembershipRates, useOnlinePaymentStatus, useStartCheckout } from "@/lib/data/hooks";
import { isPaymentMisconfigured, payableRates, type MembershipType } from "@/lib/domain";
import { formatPriceCents } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensMembership.pay;

/**
 * Renovar y pagar (E5, tarjeta 125). Solo aparece si el entrenador puede cobrar en línea y tiene
 * alguna tarifa activa con precio. El pago se hace fuera de la app; la membresía aparece cuando se
 * confirma (E6), así que aquí no se crea nada. Sin captura: propuesta con el sistema de diseño.
 */
export function PayCard({ trainerId }: { trainerId: string }) {
  const status = useOnlinePaymentStatus(trainerId);
  const rates = useMembershipRates(trainerId);
  const router = useRouter();
  const checkout = useStartCheckout();
  const payable = payableRates(rates.data ?? []);
  const [selected, setSelected] = useState<MembershipType | null>(null);

  // Sin cobro conectado o sin tarifas que pagar, el botón no aparece (E5): no es un error.
  if (!status.data?.enabled || payable.length === 0) return null;
  const choice = payable.find((r) => r.type === selected) ?? payable[0]!;

  const pay = async () => {
    const result = await checkout.mutateAsync(choice.type).catch(() => null);
    // Fuera de la app (el pago o el alta de la cuenta) se recarga; dentro, el router (la demo).
    if (result) {
      if (result.url.startsWith("/")) router.push(result.url);
      else window.location.assign(result.url);
    }
  };

  return (
    <Card className="gap-4 px-[22px] py-[22px]">
      <div className="flex flex-col gap-1">
        <h2 className="section-title">{t.title}</h2>
        <p className="text-text-muted text-[13px]">{t.hint}</p>
      </div>
      <ul role="radiogroup" aria-label={t.typeLabel} className="flex flex-col gap-2">
        {payable.map((rate) => {
          const checked = rate.type === choice.type;
          return (
            <li key={rate.type}>
              <button
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setSelected(rate.type)}
                className={cn(
                  "focus-visible:ring-ring/50 flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-left outline-none focus-visible:ring-[3px]",
                  checked
                    ? "border-accent-outline bg-accent-soft"
                    : "border-border-subtle bg-surface-raised hover:border-border-emphasis",
                )}
              >
                <span className="text-[14px] font-semibold">
                  {es.status.membershipType[rate.type]}
                </span>
                <span className="text-text-muted text-[14px]">
                  {formatPriceCents(rate.priceCents)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {checkout.isError ? (
        <p role="alert" className="text-danger text-[13px]">
          {isPaymentMisconfigured(checkout.error) ? t.misconfigured : t.failed}
        </p>
      ) : null}
      <Button type="button" onClick={() => void pay()} disabled={checkout.isPending}>
        {checkout.isPending
          ? t.redirecting
          : t.submit.replace("{price}", formatPriceCents(choice.priceCents))}
      </Button>
    </Card>
  );
}

/** Lo que dice la pantalla al volver del pago (`?payment=`), sin crear nada: lo crea la confirmación. */
export function PaymentReturnNotice({ result }: { result: string | null }) {
  if (result !== "success" && result !== "cancelled") return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-lg border px-4 py-3 text-[13px]",
        result === "success"
          ? "border-success/35 bg-success-soft text-success"
          : "border-border-subtle bg-surface text-text-muted",
      )}
    >
      {result === "success" ? t.paid : t.cancelled}
    </p>
  );
}
