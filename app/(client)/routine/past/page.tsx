import { Suspense } from "react";
import { PastWorkoutScreen } from "@/components/client/routine/past-workout-screen";
import { LoadingState } from "@/components/ui/states";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.screensWorkoutDay.title };

export default function Page() {
  // La fecha elegida viaja en la query: Suspense para que la página siga siendo estática.
  return (
    <Suspense fallback={<LoadingState />}>
      <PastWorkoutScreen />
    </Suspense>
  );
}
