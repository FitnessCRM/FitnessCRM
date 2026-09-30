import { ClientSignupScreen } from "@/components/trainer/clients/client-signup-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.clienteNuevo };

export default function Page() {
  return <ClientSignupScreen />;
}
