import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MembershipType } from "@/lib/domain";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

/** Si el entrenador puede cobrar en línea (tarjeta 125). Sin `trainerId`, el de la sesión. */
export function useOnlinePaymentStatus(trainerId?: string) {
  const ports = usePorts();
  const sessionTrainerId = useTrainerId();
  const id = trainerId ?? sessionTrainerId;
  return useQuery({
    queryKey: queryKeys.onlinePayments(id ?? ""),
    queryFn: () => ports.onlinePayments.getStatus(id!),
    enabled: !!id,
  });
}

/** El entrenador conecta su cuenta de cobro: devuelve adónde llevarle. */
export function useStartPaymentConnection() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: () => ports.onlinePayments.startConnection(trainerId!),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.onlinePayments(trainerId!) }),
  });
}

/** El cliente empieza a pagar una tarifa: devuelve adónde llevarle (E5). */
export function useStartCheckout() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (type: MembershipType) => ports.onlinePayments.startCheckout(type),
    // Con la demo el pago se confirma en el acto: la membresía nueva ya está.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memberships"] }),
  });
}
