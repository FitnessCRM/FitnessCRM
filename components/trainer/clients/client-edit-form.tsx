"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Client } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { ClientDataCard, FieldError, clientDataSchema } from "./client-data-card";

const t = es.screensClientEdit;

/** La cadencia se edita como texto y se convierte a número al guardar. */
const formSchema = clientDataSchema.extend({
  reviewEveryDays: z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) > 0, { message: t.errors.cadenceInvalid }),
});

export type EditValues = z.output<typeof formSchema>;

/**
 * Formulario de edición de los datos de un cliente. Reutiliza la tarjeta del alta; la fecha de
 * alta va bloqueada: es el origen de la numeración de semanas y cambiarla no reetiqueta nada.
 */
export function ClientEditForm({
  client,
  isSaving,
  error,
  onSubmit,
}: {
  client: Client;
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: EditValues) => Promise<unknown>;
}) {
  const form = useForm<EditValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      goal: client.goal,
      level: client.level,
      initialNotes: client.initialNotes,
      startDate: client.startDate,
      reviewEveryDays: String(client.reviewCadence.everyDays),
    },
  });
  const { errors } = form.formState;

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          // El error lo pinta `error`; aquí solo se evita el rechazo sin capturar.
          await onSubmit(values).catch(() => undefined);
        })}
        className="flex max-w-3xl flex-col gap-6"
      >
        <ClientDataCard lockStartDate startDateHint={t.startDateLockedHint}>
          <div className="flex flex-col gap-1.5 sm:max-w-[50%]">
            <Label htmlFor="ce-cadence">{t.cadence.label}</Label>
            <Input
              id="ce-cadence"
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={!!errors.reviewEveryDays}
              aria-describedby="ce-cadence-hint"
              {...form.register("reviewEveryDays")}
            />
            <FieldError message={errors.reviewEveryDays?.message} />
            <p id="ce-cadence-hint" className="text-text-subtle text-xs">
              {t.cadence.hint}
            </p>
          </div>
        </ClientDataCard>

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="secondary" className="max-sm:w-full">
            <Link href={`/clients/${client.id}`}>{t.actions.cancel}</Link>
          </Button>
          <Button type="submit" disabled={isSaving} className="max-sm:w-full">
            {isSaving ? t.actions.submitting : t.actions.submit}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
