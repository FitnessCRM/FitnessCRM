"use client";

import { useEffect } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FoodDraft, LibraryFood } from "@/lib/domain";
import {
  buildFoodLibrary,
  foodCatalogStatus,
  nextCatalogCursor,
  shouldRetryCatalogSearch,
  type FoodCatalogStatus,
} from "./food-library";
import {
  archiveFood,
  listOwnFoodsForLibrary,
  retryPendingFoodsOnce,
  saveFood,
  type FoodWriteResult,
} from "./food-sync";
import { useOnlineStatus } from "./use-online-status";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

export type { FoodCatalogStatus } from "./food-library";

/** «Ver más» del catálogo común: la página siguiente solo se pide cuando se llama a `loadMore`. */
export interface FoodCatalogMore {
  /** Si el catálogo dio cursor para otra página. No se deduce del tamaño de la página. */
  hasMore: boolean;
  /** Pide la página siguiente, una. Sin más páginas o con una ya en camino, no hace nada. */
  loadMore: () => void;
  isLoadingMore: boolean;
  /** El fallo de la última página pedida, o `null`. Lo ya cargado se sigue enseñando. */
  error: unknown;
}

/**
 * La biblioteca de alimentos del entrenador para un texto (§4): los suyos que coinciden y lo que
 * devuelve la búsqueda en el catálogo común, cada uno con su origen (tuyo, de otro, sembrado).
 *
 * Son dos consultas separadas. La copia propia se lista entera, con los archivados pendientes, y se
 * filtra por el texto aquí. El catálogo se busca por páginas con el texto en la clave: la primera al
 * buscar, y la siguiente solo con `catalogMore.loadMore()`. Al invalidarse tras publicar, TanStack
 * vuelve a pedir las páginas ya cargadas y ninguna más. Un catálogo caído no tumba la lista. La
 * carga y el error de la lista son los de la copia propia. Sin espera entre teclas: la pone la
 * pantalla. Al montar y al volver la red reintenta publicar lo pendiente.
 */
export function useFoods(options: { text?: string; onlyMine?: boolean } = {}) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  const onlyMine = options.onlyMine ?? false;
  const text = (options.text ?? "").trim();

  const own = useQuery({
    queryKey: queryKeys.ownFoods(trainerId ?? ""),
    // Con los archivados pendientes, para que la unión no los tome por ajenos; luego no salen.
    queryFn: () => listOwnFoodsForLibrary(ports, trainerId!),
    enabled: trainerId !== undefined,
  });

  const searchEnabled = trainerId !== undefined && !onlyMine;
  const catalog = useInfiniteQuery({
    queryKey: queryKeys.foodCatalogSearch(trainerId ?? "", text),
    queryFn: ({ pageParam }) => ports.foodCatalog.searchCatalogFoods({ text, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: nextCatalogCursor,
    enabled: searchEnabled,
    retry: shouldRetryCatalogSearch,
  });

  usePendingFoodsRetry();

  const pages = searchEnabled ? (catalog.data?.pages ?? []) : [];
  const catalogStatus: FoodCatalogStatus = foodCatalogStatus({
    enabled: searchEnabled,
    hasPages: pages.length > 0,
    error: catalog.error,
  });

  const foods: LibraryFood[] | undefined = own.data
    ? buildFoodLibrary(own.data, catalogStatus === "available" ? pages : [], text)
    : undefined;

  const hasMore = catalogStatus === "available" && catalog.hasNextPage;
  const catalogMore: FoodCatalogMore = {
    hasMore,
    loadMore: () => {
      if (hasMore && !catalog.isFetchingNextPage) void catalog.fetchNextPage();
    },
    isLoadingMore: catalog.isFetchingNextPage,
    error: catalog.isFetchNextPageError ? catalog.error : null,
  };

  return {
    foods,
    isPending: own.isPending,
    isError: own.isError,
    error: own.error,
    refetch: own.refetch,
    catalog: catalogStatus,
    catalogMore,
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
