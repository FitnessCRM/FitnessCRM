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
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div>
        {eyebrow ? <p className="eyebrow text-accent">{eyebrow}</p> : null}
        <h1 className="page-title mt-0.5">{title}</h1>
      </div>
      {actions ? (
        <div className="flex max-w-full flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}
