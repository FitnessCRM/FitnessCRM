import { ClientReviewScreen } from "@/components/trainer/client-review/client-review-screen";
import { es } from "@/lib/i18n/es";

const title = es.pages.trainer.revisionCliente;

export const metadata = { title };

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ClientReviewScreen clientId={clientId} />;
}
