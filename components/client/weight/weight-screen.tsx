"use client";

import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { EmptyState } from "@/components/ui/states";
import {
  DomainError,
  lastWeeksRange,
  weekNumber,
  weeklyWeights,
  weightSummary,
  type Client,
  type WeightLog,
} from "@/lib/domain";
import {
  useSaveWeightLog,
  useClient,
  useClientReviews,
  useSessionClientId,
  useTrainer,
  useWeightLogs,
} from "@/lib/data/hooks";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { WeightForm } from "./weight-form";
import { WeightHistory } from "./weight-history";
import { WeightSummaryCard } from "./weight-summary";

const WeightTrendCard = dynamic(
  () => import("./weight-trend-card").then((m) => m.WeightTrendCard),
  {
    ssr: false,
    loading: () => <div className="border-border-subtle h-60 rounded-lg border p-6" />,
  },
);

const t = es.screens.weight;

function trendPoints(
  logs: WeightLog[],
  client: Client | null | undefined,
  today: string,
  tz?: string,
) {
  if (!client) return [];
  try {
    const { from, to } = lastWeeksRange(weekNumber(client.startDate, today, tz ?? "UTC"));
    return weeklyWeights(logs, client.startDate, from, to);
  } catch (error) {
    if (error instanceof DomainError) return [];
    throw error;
  }
}

/** Pantalla 04 · Registro de peso. Formulario a la izquierda, gráfica e historial a la derecha. */
export function WeightScreen() {
  const clientId = useSessionClientId();
  const trainer = useTrainer();
  const client = useClient(clientId);
  const logs = useWeightLogs(clientId);
  const reviews = useClientReviews(clientId);
  const saveWeightLog = useSaveWeightLog(clientId);

  const today = todayCivil(trainer.data?.timeZone);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[440px_1fr]">
      <div className="flex flex-col gap-5">
        <div>
          <PageHeader eyebrow={t.eyebrow} title={es.pages.client.peso} />
          <p className="text-text-muted mt-2 max-w-md text-[14px] leading-relaxed">{t.intro}</p>
        </div>
        <WeightForm
          today={today}
          isSaving={saveWeightLog.isPending}
          saveError={saveWeightLog.isError}
          onSubmit={(values) => saveWeightLog.mutateAsync(values)}
        />
        <QueryBoundary query={logs} isEmpty={() => false} empty={null}>
          {(data) => <WeightSummaryCard summary={weightSummary(data)} />}
        </QueryBoundary>
      </div>

      <div className="flex flex-col gap-4">
        <QueryBoundary
          query={logs}
          empty={
            <>
              <WeightTrendCard points={[]} />
              <EmptyState title={t.history.emptyTitle} description={t.history.emptyHint} />
            </>
          }
        >
          {(data) => (
            <>
              <WeightTrendCard
                points={trendPoints(data, client.data, today, trainer.data?.timeZone)}
              />
              <WeightHistory logs={data} reviews={reviews.data ?? []} today={today} />
            </>
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}
