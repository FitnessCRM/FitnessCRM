"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useOnlinePaymentStatus, useStartPaymentConnection } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";

const t = es.screensTrainerMemberships.online;

/**
 * Cobro en línea (tarjeta 125). Sin captura: propuesta con el sistema de diseño, junto a las
 * tarifas. Conectar lleva al alta de la cuenta de cobro del entrenador, que es el comercio; al
 * volver, el estado se vuelve a leer.
 */
export function OnlinePaymentsCard() {
  const status = useOnlinePaymentStatus();
  const router = useRouter();
  const connect = useStartPaymentConnection();

  const start = async () => {
    const result = await connect.mutateAsync().catch(() => null);
    // Fuera de la app (el pago o el alta de la cuenta) se recarga; dentro, el router (la demo).
    if (result) {
      if (result.url.startsWith("/")) router.push(result.url);
      else window.location.assign(result.url);
    }
  };

  return (
    <Card className="gap-4 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">{t.title}</h2>
        {status.data?.enabled ? (
          <span className="bg-success-soft text-success tracking-label rounded-full px-2.5 py-1 text-[11px] uppercase">
            {t.connected}
          </span>
        ) : null}
      </div>
      {status.isPending ? (
        <LoadingState />
      ) : status.isError ? (
        <ErrorState onRetry={() => void status.refetch()} />
      ) : (
        <>
          <p className="text-text-muted text-[13px]">
            {status.data.enabled ? t.connectedHint : t.disconnectedHint}
          </p>
          {connect.isError ? (
            <p role="alert" className="text-danger text-[13px]">
              {t.failed}
            </p>
          ) : null}
          {status.data.enabled ? null : (
            <Button
              type="button"
              onClick={() => void start()}
              disabled={connect.isPending}
              className="self-start max-sm:w-full"
            >
              {connect.isPending ? t.connecting : status.data.connected ? t.resume : t.connect}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
