"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { EmptyState } from "@/components/ui/states";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DAY_TYPES, type DayType, type MacroTargets, type Menu } from "@/lib/domain";
import { useActiveMenus, useMacroTargets, useSessionClientId, useTrainer } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
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
    // En móvil la columna lateral sube (CLAUDE.md, «Columna lateral en móvil»): el objetivo y la
    // nota son contexto para leer los menús, así que van entre el selector y la lista.
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-5 max-lg:contents">
        <div className="max-lg:order-1">
          <PageHeader eyebrow={t.eyebrow} title={es.pages.client.menu} />
        </div>

        {/* El tipo de día lo elige el cliente: el estado manda y las pestañas van controladas. */}
        <Tabs
          className="max-lg:order-2"
          value={dayType}
          onValueChange={(value) => setDayType(value as DayType)}
        >
          <TabsList variant="segmented">
            {DAY_TYPES.map((type) => (
              <TabsTrigger key={type} value={type}>
                {es.status.dayType[type]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="max-lg:order-5">
          <QueryBoundary
            query={menus}
            isEmpty={(data) => (data ?? []).filter((m) => m.dayType === dayType).length === 0}
            empty={<EmptyState title={t.menus.empty.title} description={t.menus.empty.hint} />}
          >
            {(data) => <MenuList menus={data} dayType={dayType} />}
          </QueryBoundary>
        </div>
      </div>

      <div className="flex flex-col gap-4 max-lg:contents lg:pt-3.5">
        <div className="max-lg:order-3">
          <QueryBoundary query={targets} isEmpty={() => false} empty={null}>
            {(data) => <TargetCard {...splitTargets(data, dayType)} />}
          </QueryBoundary>
        </div>
        <div className="empty:hidden max-lg:order-4">
          <MenuNote menus={menus.data} dayType={dayType} trainerName={trainer.data?.name} />
        </div>
      </div>
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
