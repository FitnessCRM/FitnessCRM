import { LibraryScreen } from "@/components/entrenador/library/library-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.biblioteca };

export default function Page() {
  return <LibraryScreen />;
}
