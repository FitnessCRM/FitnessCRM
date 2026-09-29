import { Suspense } from "react";
import { ViewReviewScreen } from "@/components/client/view-review/view-review-screen";
import { LoadingState } from "@/components/ui/states";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.verRevision };

export default function Page() {
  // La revisiÃ³n elegida viaja en la query: Suspense para que la pÃ¡gina siga siendo estÃ¡tica.
  return (
    <Suspense fallback={<LoadingState />}>
      <ViewReviewScreen />
    </Suspense>
  );
}
