import { Suspense } from "react";
import { WorkoutDayScreen } from "@/components/client/progress/workout-day-screen";
import { LoadingState } from "@/components/ui/states";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.screensWorkoutDay.title };

export default function Page() {
  // La fecha elegida viaja en la query: Suspense para que la página siga siendo estática.
  return (
    <Suspense fallback={<LoadingState />}>
      <WorkoutDayScreen />
    </Suspense>
  );
}
