"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  civilDateSchema,
  membershipEndDate,
  membershipTypeSchema,
  paymentStatusSchema,
} from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensClientSignup;

export const SIGNUP_FORM_ID = "client-signup";

/** Qué botón de envío se ha pulsado: `assign` sigue hacia la asignación de plan. */
export type SignupIntent = "invite" | "assign";

const dateField = z
  .string()
  .refine((v) => civilDateSchema.safeParse(v).success, { message: t.errors.dateInvalid });

/** Los campos de texto se validan aquí para los mensajes; el adaptador vuelve a validar con `clientSchema`. */
const formSchema = z
  .object({
    firstName: z.string().trim().min(1, t.errors.firstNameRequired),
    lastName: z.string().trim().min(1, t.errors.lastNameRequired),
    email: z.string().trim().pipe(z.email(t.errors.emailInvalid)),
    phone: z.string().trim(),
    goal: z.string(),
    level: z.string(),
    initialNotes: z.string().trim(),
    startDate: dateField,
    membershipType: membershipTypeSchema,
    membershipStart: dateField,
    membershipEnd: dateField,
    paymentStatus: paymentStatusSchema,
  })
  .refine(
    (v) =>
      !civilDateSchema.safeParse(v.membershipStart).success ||
      !civilDateSchema.safeParse(v.membershipEnd).success ||
      v.membershipEnd >= v.membershipStart,
    { message: t.errors.endBeforeStart, path: ["membershipEnd"] },
  );

export type SignupValues = z.output<typeof formSchema>;

/** `Select` de Radix no admite `value=""` en un ítem: este centinela es el «sin especificar». */
const NONE = "__none__";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-danger text-xs">
      {message}
    </p>
  ) : null;
}

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
  const form = useForm<SignupValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      goal: "",
      level: "",
      initialNotes: "",
      startDate: today,
      membershipType: "trimestral",
      membershipStart: today,
      membershipEnd: membershipEndDate("trimestral", today),
      paymentStatus: "pagada",
    },
  });
  const { errors, dirtyFields } = form.formState;
  const intent = useRef<SignupIntent>("invite");

  const startDate = form.watch("startDate");
  const membershipType = form.watch("membershipType");
  const membershipStart = form.watch("membershipStart");

  // Sigue a la fecha de alta hasta que se edite a mano.
  useEffect(() => {
    if (!dirtyFields.membershipStart && civilDateSchema.safeParse(startDate).success) {
      form.setValue("membershipStart", startDate);
    }
  }, [startDate, dirtyFields.membershipStart, form]);

  // Sigue al tipo y al inicio hasta que se edite a mano.
  useEffect(() => {
    if (!dirtyFields.membershipEnd && civilDateSchema.safeParse(membershipStart).success) {
      form.setValue("membershipEnd", membershipEndDate(membershipType, membershipStart));
    }
  }, [membershipType, membershipStart, dirtyFields.membershipEnd, form]);

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
        <Button type="submit" form={SIGNUP_FORM_ID} disabled={isSaving} onClick={choose("invite")}>
          {submitLabel}
        </Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="gap-5 px-[22px] py-[22px]">
          <h2 className="section-title">{t.data.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="su-first">{t.data.firstName}</Label>
              <Input
                id="su-first"
                autoComplete="off"
                aria-invalid={!!errors.firstName}
                {...form.register("firstName")}
              />
              <FieldError message={errors.firstName?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="su-last">{t.data.lastName}</Label>
              <Input
                id="su-last"
                autoComplete="off"
                aria-invalid={!!errors.lastName}
                {...form.register("lastName")}
              />
              <FieldError message={errors.lastName?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="su-email">{t.data.email}</Label>
              <Input
                id="su-email"
                type="email"
                autoComplete="off"
                aria-invalid={!!errors.email}
                {...form.register("email")}
              />
              <FieldError message={errors.email?.message} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="su-phone">{t.data.phone}</Label>
              <Input id="su-phone" type="tel" autoComplete="off" {...form.register("phone")} />
            </div>
            <ChoiceField
              id="su-goal"
              label={t.data.goal}
              options={t.goals}
              control={form.control}
              name="goal"
            />
            <ChoiceField
              id="su-level"
              label={t.data.level}
              options={t.levels}
              control={form.control}
              name="level"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="su-notes">{t.data.notes}</Label>
            <Textarea
              id="su-notes"
              placeholder={t.data.notesPlaceholder}
              {...form.register("initialNotes")}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:max-w-[50%]">
            <Label htmlFor="su-start">{t.data.startDate}</Label>
            <Input
              id="su-start"
              type="date"
              className="scheme-dark"
              aria-invalid={!!errors.startDate}
              aria-describedby="su-start-hint"
              {...form.register("startDate")}
            />
            <FieldError message={errors.startDate?.message} />
            <p id="su-start-hint" className="text-text-subtle text-xs">
              {t.data.startDateHint}
            </p>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="gap-5 px-[22px] py-[22px]">
            <h2 className="section-title">{t.membership.title}</h2>
            <div className="flex flex-col gap-2">
              <span id="su-type-label" className="tracking-label text-text-muted text-xs uppercase">
                {t.membership.type}
              </span>
              <Controller
                control={form.control}
                name="membershipType"
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
                  aria-invalid={!!errors.membershipStart}
                  {...form.register("membershipStart")}
                />
                <FieldError message={errors.membershipStart?.message} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="su-m-end">{t.membership.end}</Label>
                <Input
                  id="su-m-end"
                  type="date"
                  className="scheme-dark"
                  aria-invalid={!!errors.membershipEnd}
                  {...form.register("membershipEnd")}
                />
                <FieldError message={errors.membershipEnd?.message} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span id="su-pay-label" className="tracking-label text-text-muted text-xs uppercase">
                {t.membership.payment}
              </span>
              <Controller
                control={form.control}
                name="paymentStatus"
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
            <Button type="submit" disabled={isSaving} onClick={choose("assign")} className="w-full">
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
  );
}

/** Selector de texto libre con opciones sugeridas; vaciarlo es elegir «sin especificar». */
function ChoiceField({
  id,
  label,
  options,
  control,
  name,
}: {
  id: string;
  label: string;
  options: readonly string[];
  control: ReturnType<typeof useForm<SignupValues>>["control"];
  name: "goal" | "level";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value === "" ? NONE : field.value}
            onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
          >
            <SelectTrigger id={id} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t.data.selectPlaceholder}</SelectItem>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
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
