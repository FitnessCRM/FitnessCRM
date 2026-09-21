import type { ReviewBlock, ReviewCompleteness } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensReview;
const ORDER: ReviewBlock[] = ["photos", "weight", "measurements", "questionnaire"];

/** Los cuatro bloques con su check. I5: informa, no bloquea. */
export function CompletenessStrip({ completeness }: { completeness: ReviewCompleteness }) {
  return (
    <div className="bg-surface border-border-subtle flex flex-col gap-3 rounded-xl border px-5 py-3.5 sm:flex-row sm:items-center sm:gap-[18px]">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:flex sm:items-center sm:gap-[18px]">
        {ORDER.map((block) => {
          const done = completeness.blocks[block];
          return (
            <div key={block} className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "grid size-[22px] place-items-center rounded-full text-[13px] font-bold",
                  done ? "bg-success text-background-deep" : "border-accent border-2",
                )}
              >
                {done ? "✓" : ""}
              </span>
              <span className={cn("text-[13px]", done ? "text-text-primary" : "text-text-muted")}>
                {t.blocks[block]}
              </span>
            </div>
          );
        })}
      </div>
      <p className="border-border-emphasis text-text-muted border-t pt-3 text-[13px] sm:max-w-[220px] sm:border-t-0 sm:border-l sm:pt-0 sm:pl-[18px]">
        {t.stripNote}
      </p>
    </div>
  );
}
