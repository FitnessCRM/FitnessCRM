"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";

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
import { changeSinceStart, measurementSeries, weekNumberOrNull, weeklyWeights } from "@/lib/domain";
import {
  useClient,
  useClientReviews,
  useMeasurementTypes,
  useSessionClientId,
  useTrainer,
  useWeightLogs,
} from "@/lib/data/hooks";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { ReviewsList } from "./reviews-list";

const t = es.screensProgress;

/** Pantalla 06 · Tu progreso: peso y medidas por semana a la izquierda, histórico a la derecha. */
export function ProgressScreen() {
  const clientId = useSessionClientId();
  const trainer = useTrainer();
  const client = useClient(clientId);
  const logs = useWeightLogs(clientId);
  const reviews = useClientReviews(clientId);
  const types = useMeasurementTypes();
  const queries = [trainer, client, logs, reviews, types];

  if (queries.some((q) => q.isError)) {
    return <ErrorState onRetry={() => queries.forEach((q) => void q.refetch())} />;
  }
  if (!trainer.data || !client.data || !logs.data || !reviews.data || !types.data) {
    return <LoadingState />;
  }

  const today = todayCivil(trainer.data.timeZone);
  // Antes del alta no hay semana (§8): «—» y gráficas sin semanas.
  const currentWeek = weekNumberOrNull(client.data.startDate, today, trainer.data.timeZone);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_440px]">
      <div className="flex flex-col gap-5">
        <PageHeader
          eyebrow={`${currentWeek ?? es.common.none} ${t.weeksLabel}`}
          title={es.pages.client.progreso}
        />
        <WeightEvolutionCard
          points={
            currentWeek === null
              ? []
              : weeklyWeights(logs.data, client.data.startDate, 1, currentWeek)
          }
          changeSinceStart={changeSinceStart(logs.data)}
        />
        <MeasurementsCard
          key={types.data.length}
          series={
            currentWeek === null ? [] : measurementSeries(reviews.data, types.data, 1, currentWeek)
          }
        />
      </div>
      <div className="flex flex-col gap-[18px] lg:pt-3.5">
        <h2 className="section-title">{t.reviews.title}</h2>
        <ReviewsList reviews={reviews.data} logs={logs.data} today={today} />
      </div>
    </div>
  );
}
