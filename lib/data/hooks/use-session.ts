"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePorts } from "./ports-provider";
import { clearPersistedCache } from "./query-persister";
import { queryKeys } from "./query-keys";

/** Sesión actual (ids de entrenador y, si procede, de cliente). */
export function useSession() {
  const ports = usePorts();
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => ports.session.getSession(),
    staleTime: Infinity,
  });
}

/** `trainerId` de la sesión, o `undefined` mientras carga. Los demás hooks dependen de él. */
export function useTrainerId(): string | undefined {
  return useSession().data?.trainerId;
}

/** `clientId` de la sesión para el área de cliente. */
export function useSessionClientId(): string | undefined {
  return useSession().data?.clientId ?? undefined;
}

export function useTrainer() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.trainer(trainerId ?? ""),
    queryFn: () => ports.trainer.getTrainer(trainerId!),
    enabled: trainerId !== undefined,
  });
}

/**
 * Cierra la sesión y borra lo que el dispositivo guardó de ella, en memoria y en disco: eran datos
 * de quien salía. Llevar a `/login` es de quien lo llama.
 */
export function useLogout() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ports.session.logout(),
    onSuccess: async () => {
      queryClient.clear();
      await clearPersistedCache();
    },
  });
}

export function useLogin() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      ports.session.login(credentials.email, credentials.password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}
