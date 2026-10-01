"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { externalUrlSchema, type Review } from "@/lib/domain";
import { useReviewMutation } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";

const t = es.screensTrainerReview.feedback;

/**
 * El feedback es el enlace del vídeo (I20): una URL completa, y es lo único obligatorio. La nota
 * es opcional.
 */
const formSchema = z.object({
  videoUrl: z
    .string()
    .trim()
    .min(1, t.videoRequired)
    .refine((v) => externalUrlSchema.safeParse(v).success, { message: t.videoInvalid }),
  note: z.string().trim(),
});

type FormValues = z.output<typeof formSchema>;

/**
 * «Enviar feedback»: enlace de vídeo (obligatorio) y nota (opcional). Solo se puede enviar sobre una revisión `vista`, y
 * al enviarlo pasa a `revisada` (§1.8).
 */
export function FeedbackDialog({ review }: { review: Review }) {
  const [open, setOpen] = useState(false);
  const mutation = useReviewMutation();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { videoUrl: "", note: "" },
  });
  const errors = form.formState.errors;
  // Hasta que la revisión se marca como vista no hay feedback que enviar.
  const canSend = review.status === "vista";

  const onOpenChange = (next: boolean) => {
    if (mutation.isPending) return;
    setOpen(next);
    if (!next) {
      form.reset();
      mutation.reset();
    }
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync({
        reviewId: review.id,
        feedback: { videoUrl: values.videoUrl, note: values.note },
      });
      setOpen(false);
    } catch {
      // El aviso sale de `mutation.isError`: el diálogo sigue abierto con lo escrito.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="flex flex-col items-end gap-1">
        <DialogTrigger asChild>
          <Button disabled={!canSend} className="min-h-11">
            {t.action}
          </Button>
        </DialogTrigger>
        {review.status === "enviada" ? (
          <p className="text-text-subtle text-xs">{t.waiting}</p>
        ) : null}
      </div>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t.title} — {es.screensReview.week} {review.weekNumber}
          </DialogTitle>
          <DialogDescription>{t.description}</DialogDescription>
        </DialogHeader>

        <form id="feedback-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feedback-video">{t.videoLabel}</Label>
            <Input
              id="feedback-video"
              inputMode="url"
              placeholder="https://…"
              autoComplete="off"
              {...form.register("videoUrl")}
              aria-invalid={!!errors.videoUrl}
            />
            {errors.videoUrl ? (
              <p className="text-danger text-xs">{errors.videoUrl.message}</p>
            ) : (
              <p className="text-text-subtle text-xs">{t.videoHint}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feedback-note">{t.noteLabel}</Label>
            <Textarea
              id="feedback-note"
              placeholder={t.notePlaceholder}
              {...form.register("note")}
            />
          </div>
          {mutation.isError ? (
            <p role="alert" className="text-danger text-sm">
              {t.error}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t.cancel}
          </Button>
          <Button type="submit" form="feedback-form" disabled={mutation.isPending}>
            {mutation.isPending ? t.sending : t.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
