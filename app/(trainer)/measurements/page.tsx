import { MeasurementsScreen } from "@/components/entrenador/catalog/measurements-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.medidas };

export default function Page() {
  return <MeasurementsScreen />;
}
