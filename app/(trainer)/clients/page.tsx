import { ClientsScreen } from "@/components/trainer/clients/clients-screen";
import { es } from "@/lib/i18n/es";

const title = es.pages.trainer.clientes;

export const metadata = { title };

export default function Page() {
  return <ClientsScreen />;
}
