import { redirect } from "next/navigation";
import { LibraryScreen } from "@/components/trainer/library/library-screen";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.trainer.biblioteca };

/** Los alimentos salieron de la Biblioteca: `?tab=foods` (enlaces antiguos) va a su sección. */
export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  if (tab === "foods") redirect("/foods");
  return <LibraryScreen />;
}
