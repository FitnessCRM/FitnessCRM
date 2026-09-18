import { PageHeader } from "@/components/ui/page-header";
import { es } from "@/lib/i18n/es";

const title = es.pages.client.progreso;

export const metadata = { title };

export default function Page() {
  return <PageHeader title={title} />;
}
