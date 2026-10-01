"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateClient } from "@/lib/data/hooks";
import type { Client } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensClientDetail.lifecycle;

/**
 * Dar de baja y reactivar (§7). Solo cambia el estado: la baja conserva el histórico completo y
 * no toca el plan ni la membresía (I13), y reactivar vuelve siempre a «En activo». Se puede dar
 * de baja desde cualquier estado, también a quien aún no ha aceptado la invitación.
 *
 * No es el borrado a petición (I14): esa operación es otra y no se mezcla con esta.
 */
export function ClientStatusAction({ client }: { client: Client }) {
  const update = useUpdateClient();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const reactivating = client.status === "dado_de_baja";
  const copy = reactivating ? t.reactivate : t.deactivate;
  const name = `${client.firstName} ${client.lastName}`;

  const openDialog = () => {
    setFailed(false);
    update.reset();
    setOpen(true);
  };

  const confirm = async () => {
    setFailed(false);
    try {
      await update.mutateAsync({
        clientId: client.id,
        changes: { status: reactivating ? "activo" : "dado_de_baja" },
      });
      setOpen(false);
    } catch {
      setFailed(true);
    }
  };

  return (
    <>
      <Card
        className={cn(
          "flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
          reactivating ? "border-success/35" : "border-danger/35",
        )}
      >
        <div className="flex flex-col gap-1">
          <h2 className={cn("section-title", reactivating ? "text-success" : "text-danger")}>
            {copy.cardTitle}
          </h2>
          <p className="text-text-muted text-sm">{copy.cardHint}</p>
        </div>
        <Button
          type="button"
          variant={reactivating ? "outline" : "destructive"}
          onClick={openDialog}
          className={cn(
            "max-sm:w-full",
            reactivating &&
              "border-success/55 bg-success-soft text-success hover:border-success hover:bg-success/25 hover:text-success",
          )}
        >
          {copy.action}
        </Button>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.title.replace("{name}", name)}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          {!reactivating ? <p className="text-text-subtle text-xs">{t.deactivate.note}</p> : null}
          {failed ? (
            <p role="alert" className="text-danger text-sm">
              {copy.failed}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={update.isPending}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant={reactivating ? "default" : "destructive"}
              onClick={confirm}
              disabled={update.isPending}
            >
              {update.isPending ? t.saving : copy.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
