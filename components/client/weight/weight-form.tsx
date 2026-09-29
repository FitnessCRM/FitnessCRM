"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/ui/states";
import { civilDateSchema, weightKgSchema, type CivilDate } from "@/lib/domain";
import { parseDecimalInput } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screens.weight.form;

/** El campo de peso admite coma decimal; el valor final lo valida el esquema del dominio. */
const formSchema = z.object({
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
  date: z.string().refine((v) => civilDateSchema.safeParse(v).success, { message: t.dateInvalid }),
  note: z.string().trim(),
});

type FormInput = z.input<typeof formSchema>;
export type WeightFormValues = z.output<typeof formSchema>;

export function WeightForm({
  today,
  onSubmit,
  isSaving,
  saveError,
}: {
  today: CivilDate;
  onSubmit: (values: WeightFormValues) => Promise<unknown>;
  isSaving: boolean;
  saveError: boolean;
}) {
  const form = useForm<FormInput, unknown, WeightFormValues>({
    resolver: zodResolver(formSchema),
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
