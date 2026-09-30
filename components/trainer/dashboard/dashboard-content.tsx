import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import type { Client, Review } from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { DashboardStats } from "./dashboard-stats";
import { RecentReviews } from "./recent-reviews";
import { ClientsTable } from "./clients-table";

const t = es.pages.trainer.dashboard;

type ReviewWithClient = Review & { clientName: string };

export function DashboardContent({ clients, reviews }: { clients: Client[]; reviews: Review[] }) {
  const router = useRouter();
  const clientsById = new Map(clients.map((c) => [c.id, c]));

  const activeClients = clients.filter((c) => c.status === "activo");
  const inactiveClients = clients.filter((c) => c.status !== "activo");

  // Revisiones enviadas sin revisar (no vistas)
  const unviewedReviews = reviews.filter((r) => r.status === "enviada" && r.viewedAt === null);

  // Revisiones de esta semana
  const thisWeekReviews = reviews.filter((r) => {
    const reviewDate = new Date(r.window.start);
    const today = new Date();
    const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    return reviewDate >= oneWeekAgo && reviewDate <= today;
  });

  // Enriquecer revisiones con nombre del cliente
  const reviewsWithClient: ReviewWithClient[] = reviews.map((r) => {
    const client = clientsById.get(r.clientId);
    return {
      ...r,
      clientName: client ? `${client.firstName} ${client.lastName}` : "Desconocido",
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t}
        actions={
          <Button variant="destructive" onClick={() => router.push("/clientes/nuevo")}>
            + {es.actions.newClient}
          </Button>
        }
      />

      <DashboardStats
        activeClients={activeClients.length}
        unviewedReviews={unviewedReviews.length}
        thisWeekReviews={thisWeekReviews.length}
        inactiveClients={inactiveClients.length}
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.5fr]">
        <RecentReviews reviews={reviewsWithClient} />
        <ClientsTable clients={clients} />
      </div>
    </div>
  );
}
