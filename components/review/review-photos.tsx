"use client";

import { useReviewPhotos, type PhotoState } from "@/lib/data/hooks";
import { POSES, type Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.review.photos;

const placeholder =
  "bg-[repeating-linear-gradient(45deg,var(--color-surface-raised),var(--color-surface-raised)_8px,var(--color-surface-overlay)_8px,var(--color-surface-overlay)_16px)]";

/**
 * Las tres fotos, solo lectura y siempre en tres columnas, también en el móvil: las poses se
 * comparan una junto a otra. Si alguna no se puede cargar se explica una vez, debajo.
 */
export function ReviewPhotos({ review }: { review: Review }) {
  const photos = useReviewPhotos(review.media);
  const missing = POSES.some((pose) => photos[pose].status === "unavailable");

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-4 max-sm:gap-2">
        {POSES.map((pose) => (
          <Photo
            key={pose}
            label={`${t.poseLabel} ${es.status.pose[pose].toLowerCase()}`}
            photo={photos[pose]}
          />
        ))}
      </div>
      {missing ? <p className="text-text-subtle text-xs">{t.missingHint}</p> : null}
    </div>
  );
}

function Photo({ label, photo }: { label: string; photo: PhotoState }) {
  return (
    <figure
      className={cn(
        "border-border-subtle relative flex aspect-[3/4] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border px-1.5",
        photo.status !== "ready" && placeholder,
      )}
    >
      {photo.status === "ready" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url} alt={label} className="size-full object-cover" />
      ) : (
        <>
          <p className="text-text-muted bg-background/70 rounded px-1.5 text-center font-mono text-xs">
            {label}
          </p>
          <figcaption className="text-text-subtle text-center text-xs">
            {photo.status === "empty" ? t.none : photo.status === "unavailable" ? t.missing : null}
          </figcaption>
        </>
      )}
    </figure>
  );
}
