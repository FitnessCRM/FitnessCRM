"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/ui/states";
import { exerciseSchema, externalUrlSchema, type Exercise } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensLibrary.form;

/**
 * The rules come from the domain's `exerciseSchema`, so they live in one place. The only step the
 * form adds is turning "" into null for the video, which is how the domain stores "no video".
 * Its messages are the domain's, so the field errors below show the Spanish copy instead.
 */
const formSchema = exerciseSchema
  .pick({ name: true, muscleGroup: true, equipment: true, description: true })
  .extend({
    videoUrl: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .pipe(exerciseSchema.shape.videoUrl),
  });

/** The domain defaults make some fields optional on input; the form always supplies them. */
type ExerciseFormInput = z.input<typeof formSchema>;
export type ExerciseFormValues = z.output<typeof formSchema>;

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Edit panel. Group and equipment are free text in the domain: the field suggests the values
 * that already exist in the library (datalist) but does not close the list.
 */
export function ExerciseForm({
  exercise,
  groups,
  equipment,
  title,
  isSaving,
  saveError,
  onSubmit,
  onDelete,
  onCancel,
}: {
  /** `null` = new exercise. */
  exercise: Exercise | null;
  groups: string[];
  equipment: string[];
  /** The host renders the title: inside the `Sheet` it is a `SheetTitle`, not an `h2`. */
  title: (heading: string) => ReactNode;
  isSaving: boolean;
  saveError: boolean;
  onSubmit: (values: ExerciseFormValues) => Promise<unknown>;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const form = useForm<ExerciseFormInput, unknown, ExerciseFormValues>({
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
    <div className="flex flex-col gap-4">
      {title(exercise ? t.editTitle : t.newTitle)}

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
            <p className="text-danger text-xs">{t.nameRequired}</p>
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
            placeholder={t.videoPlaceholder}
            {...form.register("videoUrl")}
            aria-invalid={!!form.formState.errors.videoUrl}
          />
          {form.formState.errors.videoUrl ? (
            <p className="text-danger text-xs">{t.videoInvalid}</p>
          ) : (
            <p className="text-text-subtle text-xs">{t.videoExternal}</p>
          )}
          {/* Never embedded (I20): a link that says where it leads. */}
          {videoValid ? (
            <a
              href={videoUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-hover hover:text-accent-emphasis inline-flex items-center gap-1.5 text-[13px] underline-offset-4 hover:underline"
            >
              <ExternalLinkIcon aria-hidden className="size-3.5" />
              {t.videoOpenHost.replace("{host}", hostOf(videoUrl.trim()))}
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
    </div>
  );
}
