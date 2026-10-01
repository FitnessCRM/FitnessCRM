"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  useActiveMenus,
  useActiveRoutine,
  useAssignTemplate,
  useClients,
  useMacroTargets,
  useMenuTemplates,
  useRoutineTemplates,
} from "@/lib/data/hooks";
import type { MenuTemplateSummary, RoutineTemplateSummary } from "@/lib/data/ports";
import { countTemplateExercises } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { MacrosCard } from "./macros-card";
import { TemplatePicker, type PickerOption } from "./template-picker";

const t = es.screensAssignment;

function plural(n: number, forms: { one: string; other: string }) {
  return `${n} ${n === 1 ? forms.one : forms.other}`;
}

function routineDetails(template: RoutineTemplateSummary): string {
  return [
    plural(template.days.length, t.routine.days),
    template.description,
    plural(countTemplateExercises(template), t.routine.exercises),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Comidas del menú más largo y menús por tipo de día, como en la demo. */
function menuDetails(template: MenuTemplateSummary): string {
  const meals = Math.max(0, ...template.menus.map((m) => m.meals.length));
  const perDayType = new Map<string, number>();
  for (const menu of template.menus) {
    perDayType.set(menu.dayType, (perDayType.get(menu.dayType) ?? 0) + 1);
  }
  const menusPerType = Math.max(0, ...perDayType.values());
  return [
    template.description,
    plural(meals, t.menu.meals),
    plural(menusPerType, t.menu.perDayType),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Pantalla 18 · Asignación de plan. Entreno y menú, desde plantilla o desde cero, más una tarjeta
 * de macros independiente (macros y menú se asignan por separado). Asignar clona la plantilla al
 * cliente como borrador (§4) y sigue en el editor, que es donde se ajusta y se publica.
 */
export function AssignmentScreen({ clientId: requestedId }: { clientId: string | undefined }) {
  const router = useRouter();
  const clients = useClients();

  // Cabecera propia: a 390 px el selector no cabe junto al título y baja a su propia fila.
  const header = (clientControl?: React.ReactNode) => (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        <p className="eyebrow text-accent">{t.eyebrow}</p>
        <h1 className="page-title mt-0.5">{es.pages.trainer.asignacion}</h1>
      </div>
      {clientControl}
    </header>
  );

  if (clients.isPending) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <LoadingState />
      </div>
    );
  }
  if (clients.isError) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <ErrorState onRetry={() => void clients.refetch()} />
      </div>
    );
  }

  // Un cliente de baja no recibe planes nuevos.
  const assignable = clients.data.filter((c) => c.status !== "dado_de_baja");
  if (assignable.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        {header()}
        <EmptyState title={t.noClients.title} description={t.noClients.hint} />
      </div>
    );
  }

  const client = assignable.find((c) => c.id === requestedId) ?? assignable[0]!;
  const selector = (
    <label className="flex items-center gap-3">
      <span className="eyebrow text-text-muted max-sm:sr-only">{t.client}</span>
      <NativeSelect
        value={client.id}
        onChange={(event) => router.replace(`/assignment?clientId=${event.target.value}`)}
        className="border-border-emphasis bg-surface h-11 max-w-[60vw] truncate text-[15px] sm:max-w-[260px]"
      >
        {assignable.map((c) => (
          <option key={c.id} value={c.id}>
            {c.firstName} {c.lastName}
          </option>
        ))}
      </NativeSelect>
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      {header(selector)}
      <ClientAssignment key={client.id} clientId={client.id} />
    </div>
  );
}

/** Lo que cambia con el cliente elegido. Se remonta al cambiarlo, así ninguna selección sobrevive. */
function ClientAssignment({ clientId }: { clientId: string }) {
  const router = useRouter();
  const routine = useActiveRoutine(clientId);
  const menus = useActiveMenus(clientId);
  const targets = useMacroTargets(clientId);
  const routineTemplates = useRoutineTemplates();
  const menuTemplates = useMenuTemplates();
  const assign = useAssignTemplate(clientId);

  const queries = [routine, menus, targets, routineTemplates, menuTemplates];
  if (queries.some((q) => q.isPending)) return <LoadingState />;
  if (queries.some((q) => q.isError)) {
    return <ErrorState onRetry={() => queries.forEach((q) => void q.refetch())} />;
  }

  const editorHref = `/clients/${clientId}/editor`;
  const assignTemplate = (kind: "routine" | "menu") => (templateId: string) =>
    assign.mutate({ kind, templateId }, { onSuccess: () => router.push(editorHref) });
  const error = (kind: "routine" | "menu") =>
    assign.isError && assign.variables?.kind === kind ? t.assignError : null;
  const isAssigning = (kind: "routine" | "menu") =>
    assign.isPending && assign.variables?.kind === kind;

  const routineOptions: PickerOption[] = (routineTemplates.data ?? []).map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    details: routineDetails(tpl),
  }));
  const menuOptions: PickerOption[] = (menuTemplates.data ?? []).map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    details: menuDetails(tpl),
  }));
  const activeMenus = menus.data?.length ?? 0;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <TemplatePicker
        options={routineOptions}
        editorHref={editorHref}
        isAssigning={isAssigning("routine")}
        error={error("routine")}
        onAssign={assignTemplate("routine")}
        labels={{
          title: t.routine.title,
          status: routine.data
            ? t.routine.active.replace("{name}", routine.data.name)
            : t.routine.none,
          fromTemplate: t.fromTemplate,
          fromScratch: t.fromScratch,
          selected: t.selected,
          scratchLink: t.routine.scratch,
          scratchHint: t.routine.scratchHint,
          scratchButton: t.routine.create,
          assign: t.assignAndAdjust,
          assigning: t.assigning,
          empty: t.noTemplates,
          note: t.copiedNote,
        }}
      />
      <div className="flex flex-col gap-6">
        <MacrosCard clientId={clientId} targets={targets.data ?? []} />
        <TemplatePicker
          options={menuOptions}
          editorHref={editorHref}
          isAssigning={isAssigning("menu")}
          error={error("menu")}
          onAssign={assignTemplate("menu")}
          labels={{
            title: t.menu.title,
            status:
              activeMenus === 0
                ? t.menu.none
                : t.menu.active[activeMenus === 1 ? "one" : "other"].replace(
                    "{n}",
                    String(activeMenus),
                  ),
            fromTemplate: t.fromTemplate,
            fromScratch: t.fromScratch,
            selected: t.selectedMenu,
            scratchLink: t.menu.scratch,
            scratchHint: t.menu.scratchHint,
            scratchButton: t.menu.create,
            assign: t.assignAndAdjust,
            assigning: t.assigning,
            empty: t.noTemplates,
            note: t.menu.hint,
          }}
        />
      </div>
    </div>
  );
}
