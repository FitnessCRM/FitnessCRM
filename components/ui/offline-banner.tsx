"use client";

import { useOnlineStatus } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";

/** Franja que avisa de que no hay red y de que lo que se ve viene de lo guardado en el dispositivo. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="bg-surface-raised border-border-subtle text-text-muted border-b px-10 py-2 text-center text-[13px] max-sm:px-4"
    >
      {es.offline.banner}
    </div>
  );
}
