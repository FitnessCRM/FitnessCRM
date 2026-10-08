"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mergeFoodLibrary, type FoodDraft, type LibraryFood } from "@/lib/domain";
import {
  archiveFood,
  isFoodCatalogUnavailable,
  listOwnFoodsForLibrary,
  retryPendingFoodsOnce,
  saveFood,
  type FoodWriteResult,
} from "./food-sync";
import { useOnlineStatus } from "./use-online-status";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

/**
 * Cómo está el catálogo común para esta lista. `null` con «solo los míos»: no se consulta.
 * - `loading`: aún no ha respondido.
 * - `available`: la lista lleva también los alimentos de otros.
 * - `unavailable`: no respondió; la lista lleva solo los propios (§12). No es un error de pantalla.
 */
export type FoodCatalogStatus = "loading" | "available" | "unavailable" | null;

/**
 * La biblioteca de alimentos del entrenador: su copia propia unida al catálogo común (§4), cada uno
 * marcado como propio o de otro. Son dos consultas separadas, y un catálogo caído no tumba la lista.
 * La carga y el error de la lista son los de la copia propia. Al montar y al volver la red reintenta
 * publicar lo pendiente.
 */
export function useFoods(options: { onlyMine?: boolean } = {}) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  const onlyMine = options.onlyMine ?? false;

  const own = useQuery({
    queryKey: queryKeys.ownFoods(trainerId ?? ""),
    // Con los archivados pendientes, para que la unión no los tome por ajenos; luego no salen.
    queryFn: () => listOwnFoodsForLibrary(ports, trainerId!),
    enabled: trainerId !== undefined,
  });

  const catalog = useQuery({
    queryKey: queryKeys.foodCatalog(trainerId ?? ""),
    // Solo la primera página, hasta que la búsqueda paginada llegue a los hooks.
    queryFn: async () => (await ports.foodCatalog.searchCatalogFoods({})).foods,
    enabled: trainerId !== undefined && !onlyMine,
    // «No disponible» no se reintenta: la pantalla tiene que llegar enseguida a los propios solos.
    retry: (failureCount, error) => !isFoodCatalogUnavailable(error) && failureCount < 1,
  });

  usePendingFoodsRetry();

  const catalogStatus: FoodCatalogStatus = onlyMine
    ? null
    : catalog.isError
      ? "unavailable"
      : catalog.isSuccess
        ? "available"
        : "loading";

  const foods: LibraryFood[] | undefined = own.data
    ? mergeFoodLibrary(own.data, catalogStatus === "available" ? (catalog.data ?? []) : [])
    : undefined;

  return {
    foods,
    isPending: own.isPending,
    isError: own.isError,
    error: own.error,
    refetch: own.refetch,
    catalog: catalogStatus,
  };
}

/**
 * Reintenta publicar los alimentos pendientes una vez al montar y otra cada vez que vuelve la red.
 * Sin temporizador, y sin dos a la vez aunque lo monten varias pantallas (`retryPendingFoodsOnce`).
 */
function usePendingFoodsRetry() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  const online = useOnlineStatus();

  useEffect(() => {
    if (trainerId === undefined || !online) return;
    void retryPendingFoodsOnce(ports, trainerId)
      .then((result) => {
        if (result.published === 0) return;
        void queryClient.invalidateQueries({ queryKey: queryKeys.ownFoods(trainerId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.foodCatalog(trainerId) });
      })
      // Leer lo pendiente puede fallar sin red: lo intentará el próximo reintento.
      .catch(() => {});
  }, [ports, queryClient, trainerId, online]);
}

/** Tras una escritura: la copia propia siempre; el catálogo, solo si se publicó algo. */
function useInvalidateFoods() {
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return (result: FoodWriteResult) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ownFoods(trainerId!) });
    if (result.published) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.foodCatalog(trainerId!) });
    }
  };
}

/**
 * Crea (sin `foodId`) o edita un alimento propio y lo intenta publicar. Que el catálogo no responda
 * no hace fallar la mutación: el alimento queda `pendiente` (`result.published === false`).
 */
export function useSaveFood() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  const invalidate = useInvalidateFoods();
  return useMutation({
    mutationFn: (input: { foodId?: string; draft: FoodDraft }) =>
      saveFood(ports, trainerId!, input),
    onSuccess: invalidate,
  });
}

/** «Eliminar» un alimento propio: lo archiva (I13) y publica el archivado. Ningún menú cambia (I29). */
export function useArchiveFood() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  const invalidate = useInvalidateFoods();
  return useMutation({
    mutationFn: (foodId: string) => archiveFood(ports, trainerId!, foodId),
    onSuccess: invalidate,
  });
}
