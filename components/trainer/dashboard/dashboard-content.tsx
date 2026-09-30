import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { Client, Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { useClientsWithPagination, useSubmittedReviewsPage } from "@/lib/data/hooks";
import { DashboardStats } from "./dashboard-stats";
import { RecentReviews } from "./recent-reviews";
import { ClientsTable } from "./clients-table";

const t = es.pages.trainer.dashboard;

const PAGE_SIZE_REVIEWS = 3;
const PAGE_SIZE_CLIENTS = 5;

type ReviewWithClient = Review & { clientName: string };

export function DashboardContent() {
  const [reviewsPage, setReviewsPage] = useState(0);
  const [clientsPage, setClientsPage] = useState(0);
  const [clientsFilter, setClientsFilter] = useState<"activo" | "inactivo" | "todos">("todos");

  const reviewsQuery = useSubmittedReviewsPage(reviewsPage, PAGE_SIZE_REVIEWS);
  const clientsQuery = useClientsWithPagination(clientsFilter, clientsPage, PAGE_SIZE_CLIENTS);

  // Para las estadísticas necesitamos todos los clientes
  const allClientsQuery = useClientsWithPagination("todos", 0, 1000);

  if (reviewsQuery.isLoading || clientsQuery.isLoading || allClientsQuery.isLoading) {
    return <PageHeader title={t} />;
  }

  const reviews = reviewsQuery.data?.rows ?? [];
  const clients = clientsQuery.data?.rows ?? [];
  const allClients = allClientsQuery.data?.rows ?? [];
  const clientsCounts = clientsQuery.data?.counts ?? { activo: 0, inactivo: 0, todos: 0 };

  const activeClients = allClients.filter((c) => c.status === "activo");
  const inactiveClients = allClients.filter((c) => c.status !== "activo");

  // Revisiones enviadas sin revisar (no vistas)
  const unviewedReviews = reviews.filter((r) => r.viewedAt === null);

  // Revisiones de esta semana
  const thisWeekReviews = reviews.filter((r) => {
    const reviewDate = new Date(r.window.start);
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return reviewDate >= oneWeekAgo && reviewDate <= today;
  });

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
        unviewedReviews={unviewedReviews.length}
        thisWeekReviews={thisWeekReviews.length}
        inactiveClients={inactiveClients.length}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.5fr]">
        <RecentReviews
          reviews={reviewsWithClient}
          page={reviewsPage}
          total={reviewsQuery.data?.total ?? 0}
          pageSize={PAGE_SIZE_REVIEWS}
          onPageChange={setReviewsPage}
        />
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
