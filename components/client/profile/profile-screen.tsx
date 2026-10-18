"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, QueryBoundary } from "@/components/ui/query-boundary";
import {
  useClient,
  useLogout,
  useSessionClientId,
  useSetMacrosVisible,
  useTrainer,
} from "@/lib/data/hooks";
import { DomainError, weekNumber, type Client, type Trainer } from "@/lib/domain";
import { formatCivilDate, todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensClientProfile;

/**
 * Perfil del cliente. Los datos los edita el entrenador y no hay pantalla para cambiar la
 * contraseña. Aquí el cliente solo hace dos cosas: enseñar u ocultar sus kcal y macros (I11, que
 * también puede cambiar el entrenador; gana la última escritura) y cerrar la sesión.
 */
export function ProfileScreen() {
  const client = useClient(useSessionClientId());
  const trainer = useTrainer();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader eyebrow={t.eyebrow} title={es.pages.client.perfil} />
      <QueryBoundary
        query={client}
        empty={<EmptyState title={t.notFound.title} description={t.notFound.hint} />}
      >
        {(c) => <ProfileView client={c} trainer={trainer.data ?? undefined} />}
      </QueryBoundary>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[140px_1fr] sm:gap-4">
      <dt className="tracking-label text-text-muted text-xs uppercase sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 text-[15px] break-words">{children}</dd>
    </div>
  );
}

/**
 * Interruptor de kcal y macros. Lo marcado sale de la ficha en caché, sin copia local: el hook
 * escribe en ella la ficha nueva al guardar. Sin red falla en el acto; si el navegador cree que hay
 * red pero Firestore no llega, la escritura espera a que vuelva y aquí se ve «Guardando…» todo ese
 * rato, sin tiempo de espera: la escritura acabaría aplicándose y el error sería falso.
 */
function MacrosVisibleCard({ client }: { client: Client }) {
  const setMacrosVisible = useSetMacrosVisible();
  const { isPending, isError } = setMacrosVisible;
  return (
    <Card className="gap-4 px-[22px] py-[22px]">
      <h2 className="section-title">{t.macros.title}</h2>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Checkbox
            id="pf-macros-visible"
            checked={client.macrosVisible}
            disabled={isPending}
            onCheckedChange={(checked) =>
              setMacrosVisible.mutate({ clientId: client.id, visible: checked === true })
            }
            aria-describedby="pf-macros-visible-hint"
          />
          {/* La etiqueta hace de área táctil: 32 px de alto, como pide CLAUDE.md. */}
          <Label htmlFor="pf-macros-visible" className="min-h-8">
            {t.macros.label}
          </Label>
        </div>
        <p id="pf-macros-visible-hint" className="text-text-subtle text-xs">
          {t.macros.hint}
        </p>
        <p aria-live="polite" className="text-text-muted text-sm empty:hidden">
          {isPending ? t.macros.saving : null}
        </p>
        {isError ? (
          <p role="alert" className="text-danger text-sm">
            {t.macros.failed}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function ProfileView({ client, trainer }: { client: Client; trainer: Trainer | undefined }) {
  const router = useRouter();
  const logout = useLogout();
  const [failed, setFailed] = useState(false);

  const unspecified = <span className="text-text-subtle">{t.data.unspecified}</span>;
  const today = todayCivil(trainer?.timeZone);
  let week: number | null = null;
  if (trainer) {
    try {
      week = weekNumber(client.startDate, today, trainer.timeZone);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
    }
  }
  const { everyDays } = client.reviewCadence;
  const cadence = (
    everyDays === 1 ? t.tracking.cadenceEvery.one : t.tracking.cadenceEvery.other
  ).replace("{days}", String(everyDays));

  const signOut = async () => {
    setFailed(false);
    try {
      await logout.mutateAsync();
      router.push("/login");
    } catch {
      setFailed(true);
    }
  };

  return (
    <>
      <Card className="gap-4 px-[22px] py-[22px]">
        <h2 className="section-title">{t.data.title}</h2>
        <dl className="flex flex-col gap-3.5">
          <Field label={t.data.name}>
            {client.firstName} {client.lastName}
          </Field>
          <Field label={t.data.email}>{client.email}</Field>
          <Field label={t.data.phone}>{client.phone || unspecified}</Field>
          <Field label={t.data.goal}>{client.goal || unspecified}</Field>
          <Field label={t.data.level}>{client.level || unspecified}</Field>
        </dl>
        <p className="text-text-subtle text-xs">{t.data.changeHint}</p>
      </Card>

      <Card className="gap-4 px-[22px] py-[22px]">
        <h2 className="section-title">{t.tracking.title}</h2>
        <dl className="flex flex-col gap-3.5">
          <Field label={t.tracking.since}>
            <time dateTime={client.startDate}>{formatCivilDate(client.startDate)}</time>
            {week !== null ? ` · ${t.tracking.week} ${week}` : null}
          </Field>
          <Field label={t.tracking.cadence}>{cadence}</Field>
          {trainer ? (
            <Field label={t.tracking.trainer}>
              {trainer.name}
              <span className="text-text-muted block text-sm">{trainer.email}</span>
            </Field>
          ) : null}
        </dl>
      </Card>

      <MacrosVisibleCard client={client} />

      <Card className="gap-4 px-[22px] py-[22px]">
        <h2 className="section-title">{t.session.title}</h2>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={signOut}
            disabled={logout.isPending}
            className="max-sm:w-full sm:self-start"
          >
            {logout.isPending ? t.session.loggingOut : t.session.logout}
          </Button>
          {failed ? (
            <p role="alert" className="text-danger text-sm">
              {t.session.failed}
            </p>
          ) : null}
        </div>
      </Card>
    </>
  );
}
