import { Card } from "@/components/ui/card";
import { es } from "@/lib/i18n/es";

const t = es.common.trainerNote;

/** Nota del entrenador (rutina o menú), firmada con su nombre de pila y sin fecha. */
export function TrainerNoteCard({ note, trainerName }: { note: string; trainerName?: string }) {
  const firstName = trainerName?.split(" ")[0];
  return (
    <Card className="gap-3 px-[22px] py-[22px]">
      <h2 className="section-title">{t.title}</h2>
      <p className="text-text-primary text-[14px] leading-relaxed whitespace-pre-line">{note}</p>
      {firstName ? <p className="text-text-subtle text-xs">— {firstName}</p> : null}
    </Card>
  );
}
