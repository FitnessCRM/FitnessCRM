"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSendInvitation } from "@/lib/data/hooks";
import type { Client } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensClientDetail.invitation;

/**
 * Invitación pendiente (§7, §12): un cliente `invitado` aún no ha abierto el enlace de su correo.
 * Reenviar es volver a enviar ese mismo enlace, por si no llegó o caducó. Solo se pinta mientras
 * el cliente sigue `invitado`: al entrar pasa a `activo` y la tarjeta desaparece.
 */
export function ClientInvitationCard({ client, trainerId }: { client: Client; trainerId: string }) {
  const send = useSendInvitation(trainerId);
  const [sent, setSent] = useState(false);

  const resend = () => {
    setSent(false);
    send.mutate(client.id, { onSuccess: () => setSent(true) });
  };

  return (
    <Card className="border-accent-outline flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="section-title text-accent-hover">{t.title}</h2>
        <p className="text-text-muted text-sm">{t.hint.replace("{email}", client.email)}</p>
        {sent ? (
          <p role="status" className="text-success text-sm">
            {t.sent.replace("{email}", client.email)}
          </p>
        ) : null}
        {send.isError ? (
          <p role="alert" className="text-danger text-sm">
            {t.failed}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={resend}
        disabled={send.isPending}
        className="max-sm:w-full"
      >
        {send.isPending ? t.sending : t.action}
      </Button>
    </Card>
  );
}
