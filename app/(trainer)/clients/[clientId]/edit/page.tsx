import { ClientEditScreen } from "@/components/trainer/clients/client-edit-screen";
import { es } from "@/lib/i18n/es";

const title = es.pages.trainer.clienteEditar;

export const metadata = { title };

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <ClientEditScreen clientId={clientId} />;
}
