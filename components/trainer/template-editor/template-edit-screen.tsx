"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { MenusEditor } from "@/components/editor/menus-editor";
import { RoutineDaysEditor } from "@/components/editor/routine-days-editor";
import { useUnsavedGuard } from "@/components/editor/use-unsaved-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import {
  useExercises,
  useMenuTemplates,
  useRoutineTemplates,
  useSaveMenuTemplate,
  useSaveRoutineTemplate,
} from "@/lib/data/hooks";
import {
  fromMenuDrafts,
  menuTemplateSchema,
  routineTemplateSchema,
  toMenuDrafts,
  type MenuEntryDraft,
  type MenuTemplate,
  type RoutineTemplate,
  type TemplateKind,
} from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensTemplateEditor;

function BackLink() {
  return (
    <Link
      href="/templates"
      className="text-text-muted hover:text-text-primary inline-flex min-h-8 w-fit items-center text-[13px]"
    >
      {t.back}
    </Link>
  );
}

/**
 * Edición de una plantilla. Trabaja sobre un borrador local y solo escribe al pulsar «Guardar».
 * Los planes ya asignados no cambian: eran una copia (§4).
 */
export function TemplateEditScreen({
  kind,
  templateId,
}: {
  kind: TemplateKind;
  templateId: string;
}) {
  const routines = useRoutineTemplates();
  const menus = useMenuTemplates();
  const query = kind === "routine" ? routines : menus;

  if (query.isPending || query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        {query.isPending ? <LoadingState /> : <ErrorState onRetry={() => void query.refetch()} />}
      </div>
    );
  }

  const template = (query.data as { id: string }[]).find((item) => item.id === templateId);
  if (!template) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <EmptyState title={t.notFound.title} description={t.notFound.hint} />
      </div>
    );
  }

  return kind === "routine" ? (
    <RoutineEditor key={template.id} template={template as RoutineTemplate} />
  ) : (
    <MenuEditor key={template.id} template={template as MenuTemplate} />
  );
}

function DetailsCard({
  name,
  description,
  onName,
  onDescription,
  nameInvalid,
  children,
}: {
  name: string;
  description: string;
  onName: (value: string) => void;
  onDescription: (value: string) => void;
  nameInvalid: boolean;
  children?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-name">{t.name}</Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(event) => onName(event.target.value)}
            aria-invalid={nameInvalid ? true : undefined}
          />
          {nameInvalid ? (
            <p role="alert" className="text-danger text-[13px]">
              {t.nameRequired}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-description">{t.description}</Label>
          <Input
            id="edit-description"
            value={description}
            placeholder={t.descriptionPlaceholder}
            onChange={(event) => onDescription(event.target.value)}
          />
        </div>
      </div>
      {children}
    </Card>
  );
}

function SaveBar({
  dirty,
  isSaving,
  hasError,
  invalid,
  justSaved,
  onSave,
}: {
  dirty: boolean;
  isSaving: boolean;
  hasError: boolean;
  invalid: boolean;
  justSaved: boolean;
  onSave: () => void;
}) {
  return (
    <div className="border-border-subtle bg-background/95 sticky bottom-0 z-10 -mx-1 flex flex-col gap-3 border-t px-1 py-4 backdrop-blur">
      {invalid ? <ErrorState message={t.invalid} /> : null}
      {hasError ? <ErrorState message={t.saveError} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-text-muted text-[13px]">
          {dirty ? t.unsaved : justSaved ? t.saved : t.copiedNote}
        </p>
        <Button type="button" onClick={onSave} disabled={isSaving || !dirty}>
          {isSaving ? t.saving : t.save}
        </Button>
      </div>
    </div>
  );
}

function RoutineEditor({ template }: { template: RoutineTemplate }) {
  const library = useExercises();
  const save = useSaveRoutineTemplate();
  const [saved, setSaved] = useState(template);
  const [draft, setDraft] = useState(template);
  const [invalid, setInvalid] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  const update = (change: Partial<RoutineTemplate>) => {
    setDraft((d) => ({ ...d, ...change }));
    setInvalid(false);
    setJustSaved(false);
  };

  const onSave = async () => {
    if (!routineTemplateSchema.safeParse(draft).success) {
      setInvalid(true);
      return;
    }
    const result = await save.mutateAsync(draft).catch(() => null);
    if (result) {
      setSaved(result);
      setDraft(result);
      setJustSaved(true);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <PageHeader title={t.editRoutine} />
      <DetailsCard
        name={draft.name}
        description={draft.description}
        onName={(name) => update({ name })}
        onDescription={(description) => update({ description })}
        nameInvalid={invalid && draft.name.trim() === ""}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-note">{t.note}</Label>
          <Textarea
            id="edit-note"
            rows={2}
            value={draft.note}
            onChange={(event) => update({ note: event.target.value })}
          />
        </div>
      </DetailsCard>

      {library.isPending ? (
        <LoadingState />
      ) : library.isError ? (
        <ErrorState onRetry={() => void library.refetch()} />
      ) : (
        <RoutineDaysEditor
          days={draft.days}
          library={library.data}
          onChange={(days) => update({ days })}
        />
      )}

      <SaveBar
        dirty={dirty}
        isSaving={save.isPending}
        hasError={save.isError}
        invalid={invalid}
        justSaved={justSaved}
        onSave={() => void onSave()}
      />
    </div>
  );
}

/** La plantilla mientras se edita: sus menús pueden tener kcal o macros sin rellenar. */
type MenuTemplateDraft = Omit<MenuTemplate, "menus"> & { menus: MenuEntryDraft[] };

const toTemplateDraft = (template: MenuTemplate): MenuTemplateDraft => ({
  ...template,
  menus: toMenuDrafts(template.menus),
});

function MenuEditor({ template }: { template: MenuTemplate }) {
  const save = useSaveMenuTemplate();
  const [saved, setSaved] = useState(() => toTemplateDraft(template));
  const [draft, setDraft] = useState(() => toTemplateDraft(template));
  const [invalid, setInvalid] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);

  const update = (change: Partial<MenuTemplateDraft>) => {
    setDraft((d) => ({ ...d, ...change }));
    setInvalid(false);
    setJustSaved(false);
  };

  const onSave = async () => {
    // Un menú sin sus cuatro cifras no se guarda (§5): `fromMenuDrafts` devuelve null.
    const menus = fromMenuDrafts(draft.menus);
    const complete = menus ? { ...draft, menus } : null;
    if (!complete || !menuTemplateSchema.safeParse(complete).success) {
      setInvalid(true);
      return;
    }
    const result = await save.mutateAsync(complete).catch(() => null);
    if (result) {
      setSaved(toTemplateDraft(result));
      setDraft(toTemplateDraft(result));
      setJustSaved(true);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <PageHeader title={t.editMenu} />
      <DetailsCard
        name={draft.name}
        description={draft.description}
        onName={(name) => update({ name })}
        onDescription={(description) => update({ description })}
        nameInvalid={invalid && draft.name.trim() === ""}
      />
      <MenusEditor menus={draft.menus} onChange={(menus) => update({ menus })} />
      <SaveBar
        dirty={dirty}
        isSaving={save.isPending}
        hasError={save.isError}
        invalid={invalid}
        justSaved={justSaved}
        onSave={() => void onSave()}
      />
    </div>
  );
}
