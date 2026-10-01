"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MenusEditor } from "@/components/editor/menus-editor";
import { RoutineDaysEditor } from "@/components/editor/routine-days-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MacrosCard } from "@/components/trainer/assignment/macros-card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  useAssignTemplate,
  useClient,
  useClientRoutines,
  useEditableMenus,
  useExercises,
  useMacroTargets,
  useMenuTemplates,
  usePublishMenus,
  usePublishRoutine,
  useRoutineTemplates,
} from "@/lib/data/hooks";
import {
  fromMenuDrafts,
  menuTemplateEntrySchema,
  routineBodySchema,
  toMenuDrafts,
  type Client,
  type Exercise,
  type MacroTargets,
  type Menu,
  type MenuEntryDraft,
  type MenuTemplateEntry,
  type Routine,
  type RoutineBody,
} from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.screensPlanEditor;

type Tab = "routine" | "menu";

function toEntry(menu: Menu): MenuTemplateEntry {
  return {
    id: menu.id,
    name: menu.name,
    dayType: menu.dayType,
    suggested: menu.suggested,
    macros: menu.macros,
    meals: menu.meals,
    note: menu.note,
  };
}

/**
 * Pantalla 12 · Editor de plan. Rutina y menú del cliente, con los mismos editores que las
 * plantillas. Se edita sobre un borrador local y «Publicar cambios» guarda y activa lo que toque
 * (I4: lo activo anterior pasa a archivado). Las macros del cliente van sobre el editor de menú.
 */
export function PlanEditorScreen({ clientId }: { clientId: string }) {
  const client = useClient(clientId);
  const routines = useClientRoutines(clientId);
  const menus = useEditableMenus(clientId);
  const library = useExercises();
  const targets = useMacroTargets(clientId);
  const [tab, setTab] = useState<Tab>("routine");
  const [published, setPublished] = useState(false);

  const queries = [client, routines, menus, library, targets];
  const back = (
    <Link
      href={`/clients/${clientId}`}
      className="text-text-muted hover:text-text-primary w-fit text-[13px]"
    >
      {t.back}
    </Link>
  );
  if (queries.some((q) => q.isPending)) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <LoadingState />
      </div>
    );
  }
  if (queries.some((q) => q.isError)) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <ErrorState onRetry={() => queries.forEach((q) => void q.refetch())} />
      </div>
    );
  }
  if (!client.data) {
    return (
      <div className="flex flex-col gap-6">
        {back}
        <EmptyState title={t.notFound.title} description={t.notFound.hint} />
      </div>
    );
  }

  // Se trabaja sobre el borrador más reciente; si no hay, sobre la activa; si no, se parte de cero.
  const target =
    routines.data?.find((r) => r.status === "borrador") ??
    routines.data?.find((r) => r.status === "activo") ??
    null;
  // Remonta al cambiar los datos guardados: el borrador local vuelve a partir de lo guardado.
  const version = [
    target?.id,
    target?.updatedAt,
    ...(menus.data ?? []).map((m) => `${m.id}${m.updatedAt}`),
  ].join("|");

  return (
    <PlanEditor
      key={version}
      client={client.data}
      clientId={clientId}
      target={target}
      menus={menus.data ?? []}
      library={library.data ?? []}
      targets={targets.data ?? []}
      tab={tab}
      onTab={setTab}
      published={published}
      onPublished={setPublished}
      back={back}
    />
  );
}

function PlanEditor({
  client,
  clientId,
  target,
  menus,
  library,
  targets,
  tab,
  onTab,
  published,
  onPublished,
  back,
}: {
  client: Client;
  clientId: string;
  target: Routine | null;
  menus: Menu[];
  library: Exercise[];
  targets: MacroTargets[];
  tab: Tab;
  onTab: (tab: Tab) => void;
  published: boolean;
  onPublished: (published: boolean) => void;
  back: React.ReactNode;
}) {
  const initialRoutine: RoutineBody = target
    ? { name: target.name, note: target.note, days: target.days }
    : { name: t.defaultRoutineName.replace("{name}", client.firstName), note: "", days: [] };
  const initialMenus = toMenuDrafts(menus.map(toEntry));
  const [routine, setRoutine] = useState(initialRoutine);
  const [menuDraft, setMenuDraft] = useState(initialMenus);
  const [invalid, setInvalid] = useState(false);

  const publishRoutine = usePublishRoutine(clientId);
  const publishMenus = usePublishMenus(clientId);
  const routineTemplates = useRoutineTemplates();
  const menuTemplates = useMenuTemplates();
  const assign = useAssignTemplate(clientId);

  const routineDirty = JSON.stringify(routine) !== JSON.stringify(initialRoutine);
  const menusDirty = JSON.stringify(menuDraft) !== JSON.stringify(initialMenus);
  const routinePending = routineDirty || target?.status === "borrador";
  const menusPending = menusDirty || menus.some((m) => m.status === "borrador");
  const dirty = routineDirty || menusDirty;
  const isPublishing = publishRoutine.isPending || publishMenus.isPending;

  const editRoutine = (next: RoutineBody) => {
    setRoutine(next);
    setInvalid(false);
    onPublished(false);
  };
  const editMenus = (next: MenuEntryDraft[]) => {
    setMenuDraft(next);
    setInvalid(false);
    onPublished(false);
  };

  const onPublish = async () => {
    // Un menú sin sus cuatro cifras no se publica (§5): `fromMenuDrafts` devuelve null.
    const menuEntries = fromMenuDrafts(menuDraft);
    const valid =
      (!routinePending || routineBodySchema.safeParse(routine).success) &&
      (!menusPending ||
        (menuEntries !== null && menuTemplateEntrySchema.array().safeParse(menuEntries).success));
    if (!valid) {
      setInvalid(true);
      return;
    }
    try {
      if (routinePending) await publishRoutine.mutateAsync({ target, body: routine });
      if (menusPending && menuEntries)
        await publishMenus.mutateAsync({ current: menus, next: menuEntries });
      onPublished(true);
    } catch {
      // El error se pinta desde el estado de las mutaciones.
    }
  };

  const fromTemplate = async (kind: Tab, templateId: string) => {
    if (dirty && !window.confirm(t.confirmTemplate)) return;
    await assign.mutateAsync({ kind, templateId }).catch(() => null);
  };
  const templates =
    tab === "routine"
      ? (routineTemplates.data ?? []).map((tpl) => ({ id: tpl.id, name: tpl.name }))
      : (menuTemplates.data ?? []).map((tpl) => ({ id: tpl.id, name: tpl.name }));

  const hasMenuDrafts = menus.some((m) => m.status === "borrador");

  return (
    <div className="flex flex-col gap-6">
      {back}
      <PageHeader
        eyebrow={t.breadcrumb.replace("{name}", `${client.firstName} ${client.lastName}`)}
        title={es.pages.trainer.editor}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={assign.isPending}>
                  {t.fromTemplate}
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {templates.length === 0 ? (
                  <p className="text-text-subtle px-3 py-2 text-sm">{t.noTemplates}</p>
                ) : (
                  templates.map((tpl) => (
                    <DropdownMenuItem key={tpl.id} onSelect={() => void fromTemplate(tab, tpl.id)}>
                      {tpl.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => void onPublish()}
              disabled={isPublishing || (!routinePending && !menusPending)}
            >
              {isPublishing ? t.publishing : t.publish}
            </Button>
          </>
        }
      />

      {assign.isError ? <ErrorState message={t.templateError} /> : null}
      {invalid ? <ErrorState message={t.invalid} /> : null}
      {publishRoutine.isError || publishMenus.isError ? <ErrorState message={t.saveError} /> : null}
      <p role="status" className="text-text-muted -mt-2 min-h-5 text-[13px]">
        {dirty ? t.unsaved : published ? t.published : ""}
      </p>

      <Tabs value={tab} onValueChange={(value) => onTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="routine">
            {t.tabs.routine}
            {target?.status === "borrador" ? <DraftDot /> : null}
          </TabsTrigger>
          <TabsTrigger value="menu">
            {t.tabs.menu}
            {hasMenuDrafts ? <DraftDot /> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routine" className="flex flex-col gap-4">
          <Card className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-routine-name">{t.routineName}</Label>
              <Input
                id="plan-routine-name"
                value={routine.name}
                aria-invalid={invalid && routine.name.trim() === "" ? true : undefined}
                onChange={(event) => editRoutine({ ...routine, name: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="plan-routine-note">{t.routineNote}</Label>
              <Textarea
                id="plan-routine-note"
                rows={2}
                value={routine.note}
                onChange={(event) => editRoutine({ ...routine, note: event.target.value })}
              />
            </div>
          </Card>
          <RoutineDaysEditor
            days={routine.days}
            library={library}
            onChange={(days) => editRoutine({ ...routine, days })}
          />
        </TabsContent>

        <TabsContent value="menu" className="flex flex-col gap-4">
          <MacrosCard clientId={clientId} targets={targets} />
          <MenusEditor menus={menuDraft} onChange={editMenus} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DraftDot() {
  return <span className="bg-accent size-1.5 rounded-full" role="img" aria-label={t.draftBadge} />;
}
