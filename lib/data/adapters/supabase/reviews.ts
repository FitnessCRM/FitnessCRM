import type { ReviewPort, ReviewTrackingFilter } from "@/lib/data/ports";
import {
  weekNumberOrNull,
  type Pose,
  type Review,
  type ReviewDraft,
  type ReviewFeedback,
} from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise } from "./errors";
import { CLIENT_COLUMNS, clientFromRow, type ClientRow } from "./rows";
import { REVIEW_SELECT, reviewFromRow, type ReviewRow } from "./review-rows";
import { readClient, timeZoneOf } from "./queries";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Las revisiones. Las escrituras del cliente y del entrenador van por RPC (migración plan_writes y
 * rpc.sql): cada una toca varias filas y comprueba al que llama. Aquí se lee, y tras cada RPC se
 * relee la revisión entera, que es lo que devuelve el puerto.
 */
export function createReviewPort(client: SupabaseClient): ReviewPort {
  const readReview = async (trainerId: string, reviewId: string): Promise<Review | null> => {
    const { data, error } = await client
      .from("reviews")
      .select(REVIEW_SELECT)
      .eq("trainer_id", trainerId)
      .eq("id", reviewId)
      .maybeSingle();
    raise(error);
    return data ? reviewFromRow(data as unknown as ReviewRow) : null;
  };

  const requireReview = async (trainerId: string, reviewId: string): Promise<Review> => {
    const review = await readReview(trainerId, reviewId);
    if (!review) throw notFoundError("Revisión");
    return review;
  };

  /** La revisión de una semana concreta del cliente, o `null` si esa semana no tiene. */
  const readReviewOfWeek = async (trainerId: string, clientId: string, week: number) => {
    const { data, error } = await client
      .from("reviews")
      .select(REVIEW_SELECT)
      .eq("trainer_id", trainerId)
      .eq("client_id", clientId)
      .eq("week_number", week)
      .maybeSingle();
    raise(error);
    return data ? reviewFromRow(data as unknown as ReviewRow) : null;
  };

  return {
    listClientReviews: async (trainerId, clientId) => {
      const { data, error } = await client
        .from("reviews")
        .select(REVIEW_SELECT)
        .eq("trainer_id", trainerId)
        .eq("client_id", clientId)
        .order("week_number", { ascending: false });
      raise(error);
      return ((data ?? []) as unknown as ReviewRow[]).map(reviewFromRow);
    },

    getReview: readReview,

    // La página y los contadores salen de una función de servidor (migración reviews_and_logs); las
    // revisiones de la página se leen después, en su orden.
    listReviewsTracking: async (trainerId, query) => {
      const { data, error } = await client.rpc("list_reviews_tracking", {
        p_trainer_id: trainerId,
        p_filter: query.filter,
        p_search: query.search,
        p_page: query.page,
        p_page_size: query.pageSize,
      });
      raise(error);
      const { ids, counts } = data as {
        ids: string[];
        counts: Record<ReviewTrackingFilter, number>;
      };
      if (ids.length === 0) return { rows: [], counts };

      const { data: rows, error: rowsError } = await client
        .from("reviews")
        .select(`${REVIEW_SELECT}, clients (${CLIENT_COLUMNS})`)
        .eq("trainer_id", trainerId)
        .in("id", ids);
      raise(rowsError);
      const page = ((rows ?? []) as unknown as (ReviewRow & { clients: ClientRow })[]).map(
        (row) => ({ review: reviewFromRow(row), client: clientFromRow(row.clients) }),
      );
      return {
        rows: page.sort((a, b) => ids.indexOf(a.review.id) - ids.indexOf(b.review.id)),
        counts,
      };
    },

    getReviewStats: async (trainerId) => {
      const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();
      const [unviewed, thisWeek] = await Promise.all([
        client
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("trainer_id", trainerId)
          .eq("status", "enviada"),
        client
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("trainer_id", trainerId)
          .gte("submitted_at", weekAgo),
      ]);
      raise(unviewed.error);
      raise(thisWeek.error);
      return { unviewed: unviewed.count ?? 0, thisWeek: thisWeek.count ?? 0 };
    },

    getCurrentReview: async (trainerId, clientId) => {
      const { startDate } = await readClient(client, trainerId, clientId);
      // Antes del alta no hay semana, así que tampoco revisión de esta semana (§8).
      const week = weekNumberOrNull(startDate, new Date(), await timeZoneOf(client, trainerId));
      if (week === null) return null;
      return readReviewOfWeek(trainerId, clientId, week);
    },

    // La función abre la revisión del cliente que llama: su semana y su ventana, y el catálogo activo
    // como requisitos. Si ya existía, la devuelve.
    openCurrentReview: async (trainerId) => {
      const { data, error } = await client.rpc("open_current_review");
      raise(error);
      return requireReview(trainerId, data as string);
    },

    updateReviewDraft: async (trainerId, reviewId, changes: ReviewDraft) => {
      // Las claves que no vienen no se tocan: `undefined` no llega al JSON, y la función distingue
      // «no viene» de «viene vacío».
      const { error } = await client.rpc("save_review_draft", {
        p_review_id: reviewId,
        p_draft: changes,
      });
      raise(error);
      return requireReview(trainerId, reviewId);
    },

    // La URL es la ruta de la foto en Storage. La función devuelve la ruta que sustituye, por si hay
    // que borrar ese objeto; de momento no se borra aquí.
    attachReviewMedia: async (trainerId, reviewId, pose: Pose, url) => {
      const { error } = await client.rpc("attach_review_media", {
        p_review_id: reviewId,
        p_pose: pose,
        p_storage_path: url,
      });
      raise(error);
      return requireReview(trainerId, reviewId);
    },

    submitReview: async (trainerId, reviewId) => {
      const { error } = await client.rpc("submit_review", { p_review_id: reviewId });
      raise(error);
      return requireReview(trainerId, reviewId);
    },

    markReviewViewed: async (trainerId, reviewId) => {
      const { error } = await client.rpc("mark_review_viewed", { p_review_id: reviewId });
      raise(error);
      return requireReview(trainerId, reviewId);
    },

    sendReviewFeedback: async (trainerId, reviewId, feedback: ReviewFeedback) => {
      const { error } = await client.rpc("send_review_feedback", {
        p_review_id: reviewId,
        p_video_url: feedback.videoUrl,
        p_note: feedback.note,
      });
      raise(error);
      return requireReview(trainerId, reviewId);
    },
  };
}
