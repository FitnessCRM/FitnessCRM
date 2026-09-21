"use client";

import { useState } from "react";
import { POSES, type Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensViewReview.photos;

const placeholder =
  "bg-[repeating-linear-gradient(45deg,var(--color-surface-raised),var(--color-surface-raised)_8px,var(--color-surface-overlay)_8px,var(--color-surface-overlay)_16px)]";

/**
 * Las tres fotos, solo lectura. Si la imagen no carga se dice por qué: hoy se guardan como
 * `object URL` del navegador y no sobreviven a una recarga (deuda conocida, espera al backend).
 */
export function ReviewPhotos({ review }: { review: Review }) {
  return (
    <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
      {POSES.map((pose) => {
        const media = review.media.find((m) => m.pose === pose);
        return (
          <Photo
            key={pose}
            label={`${t.poseLabel} ${es.status.pose[pose].toLowerCase()}`}
            url={media?.url}
          />
        );
      })}
    </div>
  );
}

function Photo({ label, url }: { label: string; url: string | undefined }) {
  const [broken, setBroken] = useState(false);
  const showImage = url !== undefined && !broken;

  return (
    <figure
      className={cn(
        "border-border-subtle relative flex aspect-[3/4] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border",
        !showImage && placeholder,
      )}
    >
      {showImage ? (
        /* La URL es un object URL del navegador (y mañana Storage): no hay loader de
           next/image detrás, y hace falta `onError` para avisar de que no se recuperó. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={label}
          onError={() => setBroken(true)}
          className="size-full object-cover"
        />
      ) : (
        <>
          <p className="text-text-muted bg-background/70 rounded px-1.5 font-mono text-xs">
            {label}
          </p>
          <figcaption className="text-text-subtle max-w-[85%] text-center text-xs">
            {url === undefined ? t.none : t.missing}
            {url !== undefined ? <span className="mt-1 block">{t.missingHint}</span> : null}
          </figcaption>
        </>
      )}
    </figure>
  );
}
