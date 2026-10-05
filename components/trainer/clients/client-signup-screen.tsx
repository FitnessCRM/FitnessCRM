"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  useCreateClient,
  useSaveMembership,
  useSendInvitation,
  useTrainer,
} from "@/lib/data/hooks";
import type { Client } from "@/lib/domain";
import { todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { ClientSignupForm, type SignupIntent, type SignupValues } from "./client-signup-form";

const t = es.screensClientSignup;

/** Cadencia de revisión con la que nace todo cliente: el alta no la pregunta; se cambia al editar. */
const DEFAULT_REVIEW_EVERY_DAYS = 7;

/**
 * Alta de cliente (`/clients/new`). Crea el cliente —siempre `invitado`, lo fija el adaptador—,
 * su membresía inicial y le envía la invitación por correo. Son tres operaciones de los puertos y
 * no hay transacción entre ellas: si una falla las anteriores ya están hechas, y reintentar solo
 * repite la que falta en vez de crear un segundo cliente o una segunda membresía.
 */
export function ClientSignupScreen() {
  const router = useRouter();
  const trainer = useTrainer();
  const createClient = useCreateClient();
  const saveMembership = useSaveMembership();
  const sendInvitation = useSendInvitation(trainer.data?.id ?? "");
  const created = useRef<Client | null>(null);
  const membershipSaved = useRef(false);
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
    if (!membershipSaved.current) {
      try {
        await saveMembership.mutateAsync({
          create: {
            clientId: client.id,
            ...values.membership,
          },
        });
        membershipSaved.current = true;
      } catch (cause) {
        setError(t.errors.membershipFailed);
        throw cause;
      }
    }

    try {
      await sendInvitation.mutateAsync(client.id);
    } catch (cause) {
      setError(t.errors.invitationFailed);
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
        isSaving={createClient.isPending || saveMembership.isPending || sendInvitation.isPending}
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
