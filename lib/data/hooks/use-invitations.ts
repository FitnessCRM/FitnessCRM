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

/**
 * Abre el enlace y dice a qué correo va (`null` si la persona tiene que escribirlo). Gasta el enlace:
 * se llama una vez, al abrir la página.
 */
export function useReadInvitation() {
  const ports = usePorts();
  return useMutation({
    mutationFn: (link: string) => ports.invitations.readInvitation(link),
  });
}

/**
 * Completa la invitación: fija la contraseña y deja la sesión abierta. `email` solo se pasa si la
 * persona lo escribió (cuando `useReadInvitation` no lo sabía).
 */
export function useAcceptInvitation() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { link: string; password: string; email?: string }) =>
      ports.invitations.acceptInvitation(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.session }),
  });
}
