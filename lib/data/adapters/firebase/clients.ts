import { runTransaction, setDoc, where } from "firebase/firestore";
import { z } from "zod";
import type { ClientPort, ClientTrackingFilter, ClientTrackingRow } from "@/lib/data/ports";
import {
  clientSchema,
  idSchema,
  isoTimestampSchema,
  membershipSchema,
  membershipStanding,
  reviewStatusSchema,
  routineSchema,
} from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, listOwn, readOwn, ref, txRequireOwn } from "./helpers";

/**
 * Lo único que el seguimiento necesita de una revisión. No se parsea la revisión entera: es el
 * histórico que más crece, y aquí solo importan su estado, su semana y cuándo se envió.
 */
const reviewTrackingFieldsSchema = z.object({
  clientId: idSchema,
  weekNumber: z.number(),
  status: reviewStatusSchema,
  submittedAt: isoTimestampSchema.nullable(),
});

export function createClientPort(ctx: FirebaseContext): ClientPort {
  const name = COLLECTIONS.clients;
  return {
    listClients: (trainerId) => listOwn(ctx, name, clientSchema, trainerId),

    listClientsTracking: async (trainerId, query) => {
      const all = await listOwn(ctx, name, clientSchema, trainerId);
      const named = all.filter((c) => query.clientId === undefined || c.id === query.clientId);
      const counts: Record<ClientTrackingFilter, number> = {
        todos: named.length,
        invitado: named.filter((c) => c.status === "invitado").length,
        activo: named.filter((c) => c.status === "activo").length,
        dado_de_baja: named.filter((c) => c.status === "dado_de_baja").length,
      };

      // Revisión nueva primero y luego nombre: hace falta saber quién la tiene para ordenar toda
      // la cartera, y son las `enviada`, que son pocas. El resto solo se mira para la página.
      const sent = await listOwn(
        ctx,
        COLLECTIONS.reviews,
        reviewTrackingFieldsSchema,
        trainerId,
        where("status", "==", "enviada"),
      );
      const newReviewWeek = new Map<string, number>();
      for (const r of sent) newReviewWeek.set(r.clientId, r.weekNumber);

      const matching = named
        .filter((c) => query.filter === "todos" || c.status === query.filter)
        .sort(
          (a, b) =>
            Number(newReviewWeek.has(b.id)) - Number(newReviewWeek.has(a.id)) ||
            a.firstName.localeCompare(b.firstName, "es"),
        );
      const page = matching.slice(query.page * query.pageSize, (query.page + 1) * query.pageSize);

      const routines = await listOwn(
        ctx,
        COLLECTIONS.routines,
        routineSchema,
        trainerId,
        where("status", "==", "activo"),
      );
      const rows: ClientTrackingRow[] = await Promise.all(
        page.map(async (client) => {
          const [memberships, reviews] = await Promise.all([
            listOwn(
              ctx,
              COLLECTIONS.memberships,
              membershipSchema,
              trainerId,
              where("clientId", "==", client.id),
            ),
            listOwn(
              ctx,
              COLLECTIONS.reviews,
              reviewTrackingFieldsSchema,
              trainerId,
              where("clientId", "==", client.id),
            ),
          ]);
          // La última enviada, esté como esté hoy: los borradores no tienen `submittedAt`.
          let lastReviewAt: string | null = null;
          for (const r of reviews) {
            if (r.submittedAt !== null && (lastReviewAt === null || r.submittedAt > lastReviewAt)) {
              lastReviewAt = r.submittedAt;
            }
          }
          return {
            client,
            routineName: routines.find((r) => r.clientId === client.id)?.name ?? null,
            newReviewWeek: newReviewWeek.get(client.id) ?? null,
            lastReviewAt,
            membership: membershipStanding(memberships, query.today).current,
          };
        }),
      );
      return { rows, counts };
    },

    getClient: (trainerId, clientId) => readOwn(ctx, name, clientSchema, trainerId, clientId),

    // Un cliente nace siempre `invitado` (§7): pasar a `activo` es entrar con la invitación.
    createClient: async (input) => {
      const client = clientSchema.parse({
        ...input,
        status: "invitado",
        id: ctx.newId(),
        createdAt: ctx.now(),
      });
      await setDoc(ref(ctx, name, client.id), client);
      return client;
    },

    updateClient: (trainerId, clientId, changes) =>
      runTransaction(ctx.db, async (tx) => {
        const docRef = ref(ctx, name, clientId);
        const { value: current } = await txRequireOwn(
          tx,
          docRef,
          clientSchema,
          trainerId,
          "Cliente",
        );
        // La identidad no cambia nunca, lleguen o no en `changes`.
        const next = clientSchema.parse({ ...current, ...changes, trainerId, id: clientId });
        tx.set(docRef, next, { merge: true });
        return next;
      }),
  };
}
