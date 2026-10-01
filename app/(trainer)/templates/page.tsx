import { TemplatesScreen } from "@/components/trainer/templates/templates-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.plantillas };

export default function Page() {
  return <TemplatesScreen />;
}
