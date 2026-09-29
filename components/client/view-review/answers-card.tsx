import { Card } from "@/components/ui/card";
import type { Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensViewReview.answers;

/**
 * Las respuestas se leen de la **copia congelada** de la revisión (enunciado y formato), nunca
 * del catálogo actual: editar una pregunta hoy no reescribe lo que se preguntó entonces (I12).
 */
export function AnswersCard({ review }: { review: Review }) {
  const scales = review.responses.filter((r) => r.format.kind === "escala");
  const texts = review.responses.filter((r) => r.format.kind === "texto" && r.value !== "");

  return (
    <Card className="gap-4 px-[22px] py-[22px]">
      <h2 className="section-title">{t.title}</h2>
      {review.responses.length === 0 ? (
        <p className="text-text-subtle text-[13px]">{t.none}</p>
      ) : null}

      {scales.length > 0 ? (
        <div className="flex flex-wrap gap-x-7 gap-y-2.5">
          {scales.map((response) => (
            <p key={response.id} className="text-[14px]">
              <span className="text-text-muted">{response.prompt}</span>{" "}
              <span className="font-display font-semibold">
                {response.value}/{response.format.kind === "escala" ? response.format.max : ""}
              </span>
            </p>
          ))}
        </div>
      ) : null}

      {texts.map((response) => (
        <div key={response.id}>
          <p className="text-text-subtle text-xs">{response.prompt}</p>
          <p className="text-text-primary mt-1 text-[14px] leading-relaxed">«{response.value}»</p>
        </div>
      ))}
    </Card>
  );
}
