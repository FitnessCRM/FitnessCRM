import { ProgressScreen } from "@/components/cliente/progress/progress-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.progreso };

export default function Page() {
  return <ProgressScreen />;
}
