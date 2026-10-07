"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { es } from "@/lib/i18n/es";
import { PreviousPlansDialog } from "./previous-plans-dialog";

const t = es.screensClientDetail.previous;

/**
 * «Planes anteriores»: la entrada a un pop-up donde se elige un periodo en un calendario y se ven
 * los planes que el cliente llevaba entonces, de solo lectura. Asignar o publicar un plan nuevo
 * archiva el anterior (§7); aquí se consulta qué llevaba antes de cada cambio.
 */
export function PreviousPlansCard({ clientId, timeZone }: { clientId: string; timeZone: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="gap-3 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">{t.title}</h2>
          <p className="text-text-muted text-[13px]">{t.hint}</p>
        </div>
        <Button variant="outline" size="sm" className="min-h-8" onClick={() => setOpen(true)}>
          {t.open}
        </Button>
      </div>
      {open ? (
        <PreviousPlansDialog clientId={clientId} timeZone={timeZone} onOpenChange={setOpen} />
      ) : null}
    </Card>
  );
}
