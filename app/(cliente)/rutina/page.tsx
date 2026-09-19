import { RoutineScreen } from "@/components/cliente/routine/routine-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.rutina };

export default function Page() {
  return <RoutineScreen />;
}
