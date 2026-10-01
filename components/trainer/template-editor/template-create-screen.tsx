"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useSaveMenuTemplate, useSaveRoutineTemplate } from "@/lib/data/hooks";
import { templateKindSchema } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensTemplateEditor;
const tList = es.screensTemplates;

/** Mensajes en español sobre las mismas reglas que `templateDraftSchema`; el adaptador vuelve a validar. */
const formSchema = z.object({
  kind: templateKindSchema,
  name: z.string().trim().min(1, t.nameRequired),
  description: z.string().trim(),
});
type FormValues = z.output<typeof formSchema>;

/**
 * Alta de plantilla: solo lo mínimo (tipo, nombre, descripción). El contenido se rellena en el
 * editor, a donde se va al guardar. Una plantilla nace vacía: no hay nada que copiar todavía.
 */
export function TemplateCreateScreen() {
  const router = useRouter();
  const saveRoutine = useSaveRoutineTemplate();
  const saveMenu = useSaveMenuTemplate();
  const form = useForm<z.input<typeof formSchema>, unknown, FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { kind: "routine", name: "", description: "" },
  });
  const isSaving = saveRoutine.isPending || saveMenu.isPending;

  const onSubmit = async (values: FormValues) => {
    try {
      const saved =
        values.kind === "routine"
          ? await saveRoutine.mutateAsync({
              name: values.name,
              description: values.description,
              note: "",
              days: [],
            })
          : await saveMenu.mutateAsync({
              name: values.name,
              description: values.description,
              menus: [],
            });
      router.push(`/templates/${values.kind}/${saved.id}`);
    } catch {
      // El error se pinta desde el estado de la mutación.
    }
  };

  const kinds = [
    { id: "routine", label: tList.kindRoutine },
    { id: "menu", label: tList.kindMenu },
  ] as const;

  return (
    <div className="flex max-w-[640px] flex-col gap-6">
      <Link href="/templates" className="text-text-muted hover:text-text-primary w-fit text-[13px]">
        {t.back}
      </Link>
      <PageHeader title={t.createTitle} />
      <p className="text-text-muted -mt-4 text-[13px]">{t.copiedNote}</p>

      <Card className="p-5">
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label>{t.kind}</Label>
            <Controller
              control={form.control}
              name="kind"
              render={({ field }) => (
                <div role="radiogroup" aria-label={t.kind} className="flex gap-2">
                  {kinds.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={field.value === id}
                      onClick={() => field.onChange(id)}
                      className={cn(
                        "focus-visible:ring-ring/50 h-10 rounded-md border px-4 text-[13px] transition-colors outline-none focus-visible:ring-[3px]",
                        field.value === id
                          ? "border-border-strong bg-surface-overlay text-text-primary"
                          : "border-border-emphasis text-text-muted hover:text-text-primary",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">{t.name}</Label>
            <Input
              id="template-name"
              placeholder={t.namePlaceholder}
              aria-invalid={form.formState.errors.name ? true : undefined}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p role="alert" className="text-danger text-[13px]">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-description">{t.description}</Label>
            <Textarea
              id="template-description"
              rows={2}
              placeholder={t.descriptionPlaceholder}
              {...form.register("description")}
            />
          </div>

          {saveRoutine.isError || saveMenu.isError ? <ErrorState message={t.createError} /> : null}

          <div className="flex justify-end gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t.creating : t.create}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
