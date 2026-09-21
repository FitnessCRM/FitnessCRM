import { Suspense } from "react";
import { ViewReviewScreen } from "@/components/cliente/view-review/view-review-screen";
import { LoadingState } from "@/components/ui/states";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.client.verRevision };

export default function Page() {
  // La revisión elegida viaja en la query: Suspense para que la página siga siendo estática.
  return (
    <Suspense fallback={<LoadingState />}>
      <ViewReviewScreen />
    </Suspense>
  );
}
