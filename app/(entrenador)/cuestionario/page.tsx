import { QuestionnaireScreen } from "@/components/entrenador/catalog/questionnaire-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.cuestionario };

export default function Page() {
  return <QuestionnaireScreen />;
}
