"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { useCreateClient, useSaveMembership, useTrainer } from "@/lib/data/hooks";
import type { Client } from "@/lib/domain";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { ClientSignupForm, type SignupIntent, type SignupValues } from "./client-signup-form";

const t = es.screensClientSignup;

/** Cadencia de revisión con la que nace todo cliente: el alta no la pregunta; se cambia al editar. */
const DEFAULT_REVIEW_EVERY_DAYS = 7;

/**
 * Alta de cliente (`/clients/new`). Crea el cliente —siempre `invitado`, lo fija el adaptador—
 * y su membresía inicial. Son dos escrituras de los puertos y no hay transacción entre ellas: si
 * la segunda falla el cliente ya existe, y reintentar solo repite la membresía en vez de crear un
 * segundo cliente.
 */
export function ClientSignupScreen() {
  const router = useRouter();
  const trainer = useTrainer();
  const createClient = useCreateClient();
  const saveMembership = useSaveMembership();
  const created = useRef<Client | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (values: SignupValues, intent: SignupIntent) => {
    setError(null);
    try {
      created.current ??= await createClient.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        goal: values.goal,
        level: values.level,
        initialNotes: values.initialNotes,
        startDate: values.startDate,
        reviewCadence: { everyDays: DEFAULT_REVIEW_EVERY_DAYS },
      });
    } catch (cause) {
      setError(t.errors.clientFailed);
      throw cause;
    }

    const client = created.current;
    try {
      await saveMembership.mutateAsync({
        create: {
          clientId: client.id,
          type: values.membershipType,
          startDate: values.membershipStart,
          endDate: values.membershipEnd,
          paymentStatus: values.paymentStatus,
        },
      });
    } catch (cause) {
      setError(t.errors.membershipFailed);
      throw cause;
    }

    router.push(
      intent === "assign" ? `/assignment?clientId=${client.id}` : `/clients/${client.id}`,
    );
  };

  let body;
  if (trainer.isError) {
    body = <ErrorState onRetry={() => void trainer.refetch()} />;
  } else if (!trainer.data) {
    body = <LoadingState />;
  } else {
    body = (
      <ClientSignupForm
        today={todayCivil(trainer.data.timeZone)}
        isSaving={createClient.isPending || saveMembership.isPending}
        error={error}
        onSubmit={submit}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t.eyebrow} title={es.pages.trainer.clienteNuevo} />
      {body}
    </div>
  );
}
