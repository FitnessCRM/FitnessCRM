"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import { useSaveMembership } from "@/lib/data/hooks";
import {
  civilDateSchema,
  membershipEditSchema,
  membershipEndDate,
  membershipTypeSchema,
  overlapsAnyMembership,
  paymentStatusSchema,
  suggestedRenewalStart,
  type Membership,
  type MembershipEdit,
} from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensClientDetail.membership.renewDialog;

/**
 * Una renovación es una membresía nueva con los mismos campos que una editada en Membresías: valida
 * con `membershipEditSchema`, el esquema del dominio (E21), y la pantalla elige el mensaje.
 */
type Values = MembershipEdit;

function initialValues(memberships: Membership[], today: string): Values {
  const startDate = suggestedRenewalStart(memberships, today);
  return {
    type: "trimestral",
    startDate,
    endDate: membershipEndDate("trimestral", startDate),
    paymentStatus: "no_pagada",
  };
}

/**
 * Renovación: crea una membresía nueva. Propone el inicio (día siguiente al fin de la última, u
 * hoy si ya venció) y el fin según el tipo, mientras el entrenador no los toque. Avisa del
 * solape pero no lo impide: el dominio no lo prohíbe (§7).
 */
export function RenewMembershipDialog({
  open,
  onOpenChange,
  clientId,
  memberships,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  memberships: Membership[];
  today: string;
}) {
  const save = useSaveMembership();
  const [failed, setFailed] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(membershipEditSchema),
    defaultValues: initialValues(memberships, today),
  });
  const { errors, dirtyFields } = form.formState;
  // El fin solo puede fallar por fecha inválida o por ser anterior al inicio, como en Membresías.
  const endError = errors.endDate
    ? civilDateSchema.safeParse(form.getValues("endDate")).success
      ? t.errors.endBeforeStart
      : t.errors.dateInvalid
    : null;

  const type = form.watch("type");
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");

  // El fin sigue al tipo y al inicio hasta que se edite a mano.
  useEffect(() => {
    if (!dirtyFields.endDate && civilDateSchema.safeParse(startDate).success) {
      form.setValue("endDate", membershipEndDate(type, startDate));
    }
  }, [type, startDate, dirtyFields.endDate, form]);

  // Cada apertura parte de cero: las membresías pueden haber cambiado entre una y otra.
  const { reset } = form;
  const { reset: resetSave } = save;
  useEffect(() => {
    if (!open) return;
    reset(initialValues(memberships, today));
    setFailed(false);
    resetSave();
    // Solo al abrir: reiniciar con cada cambio de `memberships` pisaría lo que se está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const datesValid =
    civilDateSchema.safeParse(startDate).success &&
    civilDateSchema.safeParse(endDate).success &&
    endDate >= startDate;
  const overlaps = datesValid && overlapsAnyMembership(memberships, { startDate, endDate });

  const submit = form.handleSubmit(async (values) => {
    setFailed(false);
    try {
      await save.mutateAsync({ create: { clientId, ...values } });
      onOpenChange(false);
    } catch {
      setFailed(true);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.hint}</DialogDescription>
        </DialogHeader>
        <form id="renew-membership" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span id="rn-type" className="tracking-label text-text-muted text-xs uppercase">
              {t.type}
            </span>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <div role="radiogroup" aria-labelledby="rn-type" className="flex flex-wrap gap-2">
                  {membershipTypeSchema.options.map((option) => (
                    <ToggleChip
                      key={option}
                      checked={field.value === option}
                      onClick={() => field.onChange(option)}
                    >
                      {es.status.membershipType[option]}
                    </ToggleChip>
                  ))}
                </div>
              )}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rn-start">{t.start}</Label>
              <Input
                id="rn-start"
                type="date"
                className="scheme-dark"
                aria-invalid={!!errors.startDate}
                {...form.register("startDate")}
              />
              {errors.startDate ? (
                <p role="alert" className="text-danger text-xs">
                  {t.errors.dateInvalid}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rn-end">{t.end}</Label>
              <Input
                id="rn-end"
                type="date"
                className="scheme-dark"
                aria-invalid={!!errors.endDate}
                {...form.register("endDate")}
              />
              {endError ? (
                <p role="alert" className="text-danger text-xs">
                  {endError}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span id="rn-pay" className="tracking-label text-text-muted text-xs uppercase">
              {t.payment}
            </span>
            <Controller
              control={form.control}
              name="paymentStatus"
              render={({ field }) => (
                <div role="radiogroup" aria-labelledby="rn-pay" className="flex flex-wrap gap-2">
                  {paymentStatusSchema.options.map((status) => (
                    <ToggleChip
                      key={status}
                      checked={field.value === status}
                      tone={status === "pagada" ? "success" : "danger"}
                      onClick={() => field.onChange(status)}
                    >
                      {es.status.payment[status]}
                    </ToggleChip>
                  ))}
                </div>
              )}
            />
          </div>
          {overlaps ? (
            <p role="note" className="text-accent-emphasis text-xs">
              {t.overlapWarning}
            </p>
          ) : null}
          {failed ? (
            <p role="alert" className="text-danger text-sm">
              {t.errors.saveFailed}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            {t.cancel}
          </Button>
          <Button type="submit" form="renew-membership" disabled={save.isPending}>
            {save.isPending ? t.submitting : t.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Opción de un grupo de radio con aspecto de botón; 40 px de alto para el táctil. */
function ToggleChip({
  checked,
  tone = "accent",
  onClick,
  children,
}: {
  checked: boolean;
  tone?: "accent" | "success" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 h-10 rounded-md border px-3.5 text-[13px] transition-colors outline-none focus-visible:ring-[3px]",
        !checked && "border-border-emphasis text-text-muted hover:text-text-primary",
        checked && tone === "accent" && "border-accent bg-accent text-on-accent font-semibold",
        checked &&
          tone === "success" &&
          "border-success/35 bg-success-soft text-success font-semibold",
        checked && tone === "danger" && "border-danger/35 bg-danger-soft text-danger font-semibold",
      )}
    >
      {children}
    </button>
  );
}
