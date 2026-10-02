"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import {
  useActiveMenus,
  useActiveRoutine,
  useClient,
  useClientMemberships,
  useClientReviews,
  useMacroTargets,
  useMeasurementTypes,
  useTrainer,
  useWeightLogs,
} from "@/lib/data/hooks";
import { changeSinceStart, measurementSeries, weekNumberOrNull, weeklyWeights } from "@/lib/domain";
import { formatCivilDate, todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";
import { ClientStatusAction } from "./client-status-action";
import { MembershipCard } from "./membership-card";
import { MacrosMenuCard, RoutineCard } from "./plan-cards";
import { ReviewsHistory } from "./reviews-history";

const MeasurementsCard = dynamic(
  () => import("@/components/charts/measurements-card").then((m) => m.MeasurementsCard),
  {
    ssr: false,
    loading: () => <div className="border-border-subtle h-80 rounded-lg border p-6" />,
  },
);

const WeightEvolutionCard = dynamic(
  () => import("@/components/charts/weight-evolution-card").then((m) => m.WeightEvolutionCard),
  {
    ssr: false,
    loading: () => <div className="border-border-subtle h-60 rounded-lg border p-6" />,
  },
);

const t = es.screensClientDetail;

/** Pantalla 10 · Detalle de cliente: plan y gráficas a la izquierda, histórico a la derecha. */
export function ClientDetailScreen({ clientId }: { clientId: string }) {
  const trainer = useTrainer();
  const client = useClient(clientId);
  const routine = useActiveRoutine(clientId);
  const targets = useMacroTargets(clientId);
  const menus = useActiveMenus(clientId);
  const logs = useWeightLogs(clientId);
  const reviews = useClientReviews(clientId);
  const types = useMeasurementTypes();
  const memberships = useClientMemberships(clientId);
  const queries = [trainer, client, routine, targets, menus, logs, reviews, types, memberships];

  if (queries.some((q) => q.isError)) {
    return <ErrorState onRetry={() => queries.forEach((q) => void q.refetch())} />;
  }
  if (client.data === null) {
    return <EmptyState title={t.notFoundTitle} description={t.notFoundHint} />;
  }
  if (
    !trainer.data ||
    !client.data ||
    routine.data === undefined ||
    !targets.data ||
    !menus.data ||
    !logs.data ||
    !reviews.data ||
    !types.data ||
    !memberships.data
  ) {
    return <LoadingState />;
  }

  const c = client.data;
  const today = todayCivil(trainer.data.timeZone);
  // Antes del alta no hay semana (§8): la cabecera dice cuándo empieza y las gráficas no tienen
  // semanas que pintar.
  const currentWeek = weekNumberOrNull(c.startDate, today, trainer.data.timeZone);
  const hasNewReview = reviews.data.some((r) => r.status === "enviada");
  // De baja: ficha de solo lectura, salvo «Reactivar» (tarjeta 5, n.º 8), y sin planes nuevos
  // (tarjeta 44). Ver la revisión nueva y el histórico siguen: son de lectura.
  const inactive = c.status === "dado_de_baja";
  const editorHref = inactive ? null : `/clients/${clientId}/editor`;
  const assignHref = inactive ? null : `/assignment?clientId=${clientId}`;
  const hasPlan = routine.data !== null || targets.data.length > 0 || menus.data.length > 0;
  // Las gráficas vacías de un cliente sin ningún plan llevan también el camino a Asignación.
  const chartAction =
    assignHref && !hasPlan ? (
      <p className="text-text-subtle">
        {t.plan.noPlanHint}{" "}
        <Link
          href={assignHref}
          // 32 px de alto como todo control pequeño (también en táctil).
          className="text-accent-hover hover:text-accent-emphasis inline-flex min-h-8 items-center"
        >
          {t.plan.assign}
        </Link>
      </p>
    ) : undefined;

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <InitialsAvatar
          initials={initialsOf(c.firstName, c.lastName)}
          className="size-16 text-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h1 className="page-title">
              {c.firstName} {c.lastName}
            </h1>
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs",
                c.status === "activo" ? "text-success" : "text-text-muted",
              )}
            >
              <span aria-hidden className="size-1.5 rounded-full bg-current" />
              {es.status.client[c.status]}
            </span>
          </div>
          <p className="text-text-muted text-sm">
            {[
              c.goal,
              currentWeek === null
                ? t.startsOn.replace("{date}", formatCivilDate(c.startDate))
                : `${t.weekLabel} ${currentWeek}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {editorHref ? (
            <>
              <Button variant="outline" asChild>
                <Link href={`/clients/${clientId}/edit`}>{t.edit}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={editorHref}>{t.editPlan}</Link>
              </Button>
            </>
          ) : null}
          {hasNewReview ? (
            <Button asChild>
              <Link href={`/clients/${clientId}/review`}>{t.viewNewReview}</Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-5">
          <MembershipCard
            clientId={clientId}
            memberships={memberships.data}
            today={today}
            readOnly={inactive}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RoutineCard routine={routine.data} editHref={editorHref} assignHref={assignHref} />
            <MacrosMenuCard
              targets={targets.data}
              menus={menus.data}
              editHref={editorHref}
              assignHref={assignHref}
            />
          </div>
          <WeightEvolutionCard
            title={t.weightTitle}
            points={
              currentWeek === null ? [] : weeklyWeights(logs.data, c.startDate, 1, currentWeek)
            }
            changeSinceStart={changeSinceStart(logs.data)}
            emptyAction={chartAction}
          />
          <MeasurementsCard
            key={types.data.length}
            series={
              currentWeek === null
                ? []
                : measurementSeries(reviews.data, types.data, 1, currentWeek)
            }
            emptyAction={chartAction}
          />
        </div>
        <div className="flex flex-col gap-[18px]">
          <h2 className="section-title">{t.reviews.title}</h2>
          <ReviewsHistory
            clientId={clientId}
            reviews={reviews.data}
            logs={logs.data}
            today={today}
            timeZone={trainer.data.timeZone}
            inactive={inactive}
          />
        </div>
      </div>

      <ClientStatusAction client={c} />
    </div>
  );
}
