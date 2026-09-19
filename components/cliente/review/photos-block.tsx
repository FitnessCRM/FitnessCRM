"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { POSES, type Pose, type ReviewMedia } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensReview.photos;

function PhotoSlot({
  pose,
  media,
  editable,
  onPick,
}: {
  pose: Pose;
  media: ReviewMedia | undefined;
  editable: boolean;
  onPick: (pose: Pose, file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={cn(
        "border-border-subtle relative flex aspect-[3/4] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border bg-cover bg-center",
        !media &&
          "bg-[repeating-linear-gradient(45deg,var(--color-surface-raised),var(--color-surface-raised)_8px,var(--color-surface-overlay)_8px,var(--color-surface-overlay)_16px)]",
      )}
      style={media ? { backgroundImage: `url(${media.url})` } : undefined}
    >
      <span className="text-text-muted bg-background/70 rounded px-1.5 font-mono text-xs">
        {t.poseLabel} {es.status.pose[pose].toLowerCase()}
      </span>
      {media ? (
        <span className="text-success bg-background/70 rounded px-1.5 text-[11px]">{t.done}</span>
      ) : null}
      {editable ? (
        <>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(pose, file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-1"
            onClick={() => input.current?.click()}
          >
            {media ? t.replace : t.upload}
          </Button>
        </>
      ) : null}
    </div>
  );
}

/** Tres poses cerradas (§5). El adaptador guarda una URL; aquí es un object URL del navegador. */
export function PhotosBlock({
  media,
  editable,
  onPick,
}: {
  media: ReviewMedia[];
  editable: boolean;
  onPick: (pose: Pose, file: File) => void;
}) {
  const uploaded = media.length;
  return (
    <Card className="gap-3.5 p-6 py-6">
      <CardHeader className="flex-row items-center justify-between p-0">
        <CardTitle className="text-text-primary text-[16px]">{t.title}</CardTitle>
        <span
          className={cn("text-xs", uploaded === POSES.length ? "text-success" : "text-text-muted")}
        >
          {uploaded} {t.uploaded}
          {uploaded === POSES.length ? " ✓" : ""}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5 p-0">
        <div className="grid grid-cols-3 gap-3">
          {POSES.map((pose) => (
            <PhotoSlot
              key={pose}
              pose={pose}
              media={media.find((m) => m.pose === pose)}
              editable={editable}
              onPick={onPick}
            />
          ))}
        </div>
        <p className="text-text-subtle text-xs">{t.hint}</p>
      </CardContent>
    </Card>
  );
}
