import { runTransaction, where } from "firebase/firestore";
import type { MembershipPort } from "@/lib/data/ports";
import {
  clientSchema,
  matchesMembershipFilter,
  membershipSchema,
  overlappingMembershipIds,
  type MembershipStatusFilter,
} from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, listOwn, ref, txRequireOwn } from "./helpers";

const byStartDesc = <T extends { startDate: string }>(a: T, b: T) =>
  b.startDate.localeCompare(a.startDate);

export function createMembershipPort(ctx: FirebaseContext): MembershipPort {
  const name = COLLECTIONS.memberships;
  return {
    listMembershipsWithClients: async (trainerId, query) => {
      const clients = await listOwn(ctx, COLLECTIONS.clients, clientSchema, trainerId);
      // El solape es entre membresías de un mismo cliente: con un cliente elegido basta con las suyas.
      const owned = await listOwn(
        ctx,
        name,
        membershipSchema,
        trainerId,
        ...(query.clientId ? [where("clientId", "==", query.clientId)] : []),
      );
      const all = owned.flatMap((membership) => {
        const client = clients.find((c) => c.id === membership.clientId);
        if (!client) return [];
        const { id, firstName, lastName, status } = client;
        return [{ membership, client: { id, firstName, lastName, status } }];
      });
      const fullName = (r: (typeof all)[number]) => `${r.client.firstName} ${r.client.lastName}`;
      all.sort(
        (a, b) =>
          fullName(a).localeCompare(fullName(b), "es") ||
          b.membership.startDate.localeCompare(a.membership.startDate),
      );

      const count = (filter: MembershipStatusFilter) =>
        all.filter((r) => matchesMembershipFilter(r.membership, filter, query.today)).length;
      const matching = all.filter((r) =>
        matchesMembershipFilter(r.membership, query.filter, query.today),
      );
      const rows = matching.slice(query.page * query.pageSize, (query.page + 1) * query.pageSize);
      // El solape se calcula sobre todas las del cliente: la otra puede estar en otra página o filtrada.
      const overlapping = overlappingMembershipIds(owned);
      return {
        rows,
        counts: { all: count("all"), unpaid: count("unpaid"), expiring: count("expiring") },
        overlappingIds: rows.map((r) => r.membership.id).filter((id) => overlapping.has(id)),
      };
    },

    listMemberships: async (trainerId) =>
      (await listOwn(ctx, name, membershipSchema, trainerId)).sort(byStartDesc),

    listClientMemberships: async (trainerId, clientId) =>
      (
        await listOwn(ctx, name, membershipSchema, trainerId, where("clientId", "==", clientId))
      ).sort(byStartDesc),

    createMembership: (input) =>
      runTransaction(ctx.db, async (tx) => {
        // I1/I2: el cliente existe y es de este entrenador; si no, `not_found`.
        await txRequireOwn(
          tx,
          ref(ctx, COLLECTIONS.clients, input.clientId),
          clientSchema,
          input.trainerId,
          "Cliente",
        );
        const membership = membershipSchema.parse({
          ...input,
          id: ctx.newId(),
          createdAt: ctx.now(),
        });
        tx.set(ref(ctx, name, membership.id), membership);
        return membership;
      }),

    updateMembership: (trainerId, membershipId, changes) =>
      runTransaction(ctx.db, async (tx) => {
        const docRef = ref(ctx, name, membershipId);
        const { value: current } = await txRequireOwn(
          tx,
          docRef,
          membershipSchema,
          trainerId,
          "Membresía",
        );
        // La identidad no cambia nunca, aunque llegue en `changes`: ni de entrenador ni de cliente.
        const next = membershipSchema.parse({
          ...current,
          ...changes,
          id: current.id,
          trainerId: current.trainerId,
          clientId: current.clientId,
        });
        tx.set(docRef, next, { merge: true });
        return next;
      }),
  };
}
