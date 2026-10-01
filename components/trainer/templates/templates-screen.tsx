"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  useDeleteTemplate,
  useDuplicateTemplate,
  useMenuTemplates,
  useRoutineTemplates,
  useTrainer,
} from "@/lib/data/hooks";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { DeleteDialog } from "./delete-dialog";
import { TemplateCard, type TemplateItem } from "./template-card";

const t = es.screensTemplates;

type Filter = "all" | "routine" | "menu";

/**
 * Pantalla 13 · Plantillas. Rutinas y menús reutilizables en una sola rejilla, con filtro por
 * tipo. Duplicar y eliminar salen del menú de cada tarjeta; crear y editar son del editor.
 */
export function TemplatesScreen() {
  const routines = useRoutineTemplates();
  const menus = useMenuTemplates();
  const trainer = useTrainer();
  const duplicate = useDuplicateTemplate();
  const remove = useDeleteTemplate();
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<TemplateItem | null>(null);

  const header = <PageHeader title={es.pages.trainer.plantillas} />;
  if (routines.isPending || menus.isPending) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <LoadingState />
      </div>
    );
  }
  if (routines.isError || menus.isError) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <ErrorState
          onRetry={() => {
            void routines.refetch();
            void menus.refetch();
          }}
        />
      </div>
    );
  }

  const items: TemplateItem[] = [
    ...routines.data.map((template) => ({ kind: "routine" as const, template })),
    ...menus.data.map((template) => ({ kind: "menu" as const, template })),
  ].sort((a, b) => b.template.updatedAt.localeCompare(a.template.updatedAt));
  const visible = items.filter((item) => filter === "all" || item.kind === filter);
  const today = todayCivil(trainer.data?.timeZone);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: t.filterAll, count: items.length },
    { id: "routine", label: t.filterRoutines, count: routines.data.length },
    { id: "menu", label: t.filterMenus, count: menus.data.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      {header}
      <p className="text-text-muted -mt-4 text-[13px]">{t.hint}</p>

      <div className="flex flex-wrap gap-2">
        {filters.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={cn(
              "focus-visible:ring-ring/50 h-10 rounded-md border px-3.5 text-[13px] transition-colors outline-none focus-visible:ring-[3px]",
              filter === id
                ? "border-border-strong bg-surface-overlay text-text-primary"
                : "border-border-emphasis text-text-muted hover:text-text-primary",
            )}
          >
            {label} · {count}
          </button>
        ))}
      </div>

      {duplicate.isError ? <ErrorState message={t.duplicateError} /> : null}

      {items.length === 0 ? (
        <EmptyState title={t.empty.title} description={t.empty.hint} />
      ) : visible.length === 0 ? (
        <EmptyState title={t.emptyFilter.title} description={t.emptyFilter.hint} />
      ) : (
        <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
          {visible.map((item) => (
            <TemplateCard
              key={`${item.kind}-${item.template.id}`}
              item={item}
              today={today}
              timeZone={trainer.data?.timeZone}
              onDuplicate={() =>
                duplicate.mutate({
                  kind: item.kind,
                  templateId: item.template.id,
                  name: `${item.template.name} ${t.copySuffix}`,
                })
              }
              onDelete={() => setDeleting(item)}
            />
          ))}
        </div>
      )}

      {deleting ? (
        <DeleteDialog
          name={deleting.template.name}
          usageCount={deleting.template.usageCount}
          isWorking={remove.isPending}
          hasError={remove.isError}
          onConfirm={async () => {
            await remove.mutateAsync({ kind: deleting.kind, templateId: deleting.template.id });
            setDeleting(null);
          }}
          onOpenChange={(open) => {
            if (!open) {
              remove.reset();
              setDeleting(null);
            }
          }}
        />
      ) : null}
    </div>
  );
}
