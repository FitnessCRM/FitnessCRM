"use client";

import { Combobox } from "@/components/ui/combobox";
import type { Client } from "@/lib/domain";
import { es } from "@/lib/i18n/es";

const t = es.clientPicker;

/**
 * El selector de cliente del panel: un autocompletado que filtra mientras se escribe. Lo usan
 * Clientes, Membresías y Asignación, y tiene que verse y comportarse igual en las tres. Con
 * `allowAll` la primera opción es «Todos los clientes» (el corte de una tabla) y `null` quita la
 * elección; sin él siempre hay un cliente elegido.
 */
export function ClientPicker({
  clients,
  value,
  onChange,
  allowAll = false,
  className,
}: {
  clients: Pick<Client, "id" | "firstName" | "lastName">[];
  /** `null` = ninguno elegido (solo con `allowAll`). */
  value: string | null;
  onChange: (clientId: string | null) => void;
  allowAll?: boolean;
  className?: string;
}) {
  return (
    <Combobox
      className={className}
      label={t.label}
      placeholder={t.placeholder}
      allLabel={allowAll ? t.all : undefined}
      emptyLabel={t.noMatch}
      value={value}
      options={clients.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
      onChange={onChange}
    />
  );
}
