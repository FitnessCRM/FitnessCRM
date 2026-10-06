"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientPicker } from "@/components/trainer/client-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  useActiveMenus,
  useArchivedMenus,
  useClientRoutines,
  useClients,
  useSaveMenuTemplate,
  useSaveRoutineTemplate,
} from "@/lib/data/hooks";
import {
  menusToTemplateContent,
  routineToTemplateContent,
  type Menu,
  type Routine,
} from "@/lib/domain";
import { formatInteger } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.screensTemplates.fromPlan;
const tList = es.screensTemplates;

type Kind = "routine" | "menu";

const optionClass = (selected: boolean) =>
  cn(
    "focus-visible:ring-ring/50 flex min-h-14 w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-[3px]",
    selected
      ? "border-accent/50 bg-surface-raised"
      : "bg-surface-raised/60 hover:bg-surface-raised border-transparent",
  );

const chipClass = (selected: boolean) =>
  cn(
    "focus-visible:ring-ring/50 h-10 rounded-md border px-4 text-[13px] transition-colors outline-none focus-visible:ring-[3px]",
    selected
      ? "border-border-strong bg-surface-overlay text-text-primary"
      : "border-border-emphasis text-text-muted hover:text-text-primary",
  );

function plural(n: number, forms: { one: string; other: string }) {
  return `${n} ${n === 1 ? forms.one : forms.other}`;
}

/**
 * Crea una plantilla a partir del plan de un cliente: se elige el cliente, qué copiar (su rutina o
 * sus menús, activos y archivados) y el nombre, y se va al editor de la plantilla nueva, como en
 * el alta. Es una copia con ids nuevos, sin vínculo con el plan de origen (§4).
 */
export function FromPlanDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const clients = useClients();
  const saveRoutine = useSaveRoutineTemplate();
  const saveMenu = useSaveMenuTemplate();

  const [clientId, setClientId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("routine");
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [menuIds, setMenuIds] = useState<readonly string[]>([]);
  // `null` = el nombre aún no lo ha escrito la persona: se propone uno según lo elegido.
  const [typedName, setTypedName] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const routines = useClientRoutines(clientId ?? undefined);
  const activeMenus = useActiveMenus(clientId ?? undefined);
  const archivedMenus = useArchivedMenus(clientId ?? undefined);

  const client = clients.data?.find((c) => c.id === clientId);
  const routineOptions: Routine[] = (routines.data ?? []).filter((r) => r.status !== "borrador");
  const activeList: Menu[] = activeMenus.data ?? [];
  const archivedList: Menu[] = archivedMenus.data ?? [];
  const selectedRoutine = routineOptions.find((r) => r.id === routineId) ?? null;
  const selectedMenus = [...activeList, ...archivedList].filter((m) => menuIds.includes(m.id));

  const plansPending =
    clientId !== null &&
    (kind === "routine" ? routines.isPending : activeMenus.isPending || archivedMenus.isPending);
  const plansError =
    clientId !== null &&
    (kind === "routine" ? routines.isError : activeMenus.isError || archivedMenus.isError);

  const suggestedName =
    kind === "routine"
      ? selectedRoutine
        ? t.routineName.replace("{name}", selectedRoutine.name)
        : ""
      : client && selectedMenus.length > 0
        ? t.menusName.replace("{name}", client.firstName)
        : "";
  const name = typedName ?? suggestedName;
  const hasSelection = kind === "routine" ? selectedRoutine !== null : selectedMenus.length > 0;
  const isSaving = saveRoutine.isPending || saveMenu.isPending;
  const canCreate = hasSelection && name.trim() !== "" && !isSaving;

  const reset = () => {
    setRoutineId(null);
    setMenuIds([]);
    setTypedName(null);
    setFailed(false);
  };

  const create = async () => {
    setFailed(false);
    const ctx = { newId: () => crypto.randomUUID(), name: name.trim() };
    try {
      if (kind === "routine" && selectedRoutine) {
        const saved = await saveRoutine.mutateAsync(routineToTemplateContent(selectedRoutine, ctx));
        router.push(`/templates/routine/${saved.id}`);
      } else if (kind === "menu" && selectedMenus.length > 0) {
        const saved = await saveMenu.mutateAsync(menusToTemplateContent(selectedMenus, ctx));
        router.push(`/templates/menu/${saved.id}`);
      }
    } catch {
      setFailed(true);
    }
  };

  const toggleMenu = (id: string) =>
    setMenuIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const menuOption = (menu: Menu) => {
    const selected = menuIds.includes(menu.id);
    return (
      <li key={menu.id}>
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          onClick={() => toggleMenu(menu.id)}
          className={optionClass(selected)}
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">{menu.name}</span>
            <span className="text-text-muted block text-xs">
              {es.editor.menu.dayTypes[menu.dayType]} · {formatInteger(menu.macros.kcal)}{" "}
              {es.common.kcal}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.intro}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>{t.client}</Label>
            <ClientPicker
              className="w-full"
              clients={clients.data ?? []}
              value={clientId}
              onChange={(value) => {
                setClientId(value);
                reset();
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>{t.what}</Label>
            <div role="radiogroup" aria-label={t.what} className="flex gap-2">
              {(
                [
                  { id: "routine", label: t.kindRoutine },
                  { id: "menu", label: t.kindMenus },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={kind === id}
                  onClick={() => {
                    setKind(id);
                    reset();
                  }}
                  className={chipClass(kind === id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {clientId === null ? (
            <p className="text-text-subtle text-sm">{t.pickClient}</p>
          ) : plansPending ? (
            <LoadingState />
          ) : plansError ? (
            <ErrorState message={t.loadError} />
          ) : kind === "routine" ? (
            <div className="flex flex-col gap-2">
              <Label>{t.routineLabel}</Label>
              {routineOptions.length === 0 ? (
                <p className="text-text-subtle text-sm">{t.noRoutines}</p>
              ) : (
                <ul className="flex flex-col gap-2.5" role="radiogroup" aria-label={t.routineLabel}>
                  {routineOptions.map((routine) => {
                    const selected = routine.id === routineId;
                    return (
                      <li key={routine.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => {
                            setRoutineId(routine.id);
                            setFailed(false);
                          }}
                          className={optionClass(selected)}
                        >
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold">{routine.name}</span>
                            <span className="text-text-muted block text-xs">
                              {[
                                routine.status === "activo" ? t.routineActive : t.routineArchived,
                                plural(routine.days.length, tList.days),
                                plural(
                                  routine.days.reduce(
                                    (total, day) => total + day.exercises.length,
                                    0,
                                  ),
                                  tList.exercises,
                                ),
                              ].join(" · ")}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <Label>{t.menusLabel}</Label>
                <p className="text-text-muted text-[13px]">{t.menusHint}</p>
              </div>
              {activeList.length + archivedList.length === 0 ? (
                <p className="text-text-subtle text-sm">{t.noMenus}</p>
              ) : (
                <>
                  {activeList.length > 0 ? (
                    <section aria-label={t.groupActive} className="flex flex-col gap-2">
                      <h3 className="tracking-label text-text-subtle text-[11px] uppercase">
                        {t.groupActive}
                      </h3>
                      <ul className="flex flex-col gap-2.5">{activeList.map(menuOption)}</ul>
                    </section>
                  ) : null}
                  {archivedList.length > 0 ? (
                    <section aria-label={t.groupArchived} className="flex flex-col gap-2">
                      <h3 className="tracking-label text-text-subtle text-[11px] uppercase">
                        {t.groupArchived}
                      </h3>
                      <ul className="flex flex-col gap-2.5">{archivedList.map(menuOption)}</ul>
                    </section>
                  ) : null}
                </>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="from-plan-name">{t.name}</Label>
            <Input
              id="from-plan-name"
              value={name}
              onChange={(event) => setTypedName(event.target.value)}
              aria-invalid={hasSelection && name.trim() === "" ? true : undefined}
            />
            {hasSelection && name.trim() === "" ? (
              <p role="alert" className="text-danger text-[13px]">
                {t.nameRequired}
              </p>
            ) : null}
          </div>

          {failed ? <ErrorState message={t.error} /> : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t.cancel}
          </Button>
          <Button onClick={() => void create()} disabled={!canCreate}>
            {isSaving ? t.creating : t.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
