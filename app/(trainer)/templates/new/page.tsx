import { TemplateCreateScreen } from "@/components/trainer/template-editor/template-create-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.screensTemplateEditor.createTitle };

export default function Page() {
  return <TemplateCreateScreen />;
}
