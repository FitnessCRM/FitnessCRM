"use client";

import { MeasurementsCard } from "@/components/charts/measurements-card";
import { WeightEvolutionCard } from "@/components/charts/weight-evolution-card";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  DomainError,
  changeSinceStart,
  measurementSeries,
  weekNumber,
  weeklyWeights,
} from "@/lib/domain";
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
  let currentWeek = 1;
  try {
    currentWeek = weekNumber(client.data.startDate, today, trainer.data.timeZone);
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_440px]">
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow={`${currentWeek} ${t.weeksLabel}`} title={es.pages.client.progreso} />
        <WeightEvolutionCard
          points={weeklyWeights(logs.data, client.data.startDate, 1, currentWeek)}
          changeSinceStart={changeSinceStart(logs.data)}
        />
        <MeasurementsCard
          key={types.data.length}
          series={measurementSeries(reviews.data, types.data, 1, currentWeek)}
        />
      </div>
      <div className="flex flex-col gap-[18px] lg:pt-3.5">
        <h2 className="section-title">{t.reviews.title}</h2>
        <ReviewsList reviews={reviews.data} logs={logs.data} today={today} />
      </div>
    </div>
  );
}
