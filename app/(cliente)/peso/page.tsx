import { WeightScreen } from "@/components/cliente/weight/weight-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.peso };

export default function Page() {
  return <WeightScreen />;
}
