"use client";

import { Controller, useFormContext } from "react-hook-form";
import { z } from "zod";
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
import { clientDataSchema } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.clientData;

/**
 * Los campos de `clientDataSchema`, el esquema del dominio: el formulario valida con él (E21) y el
 * adaptador, con `clientSchema`, del que es un recorte. Los mensajes los elige la pantalla por
 * campo, como en Membresías: cada uno de estos campos solo puede fallar de una manera.
 */
export type ClientDataValues = z.output<typeof clientDataSchema>;

/** `Select` de Radix no admite `value=""` en un ítem: este centinela es el «sin especificar». */
const NONE = "__none__";

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-danger text-xs">
      {message}
    </p>
  ) : null;
}

/**
 * Tarjeta «Datos del cliente», común al alta y a la edición. Lee el formulario del
 * `FormProvider` que la envuelve, que tiene que incluir los campos de `clientDataSchema`.
 * `startDateHint` es el texto bajo la fecha de alta y `lockStartDate` la deja de solo lectura:
 * en la edición no se cambia, porque es el origen de la numeración de semanas (§8, I22).
 */
export function ClientDataCard({
  lockStartDate = false,
  startDateHint,
  children,
}: {
  lockStartDate?: boolean;
  startDateHint: string;
  /** Campos propios de la pantalla, debajo de la fecha de alta. */
  children?: React.ReactNode;
}) {
  const form = useFormContext<ClientDataValues>();
  const { errors } = form.formState;

  return (
    <Card className="gap-5 px-[22px] py-[22px]">
      <h2 className="section-title">{t.title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cd-first">{t.firstName}</Label>
          <Input
            id="cd-first"
            autoComplete="off"
            aria-invalid={!!errors.firstName}
            {...form.register("firstName")}
          />
          <FieldError message={errors.firstName ? t.errors.firstNameRequired : undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cd-last">{t.lastName}</Label>
          <Input
            id="cd-last"
            autoComplete="off"
            aria-invalid={!!errors.lastName}
            {...form.register("lastName")}
          />
          <FieldError message={errors.lastName ? t.errors.lastNameRequired : undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cd-email">{t.email}</Label>
          <Input
            id="cd-email"
            type="email"
            autoComplete="off"
            aria-invalid={!!errors.email}
            {...form.register("email")}
          />
          <FieldError message={errors.email ? t.errors.emailInvalid : undefined} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cd-phone">{t.phone}</Label>
          <Input id="cd-phone" type="tel" autoComplete="off" {...form.register("phone")} />
        </div>
        <ChoiceField id="cd-goal" label={t.goal} options={t.goals} name="goal" />
        <ChoiceField id="cd-level" label={t.level} options={t.levels} name="level" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cd-notes">{t.notes}</Label>
        <Textarea
          id="cd-notes"
          placeholder={t.notesPlaceholder}
          {...form.register("initialNotes")}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:max-w-[50%]">
        <Label htmlFor="cd-start">{t.startDate}</Label>
        <Input
          id="cd-start"
          type="date"
          className="scheme-dark"
          readOnly={lockStartDate}
          aria-invalid={!!errors.startDate}
          aria-describedby="cd-start-hint"
          {...form.register("startDate")}
        />
        <FieldError message={errors.startDate ? t.errors.dateInvalid : undefined} />
        <p id="cd-start-hint" className="text-text-subtle text-xs">
          {startDateHint}
        </p>
      </div>
      {children}
    </Card>
  );
}

/** Selector de texto libre con opciones sugeridas; vaciarlo es elegir «sin especificar». */
function ChoiceField({
  id,
  label,
  options,
  name,
}: {
  id: string;
  label: string;
  options: readonly string[];
  name: "goal" | "level";
}) {
  const { control } = useFormContext<ClientDataValues>();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => {
          // Un valor guardado que no está en la lista sugerida (es texto libre) se conserva como opción.
          const custom = field.value !== "" && !options.includes(field.value);
          return (
            <Select
              value={field.value === "" ? NONE : field.value}
              onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t.selectPlaceholder}</SelectItem>
                {custom ? <SelectItem value={field.value}>{field.value}</SelectItem> : null}
                {options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }}
      />
    </div>
  );
}
