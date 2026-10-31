"use client";

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  ReviewDraftChanges,
  ReviewPhotoContentType,
  ReviewTrackingQuery,
} from "@/lib/data/ports";
import { POSES, type Pose, type ReviewFeedback, type ReviewMedia } from "@/lib/domain";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

/**
 * Lo que la pantalla sabe de una foto: aún no hay, cargando su URL, lista para pintar, o ya no
 * existe en Storage (§9.4). Una URL que caduca se pide de nuevo; nunca se guarda en el dispositivo.
 */
export type PhotoState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "unavailable" };

/** La URL firmada dura 10 minutos: se pide otra antes de que caduque. */
const PHOTO_URL_STALE_MS = 5 * 60 * 1000;

export function useClientReviews(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.clientReviews(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.reviews.listClientReviews(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

export function useReview(reviewId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.review(trainerId ?? "", reviewId ?? ""),
    queryFn: () => ports.reviews.getReview(trainerId!, reviewId!),
    enabled: trainerId !== undefined && reviewId !== undefined,
  });
}

/**
 * La revisión de la semana actual del cliente, o `null` si aún no ha empezado. Solo lee:
 * abrirla (persistir y congelar requisitos) es la mutación `open`, en la primera edición real.
 */
export function useCurrentReview(clientId: string | undefined) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.currentReview(trainerId ?? "", clientId ?? ""),
    queryFn: () => ports.reviews.getCurrentReview(trainerId!, clientId!),
    enabled: trainerId !== undefined && clientId !== undefined,
  });
}

/** Todas las revisiones recibidas con su cliente, paginadas en servidor (`/reviews`). */
export function useReviewsTracking(query: ReviewTrackingQuery) {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.reviewsTracking(trainerId ?? "", query),
    queryFn: () => ports.reviews.listReviewsTracking(trainerId!, query),
    enabled: trainerId !== undefined,
    placeholderData: keepPreviousData,
  });
}

/** Contadores de revisiones de toda la cartera para el panel de control. */
export function useReviewStats() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: [...queryKeys.reviews(trainerId ?? ""), "stats"],
    queryFn: () => ports.reviews.getReviewStats(trainerId!),
    enabled: trainerId !== undefined,
  });
}

/** Una foto recién elegida: se sube a la carpeta de la revisión y después se registra en su pose. */
export interface ReviewPhotoInput {
  clientId: string;
  pose: Pose;
  file: Blob;
  contentType: ReviewPhotoContentType;
}

type ReviewMutation =
  | { open: { clientId: string } }
  | { reviewId: string; draft: ReviewDraftChanges }
  | { reviewId: string; photo: ReviewPhotoInput }
  | { reviewId: string; submit: true }
  | { reviewId: string; markViewed: true }
  | { reviewId: string; feedback: ReviewFeedback };

/**
 * El estado de cada pose de una revisión. Una pose sin foto queda `empty`; las demás piden su URL
 * firmada, que se cachea sin pasar por disco.
 */
export function useReviewPhotos(media: readonly ReviewMedia[]): Record<Pose, PhotoState> {
  const ports = usePorts();
  const results = useQueries({
    queries: media.map((m) => ({
      queryKey: queryKeys.reviewPhotoUrl(m.url),
      queryFn: () => ports.reviews.reviewPhotoUrl(m.url),
      staleTime: PHOTO_URL_STALE_MS,
    })),
  });
  const states = Object.fromEntries(POSES.map((pose) => [pose, { status: "empty" }])) as Record<
    Pose,
    PhotoState
  >;
  media.forEach((m, i) => {
    const result = results[i]!;
    if (result.isPending) states[m.pose] = { status: "loading" };
    else if (result.data) states[m.pose] = { status: "ready", url: result.data };
    else states[m.pose] = { status: "unavailable" };
  });
  return states;
}

/**
 * Todas las escrituras sobre revisiones; invalida cualquier consulta de revisiones del entrenador.
 * Enviar, marcar vista y mandar feedback cambian además la «Revisión nueva» del seguimiento.
 */
export function useReviewMutation() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: async (input: ReviewMutation) => {
      const r = ports.reviews;
      if ("open" in input) return r.openCurrentReview(trainerId!, input.open.clientId);
      if ("draft" in input) return r.updateReviewDraft(trainerId!, input.reviewId, input.draft);
      if ("photo" in input) {
        // La subida va antes que el registro: si falla, la revisión no apunta a una foto que no existe.
        const { clientId, pose, file, contentType } = input.photo;
        const storagePath = await r.uploadReviewPhoto({
          trainerId: trainerId!,
          clientId,
          reviewId: input.reviewId,
          file,
          contentType,
        });
        return r.attachReviewMedia(trainerId!, input.reviewId, pose, storagePath);
      }
      if ("submit" in input) return r.submitReview(trainerId!, input.reviewId);
      if ("markViewed" in input) return r.markReviewViewed(trainerId!, input.reviewId);
      return r.sendReviewFeedback(trainerId!, input.reviewId, input.feedback);
    },
    onSuccess: (_, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews(trainerId!) });
      if ("submit" in input || "markViewed" in input || "feedback" in input) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.clientsTrackingAll(trainerId!) });
      }
    },
  });
}
