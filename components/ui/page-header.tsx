import type { ReactNode } from "react";

/** Cabecera de página de la demo: eyebrow opcional en acento + título display. */
export function PageHeader({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-6">
      <div>
        {eyebrow ? <p className="eyebrow text-accent">{eyebrow}</p> : null}
        <h1 className="page-title mt-0.5">{title}</h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </header>
  );
}
