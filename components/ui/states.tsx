import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.common;

/** Estado de carga: texto discreto más un bloque que parpadea con el tamaño del contenido. */
export function LoadingState({
  label = t.loading,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("text-text-subtle flex items-center gap-3 py-6 text-sm", className)}
    >
      <span aria-hidden className="bg-border-strong size-2 animate-pulse rounded-full" />
      {label}
    </div>
  );
}

/** Estado vacío: título corto, explicación opcional y, si procede, la acción que lo resuelve. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border-subtle flex flex-col items-start gap-2 rounded-lg border border-dashed px-5 py-6",
        className,
      )}
    >
      <p className="font-display tracking-label text-text-muted text-[15px] font-semibold uppercase">
        {title}
      </p>
      {description ? <p className="text-text-subtle text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Estado de error: mensaje en rojo y reintento. El detalle técnico no se enseña. */
export function ErrorState({
  message = t.error,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-danger/35 bg-danger-soft flex items-center justify-between gap-4 rounded-lg border px-5 py-4",
        className,
      )}
    >
      <p className="text-danger text-sm">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t.retry}
        </Button>
      ) : null}
    </div>
  );
}
