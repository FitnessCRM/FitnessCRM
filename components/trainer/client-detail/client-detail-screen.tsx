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
  useClientReviews,
  useMacroTargets,
  useMeasurementTypes,
  useTrainer,
  useWeightLogs,
} from "@/lib/data/hooks";
import {
  DomainError,
  changeSinceStart,
  measurementSeries,
  weekNumber,
  weeklyWeights,
} from "@/lib/domain";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { cn, initialsOf } from "@/lib/utils";
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
  const queries = [trainer, client, routine, targets, menus, logs, reviews, types];

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
    !types.data
  ) {
    return <LoadingState />;
  }

  const c = client.data;
  const today = todayCivil(trainer.data.timeZone);
  let currentWeek = 1;
  try {
    currentWeek = weekNumber(c.startDate, today, trainer.data.timeZone);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
  }
  const hasNewReview = reviews.data.some((r) => r.status === "enviada");
  const editorHref = `/clientes/${clientId}/editor`;

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
            {[c.goal, `${t.weekLabel} ${currentWeek}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" asChild>
            <Link href={editorHref}>{t.editPlan}</Link>
          </Button>
          {hasNewReview ? (
            <Button asChild>
              <Link href={`/clientes/${clientId}/revision`}>{t.viewNewReview}</Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <RoutineCard routine={routine.data} editHref={editorHref} />
            <MacrosMenuCard targets={targets.data} menus={menus.data} editHref={editorHref} />
          </div>
          <WeightEvolutionCard
            title={t.weightTitle}
            points={weeklyWeights(logs.data, c.startDate, 1, currentWeek)}
            changeSinceStart={changeSinceStart(logs.data)}
          />
          <MeasurementsCard
            key={types.data.length}
            series={measurementSeries(reviews.data, types.data, 1, currentWeek)}
          />
        </div>
        <div className="flex flex-col gap-[18px]">
          <h2 className="section-title">{t.reviews.title}</h2>
          <ReviewsHistory
            clientId={clientId}
            reviews={reviews.data}
            logs={logs.data}
            today={today}
          />
        </div>
      </div>
    </div>
  );
}
