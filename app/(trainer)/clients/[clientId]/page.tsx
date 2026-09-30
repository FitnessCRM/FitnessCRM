import { ClientDetailScreen } from "@/components/trainer/client-detail/client-detail-screen";
import { es } from "@/lib/i18n/es";

const title = es.pages.trainer.clienteDetalle;

export const metadata = { title };

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ClientDetailScreen clientId={clientId} />;
}
