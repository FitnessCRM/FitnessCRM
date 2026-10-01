import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Campo numérico con etiqueta. `value` nulo o 0 se pinta vacío; al vaciarlo, `onChange` recibe
 * `null` y quien lo usa decide si es «sin valor» (reps máx.) o «inválido» (series).
 */
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step,
  hint,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  step?: number | "any";
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label className="text-text-subtle tracking-label text-[11px] uppercase">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={value ? String(value) : ""}
        title={hint}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        className="h-10 px-2.5 text-center text-[14px]"
      />
    </div>
  );
}
