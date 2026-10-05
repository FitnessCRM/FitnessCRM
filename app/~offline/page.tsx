import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { es } from "@/lib/i18n/es";

export const metadata = { title: es.offline.title };

/**
 * Respaldo del service worker cuando se abre una pantalla que aún no está en el dispositivo y no
 * hay red. Va precacheada (`next.config.ts`). La raíz redirige, así que el enlace lleva a `/login`,
 * que ya manda a cada cual a su área si hay sesión.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <Brand />
      <h1 className="font-display tracking-label text-[28px] uppercase">{es.offline.title}</h1>
      <p className="text-text-muted max-w-sm text-[15px]">{es.offline.body}</p>
      <Link
        href="/login"
        className="bg-accent text-on-accent font-display tracking-label min-h-8 rounded-sm px-5 py-2 text-[14px] uppercase"
      >
        {es.offline.goHome}
      </Link>
    </main>
  );
}
