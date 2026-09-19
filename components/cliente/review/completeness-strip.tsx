import type { ReviewBlock, ReviewCompleteness } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensReview;
const ORDER: ReviewBlock[] = ["photos", "weight", "measurements", "questionnaire"];

/** Los cuatro bloques con su check. I5: informa, no bloquea. */
export function CompletenessStrip({ completeness }: { completeness: ReviewCompleteness }) {
  return (
    <div className="bg-surface border-border-subtle flex items-center gap-[18px] rounded-xl border px-5 py-3.5">
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
      <p className="border-border-emphasis text-text-muted max-w-[220px] border-l pl-[18px] text-[13px]">
        {t.stripNote}
      </p>
    </div>
  );
}
