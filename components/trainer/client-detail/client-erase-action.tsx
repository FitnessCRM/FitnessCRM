"use client";

import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEraseClient } from "@/lib/data/hooks";
import { confirmsClientName, type Client } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensClientDetail.lifecycle;

/**
 * Borrado a petición (E11, I14). Solo para un cliente de baja, y aparte de la reactivación: borra
 * definitivamente, sin anonimizar, y se confirma escribiendo su nombre. Al acabar, la ficha ya no
 * existe y se vuelve a Clientes.
 */
export function ClientEraseAction({ client }: { client: Client }) {
  const router = useRouter();
  const erase = useEraseClient();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const name = `${client.firstName} ${client.lastName}`;
  const confirmed = confirmsClientName(client, typed);

  const openDialog = () => {
    erase.reset();
    setTyped("");
    setOpen(true);
  };

  const confirm = async () => {
    const done = await erase
      .mutateAsync(client.id)
      .then(() => true)
      .catch(() => false);
    if (done) router.push("/clients");
  };

  return (
    <>
      <Card className="border-danger/35 flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="section-title text-danger">{t.erase.cardTitle}</h2>
          <p className="text-text-muted text-sm">{t.erase.cardHint}</p>
        </div>
        <Button type="button" variant="destructive" onClick={openDialog} className="max-sm:w-full">
          {t.erase.action}
        </Button>
      </Card>
      <Dialog open={open} onOpenChange={(next) => !erase.isPending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.erase.title.replace("{name}", name)}</DialogTitle>
            <DialogDescription>{t.erase.body}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="erase-name">{t.erase.typeName.replace("{name}", name)}</Label>
            <Input
              id="erase-name"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              disabled={erase.isPending}
            />
          </div>
          {erase.isError ? (
            <p role="alert" className="text-danger text-sm">
              {t.erase.failed}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={erase.isPending}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirm()}
              disabled={!confirmed || erase.isPending}
            >
              {erase.isPending ? t.erase.erasing : t.erase.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
