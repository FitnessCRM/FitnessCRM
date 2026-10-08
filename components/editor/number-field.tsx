import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Campo numérico con etiqueta. `value` nulo o 0 se pinta vacío; al vaciarlo, `onChange` recibe
 * `null` y quien lo usa decide si es «sin valor» (reps máx.) o «inválido» (series). Con `showZero`
 * el 0 se pinta: en los macros de un menú, 0 g es un valor y vacío es «sin rellenar». La etiqueta
 * va asociada al campo con un `id` propio: un lector de pantalla lee «Proteína (g)», no «160».
 */
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step,
  hint,
  placeholder,
  showZero = false,
  invalid,
  describedBy,
  className,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  step?: number | "any";
  hint?: string;
  /** Texto visible con el campo vacío: en táctil no hay `title`, así que lo que explica un vacío va aquí. */
  placeholder?: string;
  showZero?: boolean;
  invalid?: boolean;
  /** Id del mensaje que explica el campo o su error, cuando está fuera del campo. */
  describedBy?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={id} className="text-text-subtle tracking-label text-[11px] uppercase">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        step={step}
        value={
          value === null || Number.isNaN(value) || (value === 0 && !showZero) ? "" : String(value)
        }
        title={hint}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        className="h-10 px-2.5 text-center text-[14px]"
      />
    </div>
  );
}
