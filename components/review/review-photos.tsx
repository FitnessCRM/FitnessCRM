"use client";

import { useState } from "react";
import { POSES, type Pose, type Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.review.photos;

const placeholder =
  "bg-[repeating-linear-gradient(45deg,var(--color-surface-raised),var(--color-surface-raised)_8px,var(--color-surface-overlay)_8px,var(--color-surface-overlay)_16px)]";

/**
 * Las tres fotos, solo lectura y siempre en tres columnas, también en el móvil: las poses se
 * comparan una junto a otra. Si alguna no carga se explica una vez, debajo: hoy se guardan como
 * `object URL` del navegador y no sobreviven a una recarga (deuda conocida, espera al backend).
 */
export function ReviewPhotos({ review }: { review: Review }) {
  const [broken, setBroken] = useState<ReadonlySet<Pose>>(new Set());
  const missing = POSES.filter((pose) => {
    const media = review.media.find((m) => m.pose === pose);
    return media !== undefined && broken.has(pose);
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-4 max-sm:gap-2">
        {POSES.map((pose) => {
          const media = review.media.find((m) => m.pose === pose);
          return (
            <Photo
              key={pose}
              label={`${t.poseLabel} ${es.status.pose[pose].toLowerCase()}`}
              url={media?.url}
              broken={broken.has(pose)}
              onBroken={() => setBroken((prev) => new Set(prev).add(pose))}
            />
          );
        })}
      </div>
      {missing.length > 0 ? <p className="text-text-subtle text-xs">{t.missingHint}</p> : null}
    </div>
  );
}

function Photo({
  label,
  url,
  broken,
  onBroken,
}: {
  label: string;
  url: string | undefined;
  broken: boolean;
  onBroken: () => void;
}) {
  const showImage = url !== undefined && !broken;

  return (
    <figure
      className={cn(
        "border-border-subtle relative flex aspect-[3/4] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border px-1.5",
        !showImage && placeholder,
      )}
    >
      {showImage ? (
        /* La URL es un object URL del navegador (y mañana Storage): no hay loader de
           next/image detrás, y hace falta `onError` para avisar de que no se recuperó. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} onError={onBroken} className="size-full object-cover" />
      ) : (
        <>
          <p className="text-text-muted bg-background/70 rounded px-1.5 text-center font-mono text-xs">
            {label}
          </p>
          <figcaption className="text-text-subtle text-center text-xs">
            {url === undefined ? t.none : t.missing}
          </figcaption>
        </>
      )}
    </figure>
  );
}
