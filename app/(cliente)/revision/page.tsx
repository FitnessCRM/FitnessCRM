import { ReviewScreen } from "@/components/cliente/review/review-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.revision };

export default function Page() {
  return <ReviewScreen />;
}
