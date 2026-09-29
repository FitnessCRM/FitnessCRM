"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/states";
import type { ReviewCompleteness, ReviewStatus } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensReview;

export interface MissingLabels {
  poses: string[];
  weight: boolean;
  measurements: string[];
  questions: string[];
}

/**
 * Barra de progreso y acciones. I5: si falta algo, se avisa con la lista y se deja enviar.
 * I17: con `vista` o `revisada` no hay acciones, solo el aviso.
 */
export function SubmitBar({
  status,
  completeness,
  missing,
  isSaving,
  saveError,
  onSave,
  onSubmit,
}: {
  status: ReviewStatus;
  completeness: ReviewCompleteness;
  missing: MissingLabels;
  isSaving: boolean;
  saveError: boolean;
  onSave: () => void;
  onSubmit: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const done = Object.values(completeness.blocks).filter(Boolean).length;
  const total = Object.keys(completeness.blocks).length;
  const editable = status === "borrador" || status === "enviada";

  const askOrSubmit = () => {
    if (completeness.complete) onSubmit();
    else setConfirming(true);
  };

  return (
    <div className="flex flex-col gap-3">
      {status !== "borrador" ? (
        <p className="text-text-muted text-[13px]">{t.banners[status]}</p>
      ) : null}
      {/* En móvil los botones bajan a su fila, apilados y con el principal arriba: al lado
          aplastaban la barra y, en borrador, «Enviar revisión» se salía de la columna. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="bg-border h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full">
          <div className="bg-accent h-full" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <span className="text-text-muted text-[13px]">
          {done} {t.progress.of} {total} {t.progress.blocks}
        </span>
        {editable ? (
          <div className="flex gap-3 max-sm:w-full max-sm:flex-col-reverse">
            <Button variant="secondary" disabled={isSaving} onClick={onSave}>
              {status === "borrador" ? t.actions.saveDraft : t.actions.saveChanges}
            </Button>
            {status === "borrador" ? (
              <Button size="lg" disabled={isSaving} onClick={askOrSubmit}>
                {isSaving ? t.actions.saving : t.actions.submit}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {saveError ? <ErrorState message={t.actions.saveError} /> : null}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.dialog.title}</DialogTitle>
            <DialogDescription>{t.dialog.intro}</DialogDescription>
          </DialogHeader>
          <ul className="text-text-muted list-disc space-y-1 pl-5 text-sm">
            {missing.poses.length ? (
              <li>
                {t.dialog.missingPhotos} {missing.poses.join(", ")}
              </li>
            ) : null}
            {missing.weight ? <li>{t.dialog.missingWeight}</li> : null}
            {missing.measurements.length ? (
              <li>
                {t.dialog.missingMeasurements} {missing.measurements.join(", ")}
              </li>
            ) : null}
            {missing.questions.length ? (
              <li>
                {t.dialog.missingQuestions} {missing.questions.join(" · ")}
              </li>
            ) : null}
          </ul>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t.dialog.cancel}
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
                onSubmit();
              }}
            >
              {t.dialog.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
