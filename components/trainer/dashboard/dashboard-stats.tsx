import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";

const t = es.components.dashboard;

export function DashboardStats({
  activeClients,
  unviewedReviews,
  thisWeekReviews,
  pendingInvitations,
}: {
  activeClients: number;
  unviewedReviews: number;
  thisWeekReviews: number;
  /** Clientes `invitado`: «inactivo» no existe (§7); la cuarta cifra son las invitaciones. */
  pendingInvitations: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label={t.activeClients} value={activeClients} highlight={false} />
      <Stat label={t.unviewedReviews} value={unviewedReviews} highlight={unviewedReviews > 0} />
      <Stat label={t.thisWeekReviews} value={thisWeekReviews} highlight={false} />
      <Stat label={t.pendingInvitations} value={pendingInvitations} highlight={false} />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight: boolean }) {
  return (
    <div
      className={cn(
        "bg-surface rounded-lg border p-6 text-center transition-colors",
        highlight ? "border-accent bg-accent-soft" : "border-border",
      )}
    >
      <div className={cn("text-4xl font-bold", highlight ? "text-accent" : "text-text-primary")}>
        {value}
      </div>
      <div className="text-text-muted mt-2 text-sm tracking-wider uppercase">{label}</div>
    </div>
  );
}
