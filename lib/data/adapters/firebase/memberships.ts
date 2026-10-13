import {
  collection,
  getCountFromServer,
  limit,
  orderBy,
  query,
  runTransaction,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import type { MembershipPage, MembershipPort } from "@/lib/data/ports";
import {
  addCivilDays,
  clientSchema,
  compareMembershipsForList,
  EXPIRING_SOON_DAYS,
  isExpiringSoon,
  matchesMembershipFilter,
  membershipSchema,
  overlappingMembershipIds,
  type Membership,
  type MembershipStatusFilter,
} from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, listOwn, ref, txRequireOwn } from "./helpers";

const byStartDesc = <T extends { startDate: string }>(a: T, b: T) =>
  b.startDate.localeCompare(a.startDate);

/** `in` admite 30 valores como mucho: las consultas por varios clientes van en trozos. */
const IN_LIMIT = 30;

export function createMembershipPort(ctx: FirebaseContext): MembershipPort {
  const name = COLLECTIONS.memberships;

  const ownedBy = (trainerId: string, ...constraints: QueryConstraint[]) =>
    listOwn(ctx, name, membershipSchema, trainerId, ...constraints);

  // Cuenta de servidor de las membresías del entrenador con un filtro extra. No trae documentos.
  const countOf = async (trainerId: string, ...constraints: QueryConstraint[]) =>
    (
      await getCountFromServer(
        query(collection(ctx.db, name), where("trainerId", "==", trainerId), ...constraints),
      )
    ).data().count;

  // Todas las membresías de estos clientes, para el solape de la página.
  const membershipsOf = async (trainerId: string, clientIds: string[]) => {
    const found: Membership[] = [];
    for (let i = 0; i < clientIds.length; i += IN_LIMIT) {
      found.push(
        ...(await ownedBy(trainerId, where("clientId", "in", clientIds.slice(i, i + IN_LIMIT)))),
      );
    }
    return found;
  };

  return {
    listMembershipsWithClients: async (trainerId, q) => {
      const start = q.page * q.pageSize;
      const end = start + q.pageSize;
      const clients = await listOwn(ctx, COLLECTIONS.clients, clientSchema, trainerId);

      let counts: MembershipPage["counts"];
      let page: Membership[];
      if (q.clientId) {
        // El historial de un cliente son pocas filas: se trae entero y se ordena aquí.
        const mine = (await ownedBy(trainerId, where("clientId", "==", q.clientId))).sort(
          compareMembershipsForList,
        );
        const count = (filter: MembershipStatusFilter) =>
          mine.filter((m) => matchesMembershipFilter(m, filter, q.today)).length;
        counts = { all: count("all"), unpaid: count("unpaid"), expiring: count("expiring") };
        page = mine.filter((m) => matchesMembershipFilter(m, q.filter, q.today)).slice(start, end);
      } else {
        // Cartera entera. «Por vencer» no admite una consulta exacta de conteo (la fecha de inicio y la
        // de fin son dos rangos), así que se leen solo las que terminan en la ventana: son pocas.
        const ending = await ownedBy(
          trainerId,
          where("endDate", ">=", q.today),
          where("endDate", "<=", addCivilDays(q.today, EXPIRING_SOON_DAYS)),
        );
        const expiring = ending
          .filter((m) => isExpiringSoon(m, q.today))
          .sort(compareMembershipsForList);
        const [all, unpaid] = await Promise.all([
          countOf(trainerId),
          countOf(trainerId, where("paymentStatus", "==", "no_pagada")),
        ]);
        counts = { all, unpaid, expiring: expiring.length };

        if (q.filter === "expiring") {
          page = expiring.slice(start, end);
        } else {
          // Las más recientes hasta el final de la página; la página es lo que cae en [start, end).
          const cut = q.filter === "unpaid" ? [where("paymentStatus", "==", "no_pagada")] : [];
          const newest = await ownedBy(trainerId, ...cut, orderBy("startDate", "desc"), limit(end));
          page = newest.sort(compareMembershipsForList).slice(start, end);
        }
      }

      const clientById = new Map(clients.map((c) => [c.id, c]));
      const rows = page.flatMap((membership) => {
        const client = clientById.get(membership.clientId);
        if (!client) return [];
        const { id, firstName, lastName, status } = client;
        return [{ membership, client: { id, firstName, lastName, status } }];
      });
      // El solape se mira sobre todas las membresías de cada cliente de la página, esté o no en ella.
      const overlapping = overlappingMembershipIds(
        await membershipsOf(trainerId, [...new Set(rows.map((r) => r.membership.clientId))]),
      );
      return {
        rows,
        counts,
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
