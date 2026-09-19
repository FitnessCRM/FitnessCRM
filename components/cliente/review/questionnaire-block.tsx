import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ResponseFormat } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensReview.questionnaire;

export interface QuestionField {
  questionId: string;
  prompt: string;
  /** Formato congelado en la respuesta si ya existe; si no, el del catálogo. */
  format: ResponseFormat;
  value: number | string | null;
}

/** Una entrada por pregunta EXIGIDA al abrir la revisión. Escala = botones; texto = área. */
export function QuestionnaireBlock({
  fields,
  editable,
  onChange,
}: {
  fields: QuestionField[];
  editable: boolean;
  onChange: (questionId: string, value: number | string) => void;
}) {
  return (
    <Card className="gap-5 p-6 py-6">
      <CardHeader className="p-0">
        <CardTitle className="text-text-primary text-[16px]">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 p-0">
        {fields.map((f) => (
          <fieldset key={f.questionId} className="flex flex-col gap-2.5">
            <legend className="text-[14px]">{f.prompt}</legend>
            {f.format.kind === "escala" ? (
              <div className="flex flex-wrap gap-2">
                {Array.from(
                  { length: f.format.max - f.format.min + 1 },
                  (_, i) => f.format.kind === "escala" && f.format.min + i,
                ).map((n) => (
                  <button
                    key={String(n)}
                    type="button"
                    disabled={!editable}
                    aria-pressed={f.value === n}
                    onClick={() => onChange(f.questionId, n as number)}
                    className={cn(
                      "font-display grid size-11 place-items-center rounded-md text-[16px] transition-colors disabled:cursor-not-allowed",
                      f.value === n
                        ? "bg-accent text-on-accent font-semibold"
                        : "bg-background border-border-emphasis text-text-muted hover:border-accent hover:text-text-primary border",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <Textarea
                value={typeof f.value === "string" ? f.value : ""}
                disabled={!editable}
                placeholder={t.textPlaceholder}
                rows={3}
                onChange={(e) => onChange(f.questionId, e.target.value)}
              />
            )}
          </fieldset>
        ))}
      </CardContent>
    </Card>
  );
}
