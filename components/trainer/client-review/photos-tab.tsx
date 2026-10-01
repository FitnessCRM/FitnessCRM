"use client";

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POSES, type CivilDate, type Pose, type Review, type WeightLog } from "@/lib/domain";
import { formatShortDate, formatSignedDecimal } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { reviewDate, weightOf } from "./client-review-screen";
import { NativeSelect } from "./native-select";

const t = es.screensTrainerReview.photos;

const placeholder =
  "bg-[repeating-linear-gradient(45deg,var(--color-surface-raised),var(--color-surface-raised)_8px,var(--color-surface-overlay)_8px,var(--color-surface-overlay)_16px)]";

type Mode = "compare" | "single";

/**
 * Fotos de una pose, sola o contra otra revisión. Arranca en «solo actual»: comparar es algo que
 * el entrenador decide cada vez, nunca un estado que se active solo (I10).
 */
export function PhotosTab({
  review,
  others,
  logs,
  today,
}: {
  review: Review;
  others: Review[];
  logs: WeightLog[];
  today: CivilDate;
}) {
  const [pose, setPose] = useState<Pose>("frente");
  const [mode, setMode] = useState<Mode>("single");
  // La primera semana enviada es la referencia natural: lo que se quiere ver es la evolución.
  const [otherId, setOtherId] = useState<string | undefined>(
    [...others].sort((a, b) => a.weekNumber - b.weekNumber)[0]?.id,
  );
  const other = others.find((r) => r.id === otherId);
  const comparing = mode === "compare" && other !== undefined;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={pose} onValueChange={(value) => setPose(value as Pose)}>
          <TabsList variant="segmented" aria-label={t.poses}>
            {POSES.map((p) => (
              <TabsTrigger key={p} value={p} className="min-h-8">
                {es.status.pose[p]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={mode} onValueChange={(value) => setMode(value as Mode)}>
          <TabsList variant="segmented" aria-label={t.mode}>
            <TabsTrigger value="compare" className="min-h-8" disabled={others.length === 0}>
              {t.compare}
            </TabsTrigger>
            <TabsTrigger value="single" className="min-h-8">
              {t.single}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {others.length === 0 ? <p className="text-text-subtle text-[13px]">{t.noOther}</p> : null}

      <div className="flex gap-4 max-sm:gap-2">
        {comparing ? (
          <Panel
            review={other}
            pose={pose}
            today={today}
            header={
              <label className="flex flex-wrap items-center gap-2">
                <span className="text-text-subtle tracking-label font-display text-[13px] uppercase">
                  {t.compareWith}
                </span>
                <NativeSelect
                  value={other.id}
                  onChange={(event) => setOtherId(event.target.value)}
                  className="border-border-strong bg-surface h-9 text-[13px]"
                >
                  {others.map((r) => (
                    <option key={r.id} value={r.id}>
                      {es.screensReview.week} {r.weekNumber} ·{" "}
                      {formatShortDate(reviewDate(r), today)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            }
          />
        ) : null}
        <Panel
          review={review}
          pose={pose}
          today={today}
          current
          large={!comparing}
          header={
            <p className="text-accent tracking-label font-display text-[13px] uppercase">
              {t.current}
            </p>
          }
        />
      </div>

      {comparing ? <Difference from={other} to={review} logs={logs} /> : null}
    </>
  );
}

function Panel({
  review,
  pose,
  today,
  header,
  current = false,
  large = false,
}: {
  review: Review;
  pose: Pose;
  today: CivilDate;
  header: ReactNode;
  current?: boolean;
  /** Sola en pantalla, la foto puede crecer más que cuando comparte la fila con otra. */
  large?: boolean;
}) {
  const url = review.media.find((m) => m.pose === pose)?.url;
  const [broken, setBroken] = useState<string | null>(null);
  const showImage = url !== undefined && broken !== url;
  const label = `${t.poseLabel} ${es.status.pose[pose].toLowerCase()} · ${es.screensReview.week.toLowerCase()} ${review.weekNumber}`;
  const date = reviewDate(review);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-2">
        {header}
        <p className="text-text-muted text-xs">
          {es.screensReview.week} {review.weekNumber} ·{" "}
          <time dateTime={date}>{formatShortDate(date, today)}</time>
        </p>
      </div>
      <figure
        className={cn(
          "relative mx-auto flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border px-1.5 lg:max-w-full",
          large
            ? "max-lg:max-w-[460px] lg:w-[min(100%,calc(min(80vh,860px)*0.75))]"
            : "lg:w-[min(100%,calc(min(72vh,720px)*0.75))]",
          current ? "border-accent-outline" : "border-border-subtle",
          !showImage && placeholder,
        )}
      >
        {showImage ? (
          // La URL es un object URL del navegador (y mañana Drive): no hay loader de next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            onError={() => setBroken(url)}
            className="size-full object-cover"
          />
        ) : (
          <>
            <p className="text-text-muted bg-background/70 rounded px-1.5 text-center font-mono text-xs">
              {label}
            </p>
            <figcaption className="text-text-subtle text-center text-xs">
              {url === undefined ? t.noPhoto : t.unavailable}
            </figcaption>
          </>
        )}
      </figure>
    </div>
  );
}

/** Cambio entre las dos revisiones: el peso y las medidas que las dos tienen del mismo tipo. */
function Difference({ from, to, logs }: { from: Review; to: Review; logs: WeightLog[] }) {
  const [older, newer] = from.weekNumber <= to.weekNumber ? [from, to] : [to, from];
  const figures: { key: string; delta: number; unit: string; label: string }[] = [];

  const kgOld = weightOf(older, logs);
  const kgNew = weightOf(newer, logs);
  if (kgOld !== undefined && kgNew !== undefined) {
    figures.push({ key: "weight", delta: kgNew - kgOld, unit: "kg", label: t.diffWeight });
  }
  for (const m of newer.measurements) {
    const before = older.measurements.find((o) => o.measurementTypeId === m.measurementTypeId);
    // Una unidad distinta entre las dos no se resta: sería comparar cm con mm (I12).
    if (before && before.unit === m.unit) {
      figures.push({ key: m.id, delta: m.value - before.value, unit: m.unit, label: m.label });
    }
  }

  return (
    <Card className="flex-row flex-wrap items-baseline gap-x-8 gap-y-3 px-[22px] py-4">
      <p className="text-text-subtle tracking-label font-display text-[13px] uppercase">
        {t.diffTitle} S{older.weekNumber} → S{newer.weekNumber}
      </p>
      {figures.length === 0 ? (
        <p className="text-text-subtle text-[13px]">{t.diffNone}</p>
      ) : (
        figures.map((f) => (
          <p key={f.key} className="text-[14px]">
            <span className="font-display text-[22px] font-bold">
              {formatSignedDecimal(Math.round(f.delta * 10) / 10)}
            </span>{" "}
            <span className="text-text-muted text-xs">
              {f.unit} {f.label.toLowerCase()}
            </span>
          </p>
        ))
      )}
    </Card>
  );
}
