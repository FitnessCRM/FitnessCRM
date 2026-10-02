import { Card } from "@/components/ui/card";
import type { Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensTrainerReview.questionnaire;

/**
 * Respuestas leídas de la copia congelada de la revisión: enunciado y formato son los de cuando
 * se preguntó, no los del catálogo de hoy (I12).
 */
export function QuestionnaireTab({ review }: { review: Review }) {
  const scales = review.responses.filter((r) => r.format.kind === "escala");
  const texts = review.responses.filter((r) => r.format.kind === "texto" && r.value !== "");

  if (review.responses.length === 0) {
    return <p className="text-text-subtle text-[13px]">{t.none}</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card className="gap-5 px-[22px] py-[22px]">
        <h2 className="section-title">{t.scaleTitle}</h2>
        {scales.length === 0 ? <p className="text-text-subtle text-[13px]">{t.noScale}</p> : null}
        {scales.map((response) => {
          // I12: la escala es la congelada en la respuesta, de su mínimo a su máximo, no de 1.
          const { min, max } =
            response.format.kind === "escala" ? response.format : { min: 0, max: -1 };
          return (
            <div
              key={response.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
            >
              <p className="text-[14px]">{response.prompt}</p>
              <div
                role="img"
                aria-label={`${response.value} ${t.scaleOf} ${max}`}
                className="flex gap-1.5"
              >
                {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
                  <span
                    key={n}
                    aria-hidden
                    className={cn(
                      "font-display flex size-9 items-center justify-center rounded-md border text-[14px]",
                      n === response.value
                        ? "bg-accent text-on-accent border-transparent font-bold"
                        : "border-border-subtle text-text-subtle",
                    )}
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </Card>

      <Card className="gap-5 px-[22px] py-[22px]">
        <h2 className="section-title">{t.textTitle}</h2>
        {texts.length === 0 ? <p className="text-text-subtle text-[13px]">{t.noText}</p> : null}
        {texts.map((response) => (
          <div key={response.id}>
            <p className="text-text-subtle text-xs">{response.prompt}</p>
            <p className="bg-surface-raised text-text-primary mt-1.5 rounded-lg px-4 py-3 text-[14px] leading-relaxed">
              «{response.value}»
            </p>
          </div>
        ))}
      </Card>
    </div>
  );
}
