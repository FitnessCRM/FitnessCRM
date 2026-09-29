"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { Input } from "@/components/ui/input";
import { PaymentPill } from "@/components/ui/payment-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  civilDateSchema,
  membershipEditSchema,
  membershipTypeSchema,
  paymentStatusSchema,
  type MembershipEdit,
} from "@/lib/domain";
import type { MembershipWithClient } from "@/lib/data/ports";
import { formatCivilDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";

const t = es.screensTrainerMemberships;

/** Fila de la tabla. En edición la valida el mismo esquema del dominio que el adaptador. */
export function MembershipRow({
  row,
  overlapping,
  editing,
  isSaving,
  saveError,
  onEdit,
  onCancel,
  onSave,
}: {
  row: MembershipWithClient;
  overlapping: boolean;
  editing: boolean;
  isSaving: boolean;
  saveError: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (values: MembershipEdit) => Promise<unknown>;
}) {
  const { membership, client } = row;
  const name = `${client.firstName} ${client.lastName}`;

  return (
    <TableRow
      className={cn(editing && "border-accent-outline bg-surface-raised")}
      data-editing={editing || undefined}
    >
      <TableCell className="pl-5">
        <div className="flex items-center gap-3">
          <InitialsAvatar initials={initialsOf(client.firstName, client.lastName)} />
          <div className="flex flex-col items-start gap-1">
            <span className="font-semibold">{name}</span>
            {overlapping ? (
              <span
                title={t.overlap.hint}
                className="border-accent-outline bg-accent-soft text-accent-emphasis tracking-label rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase"
              >
                {t.overlap.tag}
              </span>
            ) : null}
          </div>
        </div>
      </TableCell>
      {editing ? (
        <EditCells
          key={membership.id}
          row={row}
          isSaving={isSaving}
          saveError={saveError}
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : (
        <>
          <TableCell className="text-text-muted">
            {es.status.membershipType[membership.type]}
          </TableCell>
          <TableCell className="text-text-muted">
            <time dateTime={membership.startDate}>{formatCivilDate(membership.startDate)}</time>
          </TableCell>
          <TableCell className="text-text-muted">
            <time dateTime={membership.endDate}>{formatCivilDate(membership.endDate)}</time>
          </TableCell>
          <TableCell>
            <PaymentPill status={membership.paymentStatus} />
          </TableCell>
          <TableCell className="pr-5 text-right">
            <Button
              variant="secondary"
              size="sm"
              onClick={onEdit}
              aria-label={`${t.actions.edit} ${name}`}
            >
              {t.actions.edit}
            </Button>
          </TableCell>
        </>
      )}
    </TableRow>
  );
}

/**
 * Celdas en edición. El `<form>` vive en la última celda y los controles de las demás se le
 * asocian con `form=`: un `<form>` no puede envolver un `<tr>`.
 */
function EditCells({
  row,
  isSaving,
  saveError,
  onCancel,
  onSave,
}: {
  row: MembershipWithClient;
  isSaving: boolean;
  saveError: boolean;
  onCancel: () => void;
  onSave: (values: MembershipEdit) => Promise<unknown>;
}) {
  const { membership } = row;
  const formId = `membership-${membership.id}`;
  const form = useForm<MembershipEdit>({
    resolver: zodResolver(membershipEditSchema),
    defaultValues: {
      type: membership.type,
      startDate: membership.startDate,
      endDate: membership.endDate,
      paymentStatus: membership.paymentStatus,
    },
  });
  const { errors } = form.formState;
  const endError = errors.endDate
    ? civilDateSchema.safeParse(form.getValues("endDate")).success
      ? t.form.endBeforeStart
      : t.form.dateInvalid
    : null;
  const startError = errors.startDate ? t.form.dateInvalid : null;

  return (
    <>
      <TableCell>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <Select form={formId} value={field.value} onValueChange={field.onChange}>
              <SelectTrigger size="sm" className="w-full min-w-[130px]" aria-label={t.columns.type}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {membershipTypeSchema.options.map((type) => (
                  <SelectItem key={type} value={type}>
                    {es.status.membershipType[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </TableCell>
      <TableCell>
        <DateField
          form={formId}
          label={t.columns.start}
          error={startError}
          {...form.register("startDate")}
        />
      </TableCell>
      <TableCell>
        <DateField
          form={formId}
          label={t.columns.end}
          error={endError}
          {...form.register("endDate")}
        />
      </TableCell>
      <TableCell>
        <Controller
          control={form.control}
          name="paymentStatus"
          render={({ field }) => (
            <Select form={formId} value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                size="sm"
                className="w-full min-w-[130px]"
                aria-label={t.columns.status}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentStatusSchema.options.map((status) => (
                  <SelectItem key={status} value={status}>
                    {es.status.payment[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </TableCell>
      <TableCell className="pr-5 text-right">
        <form
          id={formId}
          onSubmit={form.handleSubmit(async (values) => {
            // El error de guardado lo pinta `saveError`; aquí solo se evita el rechazo sin capturar.
            await onSave(values).catch(() => undefined);
          })}
          className="flex items-center justify-end gap-2"
        >
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
            {t.actions.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving ? t.actions.saving : t.actions.save}
          </Button>
        </form>
        {saveError ? (
          <p role="alert" className="text-danger mt-1 text-xs whitespace-normal">
            {t.form.saveError}
          </p>
        ) : null}
      </TableCell>
    </>
  );
}

function DateField({
  label,
  error,
  ...props
}: React.ComponentProps<"input"> & { label: string; error: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <Input
        type="date"
        aria-label={label}
        aria-invalid={!!error}
        className="h-9 min-w-[140px] text-[14px] scheme-dark"
        {...props}
      />
      {error ? <p className="text-danger text-xs whitespace-normal">{error}</p> : null}
    </div>
  );
}
