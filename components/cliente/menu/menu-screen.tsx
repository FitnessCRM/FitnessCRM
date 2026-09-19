"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { EmptyState } from "@/components/ui/states";
import { DAY_TYPES, type DayType, type MacroTargets, type Menu } from "@/lib/domain";
import { useActiveMenus, useMacroTargets, useSessionClientId, useTrainer } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { TrainerNoteCard } from "../trainer-note-card";
import { MenuCard } from "./menu-card";
import { TargetCard } from "./target-card";

const t = es.screensMenu;

/**
 * Pantalla 03 · Tu menú. Dos cifras que se parecen y no son lo mismo conviven aquí: el objetivo
 * del cliente (`MacroTargets`) a la derecha y lo que cada menú declara aportar, siempre con el
 * verbo delante. La app no las compara ni las corrige: cuadrar o no es criterio del entrenador.
 */
export function MenuScreen() {
  const clientId = useSessionClientId();
  const trainer = useTrainer();
  const menus = useActiveMenus(clientId);
  const targets = useMacroTargets(clientId);
  // El tipo de día lo elige el cliente: nada en el dominio dice si hoy toca entrenar.
  const [dayType, setDayType] = useState<DayType>("entrenamiento");

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
      <div className="flex min-w-0 flex-col gap-5">
        <PageHeader eyebrow={t.eyebrow} title={es.pages.client.menu} />

        {/* Botones propios, no el Tabs de Radix: dentro del área de cliente sus ids no coinciden
            entre servidor y cliente y React avisa de hidratación. Mismo patrón que Rutina. */}
        <div
          role="tablist"
          aria-label={t.dayTypeLabel}
          className="bg-surface flex w-fit gap-1 rounded-md p-1"
        >
          {DAY_TYPES.map((type) => {
            const active = type === dayType;
            return (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setDayType(type)}
                className={cn(
                  "font-display focus-visible:ring-ring/50 rounded-sm px-3.5 py-2 text-[13px] tracking-[1px] uppercase transition-colors outline-none focus-visible:ring-[3px]",
                  active
                    ? "bg-border-strong text-text-primary"
                    : "text-text-muted hover:text-text-primary",
                )}
              >
                {es.status.dayType[type]}
              </button>
            );
          })}
        </div>

        <QueryBoundary
          query={menus}
          isEmpty={(data) => (data ?? []).filter((m) => m.dayType === dayType).length === 0}
          empty={<EmptyState title={t.menus.empty.title} description={t.menus.empty.hint} />}
        >
          {(data) => <MenuList menus={data} dayType={dayType} />}
        </QueryBoundary>
      </div>

      <aside className="flex flex-col gap-4 lg:pt-3.5">
        <QueryBoundary query={targets} isEmpty={() => false} empty={null}>
          {(data) => <TargetCard {...splitTargets(data, dayType)} />}
        </QueryBoundary>
        <MenuNote menus={menus.data} dayType={dayType} trainerName={trainer.data?.name} />
      </aside>
    </div>
  );
}

function splitTargets(targets: MacroTargets[], dayType: DayType) {
  return {
    target: targets.find((m) => m.dayType === dayType),
    other: targets.find((m) => m.dayType !== dayType),
  };
}

/** El sugerido primero y abierto; los demás, plegados. */
function MenuList({ menus, dayType }: { menus: Menu[]; dayType: DayType }) {
  const ofDay = menus
    .filter((m) => m.dayType === dayType)
    .sort((a, b) => Number(b.suggested) - Number(a.suggested));
  return (
    <div className="flex flex-col gap-3">
      {ofDay.map((menu, index) => (
        <MenuCard key={menu.id} menu={menu} defaultOpen={index === 0} />
      ))}
    </div>
  );
}

/** La nota va con el menú sugerido del tipo de día que se está viendo. */
function MenuNote({
  menus,
  dayType,
  trainerName,
}: {
  menus: Menu[] | undefined;
  dayType: DayType;
  trainerName: string | undefined;
}) {
  const ofDay = (menus ?? []).filter((m) => m.dayType === dayType);
  const note = (ofDay.find((m) => m.suggested) ?? ofDay[0])?.note;
  if (!note) return null;
  return <TrainerNoteCard note={note} trainerName={trainerName} />;
}
