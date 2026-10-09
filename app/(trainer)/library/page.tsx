import { Suspense } from "react";
import { LibraryScreen } from "@/components/trainer/library/library-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.biblioteca };

// La pestaña activa sale de `useSearchParams`, que en una página estática pide su `Suspense`.
export default function Page() {
  return (
    <Suspense>
      <LibraryScreen />
    </Suspense>
  );
}
