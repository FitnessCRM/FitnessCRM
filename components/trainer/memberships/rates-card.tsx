"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { useMembershipRates, useSaveMembershipRates } from "@/lib/data/hooks";
import type { MembershipRate, MembershipType } from "@/lib/domain";
import { parseEurosToCents } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensTrainerMemberships.rates;

interface RateDraft {
  active: boolean;
  /** Lo que escribe el entrenador, en euros; vacío es «sin precio». */
  price: string;
}

const toDraft = (rate: MembershipRate): RateDraft => ({
  active: rate.active,
  price: rate.priceCents === null ? "" : (rate.priceCents / 100).toFixed(2).replace(".", ","),
});

/** El precio del borrador en céntimos; `undefined` si lo escrito no es un precio. */
function draftCents(draft: RateDraft): number | null | undefined {
  if (draft.price.trim() === "") return null;
  return parseEurosToCents(draft.price) ?? undefined;
}

/**
 * Tarifas (E1, tarjeta 124). No tiene captura: es una propuesta con el sistema de diseño, dentro de
 * Membresías. Los cuatro tipos cerrados, cada uno con un interruptor y su precio en euros, que se
 * guarda en céntimos (E3). Activar sin precio vale: la tarifa queda ofrecida pero no se puede pagar
 * en línea hasta que lo tenga.
 */
export function RatesCard() {
  const rates = useMembershipRates();

  return (
    <Card className="gap-4 px-5 py-5">
      <div className="flex flex-col gap-1">
        <h2 className="section-title">{t.title}</h2>
        <p className="text-text-muted text-[13px]">{t.hint}</p>
      </div>
      {rates.isPending ? (
        <LoadingState />
      ) : rates.isError ? (
        <ErrorState onRetry={() => void rates.refetch()} />
      ) : (
        <RatesForm key={JSON.stringify(rates.data)} rates={rates.data} />
      )}
    </Card>
  );
}

function RatesForm({ rates }: { rates: MembershipRate[] }) {
  const save = useSaveMembershipRates();
  const [drafts, setDrafts] = useState(() => rates.map(toDraft));
  const [saved, setSaved] = useState(false);

  const invalid = drafts.map((d) => draftCents(d) === undefined);
  const changed = rates
    .map((rate, i) => ({ rate, draft: drafts[i]! }))
    .filter(({ rate, draft }) => {
      const cents = draftCents(draft);
      return cents !== undefined && (rate.active !== draft.active || rate.priceCents !== cents);
    })
    .map(({ rate, draft }) => ({ ...rate, active: draft.active, priceCents: draftCents(draft)! }));

  const update = (index: number, change: Partial<RateDraft>) => {
    setSaved(false);
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...change } : d)));
  };

  const submit = async () => {
    if (invalid.some(Boolean) || changed.length === 0) return;
    const ok = await save
      .mutateAsync(changed)
      .then(() => true)
      .catch(() => false);
    setSaved(ok);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <ul className="flex flex-col gap-2">
        {rates.map((rate, index) => {
          const draft = drafts[index]!;
          const typeLabel = es.status.membershipType[rate.type as MembershipType];
          const priceId = `rate-price-${rate.type}`;
          return (
            <li
              key={rate.type}
              className="border-border-subtle bg-surface-raised grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-lg border px-4 py-3 sm:grid-cols-[1fr_auto_140px]"
            >
              <span className="text-[14px] font-semibold">{typeLabel}</span>
              <Switch
                checked={draft.active}
                onCheckedChange={(active) => update(index, { active })}
                aria-label={t.activeLabel.replace("{type}", typeLabel.toLowerCase())}
              />
              <div className="col-span-2 flex flex-col gap-1 sm:col-span-1">
                <label htmlFor={priceId} className="sr-only">
                  {`${t.columns.price} · ${typeLabel}`}
                </label>
                <Input
                  id={priceId}
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.price}
                  placeholder={t.pricePlaceholder}
                  aria-invalid={invalid[index]}
                  onChange={(event) => update(index, { price: event.target.value })}
                  className={cn("h-10 text-right text-[14px]", !draft.active && "opacity-70")}
                />
                {invalid[index] ? (
                  <p role="alert" className="text-danger text-xs">
                    {t.priceInvalid}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {save.isError ? (
          <p role="alert" className="text-danger text-[13px]">
            {t.saveError}
          </p>
        ) : saved ? (
          <p aria-live="polite" className="text-success text-[13px]">
            {t.saved}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={save.isPending || changed.length === 0 || invalid.some(Boolean)}
          className="max-sm:w-full"
        >
          {save.isPending ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}
