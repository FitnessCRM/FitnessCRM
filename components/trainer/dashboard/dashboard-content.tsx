import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import type { Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import {
  useClientsWithPagination,
  useReviewStats,
  useSubmittedReviewsPage,
} from "@/lib/data/hooks";
import { DashboardStats } from "./dashboard-stats";
import { RecentReviews } from "./recent-reviews";
import { ClientsTable } from "./clients-table";

const t = es.pages.trainer.dashboard;

const RECENT_REVIEWS_COUNT = 5;
const PAGE_SIZE_CLIENTS = 5;

type ReviewWithClient = Review & { clientName: string };

export function DashboardContent() {
  const [clientsPage, setClientsPage] = useState(0);
  const [clientsFilter, setClientsFilter] = useState<"activo" | "inactivo" | "todos">("todos");

  const reviewsQuery = useSubmittedReviewsPage(0, RECENT_REVIEWS_COUNT);
  const statsQuery = useReviewStats();
  const clientsQuery = useClientsWithPagination(clientsFilter, clientsPage, PAGE_SIZE_CLIENTS);

  // Para las estadísticas necesitamos todos los clientes
  const allClientsQuery = useClientsWithPagination("todos", 0, 1000);

  if (
    reviewsQuery.isLoading ||
    statsQuery.isLoading ||
    clientsQuery.isLoading ||
    allClientsQuery.isLoading
  ) {
    return <PageHeader title={t} />;
  }

  const reviews = reviewsQuery.data?.rows ?? [];
  const clients = clientsQuery.data?.rows ?? [];
  const allClients = allClientsQuery.data?.rows ?? [];
  const clientsCounts = clientsQuery.data?.counts ?? { activo: 0, inactivo: 0, todos: 0 };

  const activeClients = allClients.filter((c) => c.status === "activo");
  const inactiveClients = allClients.filter((c) => c.status !== "activo");

  // Enriquecer revisiones con nombre del cliente
  const clientsById = new Map(allClients.map((c) => [c.id, c]));
  const reviewsWithClient: ReviewWithClient[] = reviews.map((r) => {
    const client = clientsById.get(r.clientId);
    return {
      ...r,
      clientName: client ? `${client.firstName} ${client.lastName}` : "Desconocido",
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t} />

      <DashboardStats
        activeClients={activeClients.length}
        unviewedReviews={statsQuery.data?.unviewed ?? 0}
        thisWeekReviews={statsQuery.data?.thisWeek ?? 0}
        inactiveClients={inactiveClients.length}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.5fr]">
        <RecentReviews reviews={reviewsWithClient} />
        <ClientsTable
          clients={clients}
          filter={clientsFilter}
          onFilterChange={(f) => {
            setClientsFilter(f);
            setClientsPage(0);
          }}
          page={clientsPage}
          total={clientsCounts[clientsFilter]}
          pageSize={PAGE_SIZE_CLIENTS}
          onPageChange={setClientsPage}
          counts={clientsCounts}
        />
      </div>
    </div>
  );
}
