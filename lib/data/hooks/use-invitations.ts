"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";

/** Envía o reenvía la invitación de un cliente invitado. */
export function useSendInvitation(trainerId: string) {
  const ports = usePorts();
  return useMutation({
    mutationFn: (clientId: string) => ports.invitations.sendInvitation(trainerId, clientId),
  });
}

/** Si la dirección abierta es un enlace de invitación. No es una consulta: no toca la red. */
export function useIsInvitationLink() {
  const ports = usePorts();
  return (link: string) => ports.invitations.isInvitationLink(link);
}

/** Completa la invitación: entra con el enlace, fija la contraseña y deja la sesión abierta. */
export function useAcceptInvitation() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; link: string; password: string }) =>
      ports.invitations.acceptInvitation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.session }),
  });
}
