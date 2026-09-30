"use client";

import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { useClients, useSubmittedReviews } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { DashboardContent } from "./dashboard-content";

const t = es.pages.trainer.dashboard;

export function DashboardScreen() {
  const clients = useClients();
  const reviews = useSubmittedReviews();

  return (
    <QueryBoundary
      query={clients}
      isEmpty={() => false}
      empty={null}
      loading={<PageHeader title={t} />}
    >
      {(clientsData) => (
        <QueryBoundary query={reviews} isEmpty={() => false} empty={null} loading={null}>
          {(reviewsData) => <DashboardContent clients={clientsData} reviews={reviewsData} />}
        </QueryBoundary>
      )}
    </QueryBoundary>
  );
}
