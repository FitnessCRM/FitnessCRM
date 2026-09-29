import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensReview.measurements;

export interface MeasurementField {
  typeId: string;
  label: string;
  unit: string;
  value: string;
  /** El texto no es un número: se marca y no cuenta como medida. */
  invalid: boolean;
}

/** Un campo por tipo de medida EXIGIDO al abrir la revisión (requisitos congelados, I5). */
export function MeasurementsBlock({
  fields,
  editable,
  onChange,
}: {
  fields: MeasurementField[];
  editable: boolean;
  onChange: (typeId: string, value: string) => void;
}) {
  const units = [...new Set(fields.map((f) => f.unit))];
  const sharedUnit = units.length === 1 ? units[0] : null;
  return (
    <Card className="gap-3.5 p-6 py-6">
      <CardHeader className="p-0">
        <CardTitle className="text-text-primary text-[16px]">
          {t.title}
          {sharedUnit ? (
            <span className="font-ui text-text-muted ml-1.5 text-xs font-normal tracking-normal normal-case">
              ({sharedUnit})
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 p-0 md:grid-cols-4">
        {fields.map((f) => (
          <div key={f.typeId} className="flex flex-col gap-1.5">
            <Label htmlFor={`measure-${f.typeId}`} className="text-[11px]">
              {f.label}
              {sharedUnit ? "" : ` (${f.unit})`}
            </Label>
            <Input
              id={`measure-${f.typeId}`}
              inputMode="decimal"
              placeholder={t.placeholder}
              value={f.value}
              disabled={!editable}
              aria-invalid={f.invalid ? true : undefined}
              title={f.invalid ? t.invalid : undefined}
              onChange={(e) => onChange(f.typeId, e.target.value)}
              className={cn("h-11", f.value.trim() === "" && editable && "border-accent-strong")}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
