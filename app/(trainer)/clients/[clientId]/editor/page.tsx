import { PlanEditorScreen } from "@/components/trainer/plan-editor/plan-editor-screen";
import { es } from "@/lib/i18n/es";

const title = es.pages.trainer.editor;

export const metadata = { title };

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return <PlanEditorScreen clientId={clientId} />;
}
