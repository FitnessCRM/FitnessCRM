"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useClient, useUpdateClient } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { ClientEditForm, type EditValues } from "./client-edit-form";

const t = es.screensClientEdit;

/**
 * Edición de los datos de un cliente (`/clients/[clientId]/edit`). No escribe `startDate` ni
 * `status`: la fecha de alta es el origen de la numeración de semanas y el estado tiene su propio
 * flujo.
 */
export function ClientEditScreen({ clientId }: { clientId: string }) {
  const router = useRouter();
  const client = useClient(clientId);
  const updateClient = useUpdateClient();
  const [error, setError] = useState<string | null>(null);

  const submit = async (values: EditValues) => {
    setError(null);
    try {
      await updateClient.mutateAsync({
        clientId,
        changes: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          goal: values.goal,
          level: values.level,
          initialNotes: values.initialNotes,
          reviewCadence: { everyDays: Number(values.reviewEveryDays) },
        },
      });
    } catch (cause) {
      setError(t.errors.saveFailed);
      throw cause;
    }
    router.push(`/clients/${clientId}`);
  };

  let body;
  if (client.isError) {
    body = <ErrorState onRetry={() => void client.refetch()} />;
  } else if (client.data === null) {
    body = (
      <EmptyState
        title={es.screensClientDetail.notFoundTitle}
        description={es.screensClientDetail.notFoundHint}
      />
    );
  } else if (!client.data) {
    body = <LoadingState />;
  } else {
    body = (
      <ClientEditForm
        client={client.data}
        isSaving={updateClient.isPending}
        error={error}
        onSubmit={submit}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow={t.eyebrow} title={es.pages.trainer.clienteEditar} />
      {body}
    </div>
  );
}
