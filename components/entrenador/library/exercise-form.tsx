"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLinkIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ui/states";
import { externalUrlSchema, type Exercise } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensLibrary.form;

/** El vídeo es enlace externo (I20): o una URL completa, o nada. */
const formSchema = z.object({
  name: z.string().trim().min(1, t.nameRequired),
  muscleGroup: z.string().trim(),
  equipment: z.string().trim(),
  videoUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || externalUrlSchema.safeParse(v).success, { message: t.videoInvalid }),
  description: z.string().trim(),
});

export type ExerciseFormValues = z.output<typeof formSchema>;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Panel de edición. Grupo y material son texto libre en el dominio: el campo sugiere los que ya
 * existen en la biblioteca (datalist) pero no cierra la lista.
 */
export function ExerciseForm({
  exercise,
  groups,
  equipment,
  isSaving,
  saveError,
  onSubmit,
  onDelete,
  onCancel,
}: {
  /** `null` = ejercicio nuevo. */
  exercise: Exercise | null;
  groups: string[];
  equipment: string[];
  isSaving: boolean;
  saveError: boolean;
  onSubmit: (values: ExerciseFormValues) => Promise<unknown>;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const form = useForm<ExerciseFormValues>({
    resolver: zodResolver(formSchema),
    values: {
      name: exercise?.name ?? "",
      muscleGroup: exercise?.muscleGroup ?? "",
      equipment: exercise?.equipment ?? "",
      videoUrl: exercise?.videoUrl ?? "",
      description: exercise?.description ?? "",
    },
  });
  const videoUrl = form.watch("videoUrl");
  const videoValid = externalUrlSchema.safeParse(videoUrl.trim()).success;

  return (
    <Card className="gap-4 px-[22px] py-[22px]">
      <h2 className="section-title">{exercise ? t.editTitle : t.newTitle}</h2>

      <form
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit(async (values) => {
          await onSubmit(values);
        })}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-name">{t.name}</Label>
          <Input
            id="ex-name"
            {...form.register("name")}
            aria-invalid={!!form.formState.errors.name}
          />
          {form.formState.errors.name ? (
            <p className="text-danger text-xs">{form.formState.errors.name.message}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ex-group">{t.group}</Label>
            <Input
              id="ex-group"
              list="ex-groups"
              placeholder={t.placeholderGroup}
              {...form.register("muscleGroup")}
            />
            <datalist id="ex-groups">
              {groups.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ex-equipment">{t.equipment}</Label>
            <Input
              id="ex-equipment"
              list="ex-equipment-list"
              placeholder={t.placeholderEquipment}
              {...form.register("equipment")}
            />
            <datalist id="ex-equipment-list">
              {equipment.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-video">{t.videoUrl}</Label>
          <Input
            id="ex-video"
            inputMode="url"
            placeholder="https://…"
            {...form.register("videoUrl")}
            aria-invalid={!!form.formState.errors.videoUrl}
          />
          {form.formState.errors.videoUrl ? (
            <p className="text-danger text-xs">{form.formState.errors.videoUrl.message}</p>
          ) : (
            <p className="text-text-subtle text-xs">{t.videoExternal}</p>
          )}
          {/* Nunca embebido (I20): un enlace que dice a dónde lleva. */}
          {videoValid ? (
            <a
              href={videoUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-hover hover:text-accent-emphasis inline-flex items-center gap-1.5 text-[13px] underline-offset-4 hover:underline"
            >
              <ExternalLinkIcon aria-hidden className="size-3.5" />
              {t.videoOpen} · {hostOf(videoUrl.trim())}
            </a>
          ) : (
            <p className="text-text-subtle text-[13px]">{t.videoEmpty}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ex-description">{t.description}</Label>
          <Textarea id="ex-description" rows={4} {...form.register("description")} />
        </div>

        {saveError ? <ErrorState message={t.saveError} /> : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={isSaving} className="flex-1">
            {isSaving ? t.saving : t.save}
          </Button>
          {exercise ? (
            <Button type="button" variant="secondary" onClick={onDelete} disabled={isSaving}>
              {t.delete}
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
              {t.cancel}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
