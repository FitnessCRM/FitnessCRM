"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseWholeNumberInput } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Campo de kcal: un entero que escribe el entrenador (§5). No pasa por `Number(raw)` ni por un
 * `<input type="number">`, porque «2.000» acabaría siendo 2: guarda el texto tal cual y entrega
 * `null` si está vacío, `NaN` si no son solo dígitos y el número si lo son. Sin valor propuesto.
 */
export function KcalField({
  id,
  label,
  value,
  onChange,
  invalid,
  className,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  invalid?: boolean;
  className?: string;
}) {
  // El texto vive aquí: un número no puede representar «2.000» ni «2,4» mientras se escribe.
  const [raw, setRaw] = useState(value === null || Number.isNaN(value) ? "" : String(value));

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <Label htmlFor={id} className="text-text-subtle tracking-label text-[11px] uppercase">
        {label}
      </Label>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        value={raw}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          setRaw(event.target.value);
          onChange(
            event.target.value.trim() === "" ? null : parseWholeNumberInput(event.target.value),
          );
        }}
        className="h-10 px-2.5 text-center text-[14px]"
      />
    </div>
  );
}
