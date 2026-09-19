"use client";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { derivedKcal, type Menu } from "@/lib/domain";
import { formatInteger, formatNumber } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensMenu.menus;

/** "aporta 2.348 kcal · P 165 · C 260 · G 72", siempre con el verbo delante: no es un objetivo. */
function providesLine(menu: Menu): string {
  const { proteinG, carbsG, fatG } = menu.macros;
  const macros = [
    `P ${formatNumber(proteinG)}`,
    `C ${formatNumber(carbsG)}`,
    `G ${formatNumber(fatG)}`,
  ];
  return `${t.provides} ${formatInteger(derivedKcal(menu.macros))} ${es.screensMenu.target.kcal} · ${macros.join(" · ")}`;
}

/** Un menú del tipo de día elegido: comidas y alimentos con su peso. Sugerencia, no registro. */
export function MenuCard({ menu, defaultOpen }: { menu: Menu; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `menu-${menu.id}`;

  return (
    <article
      className={cn(
        "rounded-xl border",
        open ? "border-accent-outline bg-surface" : "border-border-subtle bg-surface",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="focus-visible:ring-ring/50 flex w-full items-center gap-3 px-[22px] py-[18px] text-left outline-none focus-visible:ring-[3px] max-sm:flex-wrap"
      >
        <h2 className="font-display text-[17px] font-bold uppercase">{menu.name}</h2>
        {menu.suggested ? (
          <span className="bg-accent text-on-accent tracking-label rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase">
            {t.suggested}
          </span>
        ) : null}
        <span className="text-text-muted ml-auto text-[13px] max-sm:ml-0 max-sm:w-full">
          {providesLine(menu)}
        </span>
        {open ? (
          <ChevronDownIcon aria-hidden className="text-text-muted size-4 shrink-0" />
        ) : (
          <ChevronRightIcon aria-hidden className="text-text-muted size-4 shrink-0" />
        )}
      </button>

      {open ? (
        <div id={panelId} className="flex flex-col gap-4 px-[22px] pb-5">
          <p className="text-text-subtle border-border-subtle border-t pt-3.5 text-xs leading-snug">
            {t.declared}
          </p>
          {menu.meals.map((meal) => (
            <section key={meal.id}>
              <h3 className="text-accent tracking-label mb-1.5 text-[13px] font-semibold uppercase">
                {meal.name}
              </h3>
              <ul>
                {meal.items.map((item, index) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between gap-4 py-2.5 text-[14px]",
                      index < meal.items.length - 1 && "border-border-subtle border-b",
                    )}
                  >
                    <span className="text-text-primary">{item.name}</span>
                    <span className="text-text-muted shrink-0">
                      {formatNumber(item.grams)} {t.grams}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </article>
  );
}
