"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  civilDateSchema,
  clientSignupSchema,
  membershipEndDate,
  membershipTypeSchema,
  paymentStatusSchema,
} from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { ClientDataCard, FieldError } from "./client-data-card";

const t = es.screensClientSignup;

export const SIGNUP_FORM_ID = "client-signup";

/** Qué botón de envío se ha pulsado: `assign` sigue hacia la asignación de plan. */
export type SignupIntent = "invite" | "assign";

/**
 * Valida con el esquema de alta del dominio (E21): los datos del cliente y la membresía inicial,
 * con las mismas reglas que una membresía de Membresías. Los mensajes se eligen aquí por campo.
 */
export type SignupValues = z.output<typeof clientSignupSchema>;

/**
 * Formulario del alta. La fecha de inicio de la membresía sigue a la fecha de alta y el fin sigue
 * al tipo mientras el entrenador no los toque; en cuanto los edita, dejan de moverse solos.
 */
export function ClientSignupForm({
  today,
  isSaving,
  error,
  onSubmit,
}: {
  today: string;
  isSaving: boolean;
  error: string | null;
  onSubmit: (values: SignupValues, intent: SignupIntent) => Promise<unknown>;
}) {
  const form = useForm<z.input<typeof clientSignupSchema>, unknown, SignupValues>({
    resolver: zodResolver(clientSignupSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      goal: "",
      level: "",
      initialNotes: "",
      startDate: today,
      membership: {
        type: "trimestral",
        startDate: today,
        endDate: membershipEndDate("trimestral", today),
        paymentStatus: "pagada",
      },
    },
  });
  const { errors, dirtyFields } = form.formState;
  // El fin solo puede fallar por fecha inválida o por ser anterior al inicio, como en Membresías.
  const endError = errors.membership?.endDate
    ? civilDateSchema.safeParse(form.getValues("membership.endDate")).success
      ? t.errors.endBeforeStart
      : es.clientData.errors.dateInvalid
    : undefined;
  const intent = useRef<SignupIntent>("invite");

  const startDate = form.watch("startDate");
  const membershipType = form.watch("membership.type");
  const membershipStart = form.watch("membership.startDate");

  // Sigue a la fecha de alta hasta que se edite a mano.
  useEffect(() => {
    if (!dirtyFields.membership?.startDate && civilDateSchema.safeParse(startDate).success) {
      form.setValue("membership.startDate", startDate);
    }
  }, [startDate, dirtyFields.membership?.startDate, form]);

  // Sigue al tipo y al inicio hasta que se edite a mano.
  useEffect(() => {
    if (!dirtyFields.membership?.endDate && civilDateSchema.safeParse(membershipStart).success) {
      form.setValue("membership.endDate", membershipEndDate(membershipType, membershipStart));
    }
  }, [membershipType, membershipStart, dirtyFields.membership?.endDate, form]);

  const choose = (next: SignupIntent) => () => {
    intent.current = next;
  };

  const submitLabel = isSaving ? t.actions.submitting : t.actions.submit;
  const cancel = (className?: string) => (
    <Button asChild variant="secondary" className={className}>
      <Link href="/clients">{t.actions.cancel}</Link>
    </Button>
  );

  return (
    <FormProvider {...form}>
      <form
        id={SIGNUP_FORM_ID}
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          // El error lo pinta `error`; aquí solo se evita el rechazo sin capturar.
          await onSubmit(values, intent.current).catch(() => undefined);
        })}
        className="flex flex-col gap-6"
      >
        {/* Las acciones de la cabecera solo caben en escritorio: por debajo de `lg` van al pie. */}
        <div className="flex justify-end gap-3 max-lg:hidden">
          {cancel()}
          <Button
            type="submit"
            form={SIGNUP_FORM_ID}
            disabled={isSaving}
            onClick={choose("invite")}
          >
            {submitLabel}
          </Button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <ClientDataCard startDateHint={es.clientData.startDateHint} />

          <div className="flex flex-col gap-5">
            <Card className="gap-5 px-[22px] py-[22px]">
              <h2 className="section-title">{t.membership.title}</h2>
              <div className="flex flex-col gap-2">
                <span
                  id="su-type-label"
                  className="tracking-label text-text-muted text-xs uppercase"
                >
                  {t.membership.type}
                </span>
                <Controller
                  control={form.control}
                  name="membership.type"
                  render={({ field }) => (
                    <div
                      role="radiogroup"
                      aria-labelledby="su-type-label"
                      className="flex flex-wrap gap-2"
                    >
                      {membershipTypeSchema.options.map((type) => (
                        <ToggleChip
                          key={type}
                          checked={field.value === type}
                          onClick={() => field.onChange(type)}
                        >
                          {es.status.membershipType[type]}
                        </ToggleChip>
                      ))}
                    </div>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="su-m-start">{t.membership.start}</Label>
                  <Input
                    id="su-m-start"
                    type="date"
                    className="scheme-dark"
                    aria-invalid={!!errors.membership?.startDate}
                    {...form.register("membership.startDate")}
                  />
                  <FieldError
                    message={
                      errors.membership?.startDate ? es.clientData.errors.dateInvalid : undefined
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="su-m-end">{t.membership.end}</Label>
                  <Input
                    id="su-m-end"
                    type="date"
                    className="scheme-dark"
                    aria-invalid={!!errors.membership?.endDate}
                    {...form.register("membership.endDate")}
                  />
                  <FieldError message={endError} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span
                  id="su-pay-label"
                  className="tracking-label text-text-muted text-xs uppercase"
                >
                  {t.membership.payment}
                </span>
                <Controller
                  control={form.control}
                  name="membership.paymentStatus"
                  render={({ field }) => (
                    <div
                      role="radiogroup"
                      aria-labelledby="su-pay-label"
                      className="flex flex-wrap gap-2"
                    >
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
            </Card>

            <Card className="border-accent-outline gap-3 px-[22px] py-[22px]">
              <h2 className="section-title">{t.next.title}</h2>
              <p className="text-text-muted text-[13px]">{t.next.hint}</p>
              <Button
                type="submit"
                disabled={isSaving}
                onClick={choose("assign")}
                className="w-full"
              >
                {t.next.assign}
              </Button>
            </Card>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end lg:hidden">
          {cancel("max-sm:w-full")}
          <Button
            type="submit"
            disabled={isSaving}
            onClick={choose("invite")}
            className="max-sm:w-full"
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </FormProvider>
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
