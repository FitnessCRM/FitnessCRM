"use client";

import type { ReactNode } from "react";
import { Controller, useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { KcalField } from "@/components/editor/kcal-field";
import { NumberField } from "@/components/editor/number-field";
import { Button } from "@/components/ui/button";
import { FoodOriginBadges } from "@/components/ui/food-origin-badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/ui/states";
import { foodDraftSchema, type FoodDraft, type LibraryFood } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.foodForm;

const MACROS = ["proteinG", "carbsG", "fatG"] as const;
type MacroKey = (typeof MACROS)[number];

/** Lo que hay en el formulario: las cifras pueden estar vacías (`null`) o mal escritas (`NaN`). */
export interface FoodFormValues {
  name: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

function valuesOf(food: LibraryFood | null, initialName: string): FoodFormValues {
  return {
    name: food?.name ?? initialName,
    kcal: food?.composition.kcal ?? null,
    proteinG: food?.composition.proteinG ?? null,
    carbsG: food?.composition.carbsG ?? null,
    fatG: food?.composition.fatG ?? null,
  };
}

const isMacro = (key: unknown): key is MacroKey => MACROS.includes(key as MacroKey);

/**
 * Valida contra `foodDraftSchema` del dominio, la única fuente de verdad, y devuelve el borrador ya
 * redondeado (3,55 → 3,6). Los mensajes salen de `es.ts`, no del esquema. El tope de 100 g llega
 * para la composición entera, sin campo: se cuelga de los tres macros, que son los que lo causan.
 */
const resolveFoodForm: Resolver<FoodFormValues, unknown, FoodDraft> = (values) => {
  const result = foodDraftSchema.safeParse({
    name: values.name,
    composition: {
      kcal: values.kcal,
      proteinG: values.proteinG,
      carbsG: values.carbsG,
      fatG: values.fatG,
    },
  });
  if (result.success) return { values: result.data, errors: {} };

  const errors: FieldErrors<FoodFormValues> = {};
  const add = (key: keyof FoodFormValues, message: string) => {
    errors[key] ??= { type: "validate", message };
  };
  for (const issue of result.error.issues) {
    const [head, key] = issue.path;
    if (head === "name") add("name", t.nameRequired);
    else if (head === "composition" && key === undefined)
      MACROS.forEach((macro) => add(macro, t.macrosOver));
    else if (key === "kcal") add("kcal", values.kcal === null ? t.kcalRequired : t.kcalWhole);
    else if (isMacro(key)) add(key, values[key] === null ? t.macroRequired : t.macroNegative);
  }
  return { values: {}, errors };
};

/**
 * Panel de un alimento. Lo tuyo se crea y se edita; lo que no es tuyo se abre con los mismos
 * campos, deshabilitados, y la razón escrita (§4, I28). Las cuatro cifras son por 100 g y las kcal
 * no se derivan de los macros (§5). Al guardar, quien lo usa vuelve a montarlo con lo guardado,
 * así que lo redondeado se lee en el campo.
 */
export function FoodForm({
  food,
  initialName = "",
  submitLabel = t.save,
  title,
  isSaving,
  saveError,
  onSubmit,
  onEdit,
  onDelete,
  onClose,
}: {
  /** `null` = alimento nuevo. */
  food: LibraryFood | null;
  /** El nombre con que nace uno nuevo: el que ya se había escrito en el menú. */
  initialName?: string;
  submitLabel?: string;
  /** El encabezado, que en el `Sheet` tiene que ser su título. */
  title: (text: string) => ReactNode;
  isSaving: boolean;
  saveError: boolean;
  onSubmit: (draft: FoodDraft, typed: FoodFormValues) => Promise<unknown>;
  /** Se ha cambiado algún campo: lo que dijo el último guardado ya no vale. */
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const form = useForm<FoodFormValues, unknown, FoodDraft>({
    resolver: resolveFoodForm,
    defaultValues: valuesOf(food, initialName),
  });
  const errors = form.formState.errors;
  const readOnly = food !== null && food.origin !== "own";
  const idPrefix = `food-${food?.id ?? "new"}`;
  const compositionMessageId = `${idPrefix}-composition-message`;
  const compositionErrors = [
    ...new Set(
      (["kcal", ...MACROS] as const)
        .map((key) => errors[key]?.message)
        .filter((m): m is string => !!m),
    ),
  ];

  const heading = food === null ? t.newTitle : readOnly ? t.viewTitle : t.editTitle;

  return (
    <div className="flex flex-col gap-4">
      {title(heading)}

      {food ? <FoodOriginBadges food={food} /> : null}
      {readOnly ? <p className="text-text-muted text-[13px]">{readOnlyReason(food)}</p> : null}

      <form
        noValidate
        className="flex flex-col gap-4"
        onChange={onEdit}
        onSubmit={form.handleSubmit(async (draft) => {
          await onSubmit(draft, form.getValues());
        })}
      >
        <fieldset disabled={readOnly || isSaving} className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-name`}>{t.name}</Label>
            <Input
              id={`${idPrefix}-name`}
              autoComplete="off"
              placeholder={t.namePlaceholder}
              {...form.register("name")}
              aria-invalid={!!errors.name || undefined}
              aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined}
            />
            {errors.name ? (
              <p id={`${idPrefix}-name-error`} className="text-danger text-xs">
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="text-text-subtle tracking-label mb-2 text-[11px] uppercase">
              {t.per100}
            </legend>
            <div className="grid grid-cols-2 items-end gap-3">
              <Controller
                control={form.control}
                name="kcal"
                render={({ field }) => (
                  <KcalField
                    id={`${idPrefix}-kcal`}
                    label={t.kcal}
                    value={field.value}
                    onChange={field.onChange}
                    invalid={!!errors.kcal}
                    describedBy={compositionMessageId}
                  />
                )}
              />
              {MACROS.map((macro) => (
                <Controller
                  key={macro}
                  control={form.control}
                  name={macro}
                  render={({ field }) => (
                    <NumberField
                      label={t[macroLabel[macro]]}
                      step="any"
                      showZero
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!errors[macro]}
                      describedBy={compositionMessageId}
                    />
                  )}
                />
              ))}
            </div>
            <div id={compositionMessageId} className="flex flex-col gap-1">
              {compositionErrors.length > 0 ? (
                compositionErrors.map((message) => (
                  <p key={message} className="text-danger text-xs">
                    {message}
                  </p>
                ))
              ) : readOnly ? null : (
                <p className="text-text-subtle text-xs">{t.hint}</p>
              )}
            </div>
          </fieldset>
        </fieldset>

        {food?.origin === "own" ? <p className="text-text-subtle text-xs">{t.menusKeep}</p> : null}
        {food?.origin === "own" && food.publishStatus === "pendiente" ? (
          <p className="text-text-muted text-[13px]">{t.pendingNote}</p>
        ) : null}

        {saveError ? <ErrorState message={t.saveError} /> : null}

        {readOnly ? (
          <Button type="button" variant="secondary" onClick={onClose}>
            {t.close}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSaving} className="flex-1">
              {isSaving ? t.saving : submitLabel}
            </Button>
            {food ? (
              <Button type="button" variant="secondary" onClick={onDelete} disabled={isSaving}>
                {t.delete}
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
                {t.cancel}
              </Button>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

const macroLabel = { proteinG: "protein", carbsG: "carbs", fatG: "fat" } as const;

function readOnlyReason(food: LibraryFood): string {
  if (food.origin === "other") return t.readOnly.other;
  if (food.origin === "seeded") return t.readOnly[food.source];
  return "";
}
