"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { EmptyState } from "@/components/ui/states";
import { canonicalText, type Exercise } from "@/lib/domain";
import {
  useArchiveExercise,
  useClients,
  useExerciseUsage,
  useExercises,
  useSaveExercise,
} from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { ArchiveDialog } from "./archive-dialog";
import { ExerciseForm, type ExerciseFormValues } from "./exercise-form";
import { ExerciseGrid } from "./exercise-grid";

const t = es.screensLibrary;

/** Valores distintos de un campo de texto libre, para sugerirlos en el formulario y filtrar. */
function distinct(exercises: Exercise[], field: "muscleGroup" | "equipment"): string[] {
  return [...new Set(exercises.map((e) => e[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/**
 * Pantalla 11 · Biblioteca. Rejilla filtrable a la izquierda y panel de edición a la derecha.
 * «Eliminar» archiva y avisa antes de a quién afecta (I13, §7); el vídeo es enlace externo (I20).
 */
export function LibraryScreen() {
  const exercises = useExercises();

  return (
    <QueryBoundary
      query={exercises}
      isEmpty={() => false}
      empty={null}
      loading={<PageHeader title={es.pages.trainer.biblioteca} />}
    >
      {(data) => <Library exercises={data} />}
    </QueryBoundary>
  );
}

function Library({ exercises }: { exercises: Exercise[] }) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  /** `undefined` = nada elegido; `null` = ejercicio nuevo. */
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  const clients = useClients();
  const saveExercise = useSaveExercise();
  const archiveExercise = useArchiveExercise();
  const selected =
    typeof selectedId === "string" ? exercises.find((e) => e.id === selectedId) : null;
  const usage = useExerciseUsage(confirming && selected ? selected.id : undefined);

  const groups = distinct(exercises, "muscleGroup");
  const equipment = distinct(exercises, "equipment");
  const needle = search.trim().toLowerCase();
  const visible = exercises.filter((e) => {
    const matchesGroup = group === null || e.muscleGroup === group;
    const haystack = `${e.name} ${e.muscleGroup} ${e.equipment}`.toLowerCase();
    return matchesGroup && (needle === "" || haystack.includes(needle));
  });

  const save = async (values: ExerciseFormValues) => {
    // Grupo y material siguen siendo libres, pero se guardan con la grafía que ya exista: si no,
    // «pierna» y «Pierna» acaban siendo dos filtros, porque los filtros salen de los datos.
    const body = {
      name: values.name,
      muscleGroup: canonicalText(values.muscleGroup, groups),
      equipment: canonicalText(values.equipment, equipment),
      videoUrl: values.videoUrl === "" ? null : values.videoUrl,
      description: values.description,
    };
    const saved = selected
      ? await saveExercise.mutateAsync({ exerciseId: selected.id, changes: body })
      : await saveExercise.mutateAsync({ create: body });
    setSelectedId(saved.id);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={es.pages.trainer.biblioteca}
        actions={<Button onClick={() => setSelectedId(null)}>{t.newExercise}</Button>}
      />
      <p className="text-text-muted -mt-4 text-[13px]">
        {exercises.length} {t.count}
      </p>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className="h-10 max-w-[380px] flex-1"
            />
            <div className="flex flex-wrap gap-2">
              <GroupChip
                label={t.allGroups}
                active={group === null}
                onClick={() => setGroup(null)}
              />
              {groups.map((name) => (
                <GroupChip
                  key={name}
                  label={name}
                  active={group === name}
                  onClick={() => setGroup(name)}
                />
              ))}
            </div>
          </div>

          {exercises.length === 0 ? (
            <EmptyState title={t.empty.title} description={t.empty.hint} />
          ) : visible.length === 0 ? (
            <EmptyState title={t.noMatches.title} description={t.noMatches.hint} />
          ) : (
            <ExerciseGrid exercises={visible} selectedId={selected?.id} onSelect={setSelectedId} />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {selectedId === undefined ? (
            <EmptyState title={t.form.editTitle} description={t.form.pickHint} />
          ) : (
            <ExerciseForm
              key={selected?.id ?? "new"}
              exercise={selected ?? null}
              groups={groups}
              equipment={equipment}
              isSaving={saveExercise.isPending}
              saveError={saveExercise.isError}
              onSubmit={save}
              onDelete={() => setConfirming(true)}
              onCancel={() => setSelectedId(undefined)}
            />
          )}
        </aside>
      </div>

      {confirming && selected ? (
        <ArchiveDialog
          exercise={selected}
          usage={usage.data}
          isLoadingUsage={usage.isPending}
          clients={clients.data ?? []}
          isWorking={archiveExercise.isPending}
          hasError={archiveExercise.isError}
          onConfirm={async () => {
            await archiveExercise.mutateAsync(selected.id);
            setConfirming(false);
            setSelectedId(undefined);
          }}
          onOpenChange={(open) => {
            if (!open) setConfirming(false);
          }}
        />
      ) : null}
    </div>
  );
}

function GroupChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 h-10 rounded-md border px-3.5 text-[13px] transition-colors outline-none focus-visible:ring-[3px]",
        active
          ? "border-border-strong bg-surface-overlay text-text-primary"
          : "border-border-emphasis text-text-muted hover:text-text-primary",
      )}
    >
      {label}
    </button>
  );
}
