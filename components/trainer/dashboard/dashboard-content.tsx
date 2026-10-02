import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import type { ClientStatus } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { todayCivil } from "@/lib/format";
import {
  useClientsTracking,
  useReviewStats,
  useReviewsTracking,
  useTrainer,
} from "@/lib/data/hooks";
import { DashboardStats } from "./dashboard-stats";
import { RecentReviews } from "./recent-reviews";
import { ClientsTable } from "./clients-table";

const t = es.pages.trainer.dashboard;

const RECENT_REVIEWS_COUNT = 5;
const PAGE_SIZE_CLIENTS = 5;

/**
 * Panel de control. Las cifras salen de los contadores del puerto, calculados sobre toda la cartera
 * y no sobre una página; los clientes se agrupan por los tres estados del dominio (§7: «inactivo»
 * no existe). Se aparta de la captura 09, que tenía «Clientes inactivos» y «Activos / Inactivos».
 */
export function DashboardContent() {
  const [clientsPage, setClientsPage] = useState(0);
  const [clientsFilter, setClientsFilter] = useState<ClientStatus>("activo");

  const trainer = useTrainer();
  // Igual que en Clientes: hasta que llega la zona del entrenador, la del navegador.
  const today = todayCivil(trainer.data?.timeZone);
  const reviewsQuery = useReviewsTracking({
    filter: "enviada",
    search: "",
    page: 0,
    pageSize: RECENT_REVIEWS_COUNT,
  });
  const statsQuery = useReviewStats();
  const clientsQuery = useClientsTracking({
    filter: clientsFilter,
    today,
    page: clientsPage,
    pageSize: PAGE_SIZE_CLIENTS,
  });
  const queries = [trainer, reviewsQuery, statsQuery, clientsQuery];

  if (queries.some((q) => q.isError)) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t} />
        <ErrorState onRetry={() => queries.forEach((q) => void q.refetch())} />
      </div>
    );
  }
  if (!trainer.data || !reviewsQuery.data || !statsQuery.data || !clientsQuery.data) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t} />
        <LoadingState />
      </div>
    );
  }

  const counts = clientsQuery.data.counts;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t} />

      <DashboardStats
        activeClients={counts.activo}
        unviewedReviews={statsQuery.data.unviewed}
        thisWeekReviews={statsQuery.data.thisWeek}
        pendingInvitations={counts.invitado}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.5fr]">
        <RecentReviews rows={reviewsQuery.data.rows} />
        <ClientsTable
          rows={clientsQuery.data.rows}
          filter={clientsFilter}
          onFilterChange={(f) => {
            setClientsFilter(f);
            setClientsPage(0);
          }}
          page={clientsPage}
          pageSize={PAGE_SIZE_CLIENTS}
          onPageChange={setClientsPage}
          counts={counts}
          today={today}
          timeZone={trainer.data.timeZone}
        />
      </div>
    </div>
  );
}
