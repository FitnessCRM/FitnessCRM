"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, QueryBoundary } from "@/components/ui/query-boundary";
import { useClient, useLogout, useSessionClientId, useTrainer } from "@/lib/data/hooks";
import { DomainError, weekNumber, type Client, type Trainer } from "@/lib/domain";
import { formatCivilDate, todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensClientProfile;

/**
 * Perfil del cliente. Solo lectura: los datos los edita el entrenador y no hay contraseña que
 * cambiar, porque el acceso es con correo y contraseña y no hay pantalla para cambiarla. Lo único que se hace aquí es cerrar la sesión.
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
