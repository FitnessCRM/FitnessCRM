"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReviewDraftChanges } from "@/lib/data/ports";
import type { Pose, ReviewFeedback } from "@/lib/domain";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";
import { useTrainerId } from "./use-session";

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

/** Revisiones `enviada` de toda la cartera ("Revisiones recibidas"). */
export function useSubmittedReviews() {
  const ports = usePorts();
  const trainerId = useTrainerId();
  return useQuery({
    queryKey: queryKeys.submittedReviews(trainerId ?? ""),
    queryFn: () => ports.reviews.listSubmittedReviews(trainerId!),
    enabled: trainerId !== undefined,
  });
}

type ReviewMutation =
  | { open: { clientId: string } }
  | { reviewId: string; draft: ReviewDraftChanges }
  | { reviewId: string; media: { pose: Pose; url: string } }
  | { reviewId: string; submit: true }
  | { reviewId: string; markViewed: true }
  | { reviewId: string; feedback: ReviewFeedback };

/** Todas las escrituras sobre revisiones; invalida cualquier consulta de revisiones del entrenador. */
export function useReviewMutation() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const trainerId = useTrainerId();
  return useMutation({
    mutationFn: (input: ReviewMutation) => {
      const r = ports.reviews;
      if ("open" in input) return r.openCurrentReview(trainerId!, input.open.clientId);
      if ("draft" in input) return r.updateReviewDraft(trainerId!, input.reviewId, input.draft);
      if ("media" in input)
        return r.attachReviewMedia(trainerId!, input.reviewId, input.media.pose, input.media.url);
      if ("submit" in input) return r.submitReview(trainerId!, input.reviewId);
      if ("markViewed" in input) return r.markReviewViewed(trainerId!, input.reviewId);
      return r.sendReviewFeedback(trainerId!, input.reviewId, input.feedback);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reviews(trainerId!) }),
  });
}
