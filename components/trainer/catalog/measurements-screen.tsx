"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { canonicalText, type MeasurementType } from "@/lib/domain";
import {
  useMeasurementTypes,
  useMeasurementTypesWithMeasurements,
  useSaveMeasurementType,
} from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { CatalogList } from "./catalog-list";

const t = es.screensMeasurements;

interface Draft {
  label: string;
  unit: string;
}

const draftOf = (type: MeasurementType): Draft => ({ label: type.label, unit: type.unit });
const sameDraft = (a: Draft, b: Draft) => a.label === b.label && a.unit === b.unit;

/**
 * Pantalla sin maqueta (`docs/dominio.md` §11.1): el catálogo de tipos de medida del entrenador,
 * con la misma mecánica que Cuestionario. Cada medida registrada guarda etiqueta y unidad
 * congeladas (I12), así que editar aquí no toca el histórico. Desde la primera medida registrada
 * la unidad ya no se cambia (I26), igual que el formato de una pregunta con respuestas (I15).
 */
export function MeasurementsScreen() {
  const types = useMeasurementTypes();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={es.pages.trainer.medidas} />
      <QueryBoundary query={types} isEmpty={() => false} empty={null}>
        {(data) => <Measurements types={data} />}
      </QueryBoundary>
    </div>
  );
}

function Measurements({ types }: { types: MeasurementType[] }) {
  const save = useSaveMeasurementType();
  const active = types.filter((m) => m.status === "activa");
  const archived = types.filter((m) => m.status === "archivada");
  const locked = useMeasurementTypesWithMeasurements(active.map((m) => m.id));
  const units = [...new Set(types.map((m) => m.unit).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [added, setAdded] = useState<{ tempId: string; draft: Draft }[]>([]);

  const isDirty =
    added.length > 0 ||
    active.some((m) => {
      const draft = drafts[m.id];
      return draft !== undefined && !sameDraft(draft, draftOf(m));
    });

  const edit = (id: string, changes: Partial<Draft>) =>
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? draftOf(active.find((m) => m.id === id)!)), ...changes },
    }));

  // La unidad se guarda con la grafía que ya exista: «CM» y «cm» no son dos unidades.
  const clean = (draft: Draft) => ({
    label: draft.label.trim(),
    unit: canonicalText(draft.unit, units),
  });

  const onSave = async () => {
    for (const type of active) {
      const draft = drafts[type.id];
      if (!draft || sameDraft(draft, draftOf(type))) continue;
      const next = clean(draft);
      if (next.label === "" || next.unit === "") continue;
      // I26: la unidad solo viaja si este tipo todavía puede cambiarla.
      const changes = locked.data?.has(type.id) ? { label: next.label } : next;
      await save.mutateAsync({ typeId: type.id, changes });
    }
    for (const row of added) {
      const next = clean(row.draft);
      if (next.label === "" || next.unit === "") continue;
      await save.mutateAsync({ create: next });
    }
    setDrafts({});
    setAdded([]);
  };

  const move = async (id: string, direction: -1 | 1) => {
    const ids = active.map((m) => m.id);
    const from = ids.indexOf(id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    await save.mutateAsync({ reorder: ids });
  };

  return (
    <CatalogList
      hint={t.hint}
      active={active}
      archived={archived}
      addLabel={t.add}
      emptyTitle={t.empty.title}
      emptyHint={t.empty.hint}
      isSaving={save.isPending}
      hasError={save.isError}
      isDirty={isDirty}
      pending={added.map((row, index) => (
        <div key={row.tempId} className="border-accent-outline rounded-lg border px-4 py-3">
          <MeasurementRow
            draft={row.draft}
            units={units}
            onChange={(changes) =>
              setAdded((prev) =>
                prev.map((r, i) => (i === index ? { ...r, draft: { ...r.draft, ...changes } } : r)),
              )
            }
          />
        </div>
      ))}
      labelOf={(m) => m.label}
      onMove={move}
      onArchive={(id) => void save.mutateAsync({ archive: id })}
      onUnarchive={(id) => void save.mutateAsync({ unarchive: id })}
      onAdd={() =>
        setAdded((prev) => [
          ...prev,
          { tempId: `nueva-${prev.length + 1}`, draft: { label: "", unit: "" } },
        ])
      }
      onSave={() => void onSave()}
      renderRow={(type) => (
        <MeasurementRow
          draft={drafts[type.id] ?? draftOf(type)}
          units={units}
          // Mientras no se sabe, bloqueada: mejor que dejar escribir algo que luego se rechaza.
          unitLocked={locked.data?.has(type.id) ?? locked.isPending}
          onChange={(changes) => edit(type.id, changes)}
        />
      )}
      renderArchivedRow={(type) => (
        <span>
          {type.label}
          <span className="text-text-subtle ml-2 text-xs">{type.unit}</span>
        </span>
      )}
    />
  );
}

function MeasurementRow({
  draft,
  units,
  unitLocked = false,
  onChange,
}: {
  draft: Draft;
  units: string[];
  unitLocked?: boolean;
  onChange: (changes: Partial<Draft>) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label={t.label}
          placeholder={t.labelPlaceholder}
          value={draft.label}
          onChange={(event) => onChange({ label: event.target.value })}
          aria-invalid={draft.label.trim() === "" || undefined}
          className="h-10 min-w-[200px] flex-1 text-[14px]"
        />
        <Input
          aria-label={t.unit}
          list="measurement-units"
          placeholder={t.unitPlaceholder}
          value={draft.unit}
          disabled={unitLocked}
          onChange={(event) => onChange({ unit: event.target.value })}
          aria-invalid={draft.unit.trim() === "" || undefined}
          className="h-10 w-24 text-[14px]"
        />
        <datalist id="measurement-units">
          {units.map((unit) => (
            <option key={unit} value={unit} />
          ))}
        </datalist>
      </div>
      {unitLocked ? <p className="text-text-subtle text-xs">{t.unitLocked}</p> : null}
      {draft.label.trim() === "" ? <p className="text-danger text-xs">{t.labelRequired}</p> : null}
      {draft.unit.trim() === "" ? <p className="text-danger text-xs">{t.unitRequired}</p> : null}
    </div>
  );
}
