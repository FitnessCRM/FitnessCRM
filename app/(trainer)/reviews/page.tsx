import { ReviewsScreen } from "@/components/trainer/reviews/reviews-screen";
import { es } from "@/lib/i18n/es";

const title = es.pages.trainer.revisiones;

export const metadata = { title };

export default function Page() {
  return <ReviewsScreen />;
}
