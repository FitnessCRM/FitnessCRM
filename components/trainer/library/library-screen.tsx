"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useMediaQuery, XL_MEDIA_QUERY } from "@/components/ui/use-media-query";
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
import { FoodsLibrary } from "./foods-library";
import { LIBRARY_TABS, LibraryHeader, LibraryPanel, type LibraryTab } from "./library-header";

const t = es.screensLibrary;

/** Distinct values of a free-text field, to suggest them in the form and to filter by them. */
function distinct(exercises: Exercise[], field: "muscleGroup" | "equipment"): string[] {
  return [...new Set(exercises.map((e) => e[field]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

const isLibraryTab = (value: string | null): value is LibraryTab =>
  LIBRARY_TABS.includes(value as LibraryTab);

/**
 * Screen 11 · Library, with two tabs: Exercises and Foods. The active tab lives in the URL
 * (`?tab=foods`) so it can be linked and reloaded; without the parameter, Exercises.
 */
export function LibraryScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const requested = useSearchParams().get("tab");
  const tab: LibraryTab = isLibraryTab(requested) ? requested : "exercises";

  return (
    <Tabs
      value={tab}
      onValueChange={(next) =>
        router.replace(next === "exercises" ? pathname : `${pathname}?tab=${next}`, {
          scroll: false,
        })
      }
      className="gap-6"
    >
      {tab === "foods" ? <FoodsLibrary /> : <ExercisesLibrary />}
    </Tabs>
  );
}

/**
 * Exercises tab. Filterable grid on the left and the edit panel on the right.
 * "Delete" archives and warns first about who it affects (I13, §7); the video is an external link (I20).
 */
function ExercisesLibrary() {
  const exercises = useExercises();

  return (
    <QueryBoundary query={exercises} isEmpty={() => false} empty={null} loading={<LibraryHeader />}>
      {(data) => <Library exercises={data} />}
    </QueryBoundary>
  );
}

function Library({ exercises }: { exercises: Exercise[] }) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  /** `undefined` = nothing picked; `null` = new exercise. */
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);

  const clients = useClients();
  const saveExercise = useSaveExercise();
  const archiveExercise = useArchiveExercise();
  const selected =
    typeof selectedId === "string" ? exercises.find((e) => e.id === selectedId) : null;
  const usage = useExerciseUsage(confirming && selected ? selected.id : undefined);
  const wide = useMediaQuery(XL_MEDIA_QUERY);

  const groups = distinct(exercises, "muscleGroup");
  const equipment = distinct(exercises, "equipment");
  const needle = search.trim().toLowerCase();
  const visible = exercises.filter((e) => {
    const matchesGroup = group === null || e.muscleGroup === group;
    const haystack = `${e.name} ${e.muscleGroup} ${e.equipment}`.toLowerCase();
    return matchesGroup && (needle === "" || haystack.includes(needle));
  });

  const save = async (values: ExerciseFormValues) => {
    // Group and equipment stay free text, but are saved with the spelling that already exists:
    // otherwise "pierna" and "Pierna" end up as two filters, because filters come from the data.
    const body = {
      name: values.name,
      muscleGroup: canonicalText(values.muscleGroup, groups),
      equipment: canonicalText(values.equipment, equipment),
      videoUrl: values.videoUrl,
      description: values.description,
    };
    const saved = selected
      ? await saveExercise.mutateAsync({ exerciseId: selected.id, changes: body })
      : await saveExercise.mutateAsync({ create: body });
    setSelectedId(saved.id);
  };

  // From `xl` the panel sits on the right; below it, in a `Sheet` like Foods, so picking an
  // exercise on a phone does not mean scrolling past the whole grid.
  const panel =
    selectedId === undefined ? null : (
      <ExerciseForm
        key={selected?.id ?? "new"}
        exercise={selected ?? null}
        groups={groups}
        equipment={equipment}
        title={(heading) =>
          wide ? (
            <h2 className="section-title">{heading}</h2>
          ) : (
            <SheetTitle className="section-title">{heading}</SheetTitle>
          )
        }
        isSaving={saveExercise.isPending}
        saveError={saveExercise.isError}
        onSubmit={save}
        onDelete={() => setConfirming(true)}
        onCancel={() => setSelectedId(undefined)}
      />
    );

  return (
    <>
      <LibraryHeader
        action={<Button onClick={() => setSelectedId(null)}>{t.newExercise}</Button>}
        count={`${exercises.length} ${t.count}`}
      />

      <LibraryPanel tab="exercises" className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_380px]">
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

        {wide ? (
          <aside className="flex flex-col gap-4">
            {panel ? (
              <Card className="gap-4 px-[22px] py-[22px]">{panel}</Card>
            ) : (
              <EmptyState title={t.form.editTitle} description={t.form.pickHint} />
            )}
          </aside>
        ) : (
          <Sheet
            open={panel !== null}
            onOpenChange={(open) => (open ? null : setSelectedId(undefined))}
          >
            <SheetContent
              side="right"
              aria-describedby={undefined}
              className="bg-surface w-full max-w-full gap-4 overflow-y-auto px-4 py-5 sm:w-[420px] sm:max-w-[420px] sm:px-6"
            >
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={es.common.close}
                  className="self-end"
                >
                  <XIcon />
                </Button>
              </SheetClose>
              {panel}
            </SheetContent>
          </Sheet>
        )}
      </LibraryPanel>

      {confirming && selected ? (
        <ArchiveDialog
          exercise={selected}
          usage={usage.data}
          isLoadingUsage={usage.isPending && !usage.isError}
          usageError={usage.isError}
          onRetryUsage={() => void usage.refetch()}
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
    </>
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
