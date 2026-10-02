"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientChanges,
  ClientInput,
  ClientTrackingQuery,
  MembershipChanges,
  MembershipInput,
  MembershipQuery,
} from "@/lib/data/ports";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

export function useClients() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.clients(trainerId ?? ""),
    queryFn: () => ports.clients.listClients(trainerId!),
    enabled: trainerId !== undefined,
  });
}

export function useClientsTracking(query: ClientTrackingQuery) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.clientsTracking(trainerId ?? "", query),
    queryFn: () => ports.clients.listClientsTracking(trainerId!, query),
    enabled: trainerId !== undefined,
    // Al pasar de página o filtrar se sigue viendo la lista anterior hasta que llega la nueva.
    placeholderData: keepPreviousData,
  });
}

export function useClient(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.client(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.clients.getClient(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

export function useCreateClient() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (input: Omit<ClientInput, "trainerId">) =>
      ports.clients.createClient({ ...input, trainerId: trainerId! }),
    onSuccess: (client) =>
      queryClient.invalidateQueries({ queryKey: queryKeys.clients(client.trainerId) }),
  });
}

export function useUpdateClient() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: ({ clientId, changes }: { clientId: string; changes: ClientChanges }) =>
      ports.clients.updateClient(trainerId!, clientId, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.clients(trainerId!) }),
  });
}

export function useMemberships() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.memberships(trainerId ?? ""),
    queryFn: () => ports.memberships.listMemberships(trainerId!),
    enabled: trainerId !== undefined,
  });
}

export function useMembershipsWithClients(query: MembershipQuery) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.membershipsWithClients(trainerId ?? "", query),
    queryFn: () => ports.memberships.listMembershipsWithClients(trainerId!, query),
    enabled: trainerId !== undefined,
    // Al pasar de página o filtrar se sigue viendo la tabla anterior hasta que llega la nueva.
    placeholderData: keepPreviousData,
  });
}

export function useClientMemberships(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.clientMemberships(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.memberships.listClientMemberships(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

export function useSaveMembership() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (
      input:
        | { membershipId: string; changes: MembershipChanges }
        | { create: Omit<MembershipInput, "trainerId"> },
    ) =>
      "create" in input
        ? ports.memberships.createMembership({ ...input.create, trainerId: trainerId! })
        : ports.memberships.updateMembership(trainerId!, input.membershipId, input.changes),
    // El seguimiento de clientes también enseña la membresía vigente de cada uno.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.memberships(trainerId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clients(trainerId!) }),
      ]),
  });
}
