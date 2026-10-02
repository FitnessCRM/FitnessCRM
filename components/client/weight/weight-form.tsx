"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/ui/states";
import { civilDateSchema, weightKgSchema, weightLogDateIssue, type CivilDate } from "@/lib/domain";
import { formatCivilDate, parseDecimalInput } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screens.weight.form;

/**
 * El campo de peso admite coma decimal; el valor final lo valida el esquema del dominio. La fecha,
 * además, contra I27: ni posterior a hoy en la zona del entrenador ni anterior al alta.
 */
const formSchemaFor = (bounds: { today: CivilDate; startDate: CivilDate }) =>
  z.object({
    weightKg: z
      .string()
      .min(1, t.weightRequired)
      .transform((raw, ctx) => {
        const parsed = weightKgSchema.safeParse(parseDecimalInput(raw));
        if (!parsed.success) {
          ctx.addIssue({ code: "custom", message: t.weightInvalid });
          return z.NEVER;
        }
        return parsed.data;
      }),
    date: z
      .string()
      .refine((v) => civilDateSchema.safeParse(v).success, { message: t.dateInvalid })
      .superRefine((v, ctx) => {
        const issue = weightLogDateIssue(v, bounds);
        if (issue === "future") ctx.addIssue({ code: "custom", message: t.dateFuture });
        if (issue === "before_start") {
          ctx.addIssue({
            code: "custom",
            message: t.dateBeforeStart.replace("{date}", formatCivilDate(bounds.startDate)),
          });
        }
      }),
    note: z.string().trim(),
  });

type FormSchema = ReturnType<typeof formSchemaFor>;
type FormInput = z.input<FormSchema>;
export type WeightFormValues = z.output<FormSchema>;

/**
 * Se monta cuando ya se conocen la zona del entrenador y el alta del cliente: «hoy» y los límites
 * de la fecha son los suyos desde el primer render, que es el único que lee `useForm`.
 */
export function WeightForm({
  today,
  startDate,
  onSubmit,
  isSaving,
  saveError,
}: {
  today: CivilDate;
  startDate: CivilDate;
  onSubmit: (values: WeightFormValues) => Promise<unknown>;
  isSaving: boolean;
  saveError: boolean;
}) {
  const form = useForm<FormInput, unknown, WeightFormValues>({
    resolver: zodResolver(formSchemaFor({ today, startDate })),
    defaultValues: { weightKg: "", date: today, note: "" },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    form.reset({ weightKg: "", date: today, note: "" });
  });

  return (
    <Card className="gap-[18px] p-7 py-7">
      <CardHeader className="p-0">
        <CardTitle className="text-text-primary text-[16px]">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <form onSubmit={submit} noValidate className="flex flex-col gap-[18px]">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="weight-kg">{t.weight}</Label>
              <Input
                id="weight-kg"
                inputMode="decimal"
                autoComplete="off"
                aria-invalid={errors.weightKg ? true : undefined}
                className="font-display h-14 text-[26px] font-semibold"
                {...form.register("weightKg")}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="weight-date">{t.date}</Label>
              <Input
                id="weight-date"
                type="date"
                min={startDate}
                max={today}
                aria-invalid={errors.date ? true : undefined}
                className="h-14"
                {...form.register("date")}
              />
            </div>
          </div>
          {errors.weightKg || errors.date ? (
            <p role="alert" className="text-danger text-sm">
              {errors.weightKg?.message ?? errors.date?.message}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="weight-note">{t.note}</Label>
            <Input id="weight-note" placeholder={t.notePlaceholder} {...form.register("note")} />
          </div>
          <Button type="submit" size="lg" disabled={isSaving} className="w-full">
            {isSaving ? t.saving : t.submit}
          </Button>
          {saveError ? <ErrorState message={t.saveError} /> : null}
        </form>
      </CardContent>
    </Card>
  );
}
