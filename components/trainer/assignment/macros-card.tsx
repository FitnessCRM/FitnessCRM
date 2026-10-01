"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetMacroTargets } from "@/lib/data/hooks";
import { DAY_TYPES, type DayType, type MacroTargets } from "@/lib/domain";
import { formatNumber, parseDecimalInput, parseWholeNumberInput } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensAssignment.macros;

const FIELDS = ["kcal", "proteinG", "carbsG", "fatG"] as const;
type Field = (typeof FIELDS)[number];
const FIELD_LABEL: Record<Field, string> = {
  kcal: t.kcal,
  proteinG: t.protein,
  carbsG: t.carbs,
  fatG: t.fat,
};

/**
 * Las kcal las escribe el entrenador (§5): solo dígitos, porque «2.000» no puede guardarse como 2.
 * Vacío es válido (el tipo de día queda sin objetivo); si hay texto, un entero mayor que cero.
 */
const kcalField = z
  .string()
  .trim()
  .refine((v) => v === "" || parseWholeNumberInput(v) > 0, es.common.kcalInvalid);

/** Un campo vacío es válido (el tipo de día queda sin objetivo); si hay texto, un número ≥ 0. */
const gramField = z
  .string()
  .trim()
  .refine((v) => {
    if (v === "") return true;
    const n = parseDecimalInput(v);
    return Number.isFinite(n) && n >= 0;
  }, t.invalid);
const dayFields = z
  .object({ kcal: kcalField, proteinG: gramField, carbsG: gramField, fatG: gramField })
  .superRefine((day, ctx) => {
    const filled = FIELDS.filter((f) => day[f] !== "").length;
    if (filled > 0 && filled < FIELDS.length) {
      ctx.addIssue({ code: "custom", message: t.incomplete, path: ["kcal"] });
    }
  });
const formSchema = z.object({ entrenamiento: dayFields, descanso: dayFields });
type FormValues = z.infer<typeof formSchema>;

function initialValues(targets: MacroTargets[]): FormValues {
  const day = (dayType: DayType) => {
    const macros = targets.find((m) => m.dayType === dayType)?.macros;
    return {
      kcal: macros ? String(macros.kcal) : "",
      proteinG: macros ? formatNumber(macros.proteinG) : "",
      carbsG: macros ? formatNumber(macros.carbsG) : "",
      fatG: macros ? formatNumber(macros.fatG) : "",
    };
  };
  return { entrenamiento: day("entrenamiento"), descanso: day("descanso") };
}

/**
 * Objetivo diario del cliente, uno por tipo de día. Independiente del menú (I4). Kcal y macros los
 * escribe el entrenador y se guardan tal cual: la app no deriva las kcal ni comprueba que cuadren
 * (§5). Guardar archiva el objetivo anterior de cada tipo de día rellenado; un tipo de día vacío
 * del todo se deja como está.
 */
export function MacrosCard({ clientId, targets }: { clientId: string; targets: MacroTargets[] }) {
  const setTargets = useSetMacroTargets(clientId);
  const [saved, setSaved] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues(targets),
  });

  const onSubmit = async (values: FormValues) => {
    setSaved(false);
    try {
      for (const dayType of DAY_TYPES) {
        const day = values[dayType];
        if (day.kcal === "") continue;
        await setTargets.mutateAsync({
          dayType,
          macros: {
            kcal: parseWholeNumberInput(day.kcal),
            proteinG: parseDecimalInput(day.proteinG),
            carbsG: parseDecimalInput(day.carbsG),
            fatG: parseDecimalInput(day.fatG),
          },
        });
      }
      setSaved(true);
    } catch {
      // El error se pinta desde el estado de la mutación.
    }
  };

  return (
    <Card className="gap-4 p-5 sm:p-[26px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="section-title">{t.title}</h2>
        <p className="text-text-subtle text-[13px]">{t.aside}</p>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        onChange={() => setSaved(false)}
        className="flex flex-col gap-5"
        noValidate
      >
        {DAY_TYPES.map((dayType) => (
          <fieldset key={dayType} className="flex flex-col gap-2.5">
            <legend className="tracking-label text-text-muted mb-2.5 text-xs uppercase">
              {es.status.dayType[dayType]}
            </legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {FIELDS.map((field) => {
                const id = `${dayType}-${field}`;
                const error = form.formState.errors[dayType]?.[field]?.message;
                return (
                  <div key={field} className="flex flex-col gap-1.5">
                    <Label htmlFor={id} className="tracking-label text-[11px] uppercase">
                      {FIELD_LABEL[field]}
                    </Label>
                    <Input
                      id={id}
                      inputMode={field === "kcal" ? "numeric" : "decimal"}
                      aria-invalid={error ? true : undefined}
                      {...form.register(`${dayType}.${field}`)}
                    />
                    {error ? (
                      <p role="alert" className="text-danger text-xs">
                        {error}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        {setTargets.isError ? (
          <p role="alert" className="text-danger text-sm">
            {t.saveError}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-success text-sm">
            {t.saved}
          </p>
        ) : null}
        <Button type="submit" variant="outline" size="lg" disabled={setTargets.isPending}>
          {setTargets.isPending ? t.saving : t.save}
        </Button>
      </form>
    </Card>
  );
}
