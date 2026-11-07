"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMembershipRates } from "@/lib/data/hooks";
import { suggestedManualPriceCents, type MembershipType } from "@/lib/domain";
import { formatCentsForInput, formatPriceCents, parseEurosToCents } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.manualMembershipPrice;

export interface ManualPrice {
  /** Lo que hay escrito, en euros. */
  text: string;
  setText: (text: string) => void;
  /** En céntimos; `null` si el campo está vacío (sin precio). Sin sentido mientras `invalid`. */
  cents: number | null;
  invalid: boolean;
  /** Precio de la tarifa del tipo elegido, o `null` si no tiene: decide el texto de ayuda. */
  rateCents: number | null;
  /** Vuelve a seguir a la tarifa, como al abrir el formulario. */
  reset: () => void;
}

/**
 * Precio cobrado de un registro manual (tarjeta 127). Propone el de la tarifa del tipo y lo sigue
 * mientras el entrenador no lo toque, igual que el fin sigue al tipo. Si las tarifas no cargan
 * (o no hay), el campo queda vacío y se puede guardar sin precio: no bloquea el registro.
 */
export function useManualPrice(type: MembershipType): ManualPrice {
  const rates = useMembershipRates();
  const suggested = rates.data ? suggestedManualPriceCents(rates.data, type) : null;
  const [text, setTextState] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) setTextState(suggested === null ? "" : formatCentsForInput(suggested));
  }, [suggested, touched]);

  const empty = text.trim() === "";
  const cents = empty ? null : parseEurosToCents(text);
  return {
    text,
    setText: (next) => {
      setTouched(true);
      setTextState(next);
    },
    cents,
    invalid: !empty && cents === null,
    rateCents: suggested,
    reset: () => setTouched(false),
  };
}

export function ManualPriceField({
  id,
  type,
  price,
}: {
  id: string;
  type: MembershipType;
  price: ManualPrice;
}) {
  const typeLabel = es.status.membershipType[type].toLowerCase();
  const hintId = `${id}-hint`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t.label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={price.text}
        placeholder={t.placeholder}
        aria-invalid={price.invalid}
        aria-describedby={hintId}
        onChange={(event) => price.setText(event.target.value)}
      />
      {price.invalid ? (
        <p role="alert" className="text-danger text-xs">
          {t.invalid}
        </p>
      ) : null}
      <p id={hintId} className="text-text-subtle text-xs">
        {price.rateCents === null
          ? t.noRate.replace("{type}", typeLabel)
          : t.fromRate
              .replace("{type}", typeLabel)
              .replace("{price}", formatPriceCents(price.rateCents))}
      </p>
    </div>
  );
}
