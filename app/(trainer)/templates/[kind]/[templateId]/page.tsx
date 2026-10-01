import { notFound } from "next/navigation";
import { TemplateEditScreen } from "@/components/trainer/template-editor/template-edit-screen";
import { templateKindSchema } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.screensTemplateEditor.editTitle };

export default async function Page({
  params,
}: {
  params: Promise<{ kind: string; templateId: string }>;
}) {
  const { kind, templateId } = await params;
  const parsed = templateKindSchema.safeParse(kind);
  if (!parsed.success) notFound();
  return <TemplateEditScreen kind={parsed.data} templateId={templateId} />;
}
