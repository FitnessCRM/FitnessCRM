import type { ClientPort, MembershipPort, SessionPort, TrainerPort } from "@/lib/data/ports";
import {
  clientSchema,
  matchesMembershipFilter,
  membershipSchema,
  overlappingMembershipIds,
  type MembershipStatusFilter,
} from "@/lib/domain";
import { findOwn, own, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createSessionPort(ctx: MockContext): SessionPort {
  return {
    getSession: async () => ctx.reply(ctx.state.session),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    login: async (email, _password) => {
      const trainer = ctx.state.trainers.find((t) => t.email === email);
      if (!trainer) throw new Error("Email no encontrado");

      // En mock, cualquier password sirve; con Firebase se validaría realmente
      ctx.state.session = { trainerId: trainer.id, clientId: null };
      return ctx.reply(ctx.state.session);
    },
    logout: async () => {
      ctx.state.session = { trainerId: "", clientId: null };
    },
  };
}

export function createTrainerPort(ctx: MockContext): TrainerPort {
  return {
    getTrainer: async (trainerId) =>
      ctx.reply(ctx.state.trainers.find((t) => t.id === trainerId) ?? null),
    updateTrainer: async (trainerId, changes) => {
      const current = ctx.state.trainers.find((t) => t.id === trainerId);
      if (!current) throw new Error(`Trainer ${trainerId} no existe`);
      return ctx.reply(replaceById(ctx.state.trainers, { ...current, ...changes }));
    },
  };
}

export function createClientPort(ctx: MockContext): ClientPort {
  return {
    listClients: async (trainerId) => ctx.reply(own(ctx.state.clients, trainerId)),
    getClient: async (trainerId, clientId) =>
      ctx.reply(
        ctx.state.clients.find((c) => c.id === clientId && c.trainerId === trainerId) ?? null,
      ),
    createClient: async (input) => {
      const client = clientSchema.parse({ ...input, id: ctx.newId(), createdAt: ctx.now() });
      ctx.state.clients.push(client);
      return ctx.reply(client);
    },
    updateClient: async (trainerId, clientId, changes) => {
      const current = findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      const next = clientSchema.parse({ ...current, ...changes, trainerId, id: clientId });
      return ctx.reply(replaceById(ctx.state.clients, next));
    },
  };
}

const byStartDesc = <T extends { startDate: string }>(a: T, b: T) =>
  b.startDate.localeCompare(a.startDate);

export function createMembershipPort(ctx: MockContext): MembershipPort {
  return {
    listMembershipsWithClients: async (trainerId, query) => {
      const clients = own(ctx.state.clients, trainerId);
      const owned = own(ctx.state.memberships, trainerId);
      const all = owned.flatMap((membership) => {
        const client = clients.find((c) => c.id === membership.clientId);
        if (!client) return [];
        const { id, firstName, lastName, status } = client;
        return [{ membership, client: { id, firstName, lastName, status } }];
      });
      const name = (r: (typeof all)[number]) => `${r.client.firstName} ${r.client.lastName}`;
      all.sort(
        (a, b) =>
          name(a).localeCompare(name(b), "es") ||
          b.membership.startDate.localeCompare(a.membership.startDate),
      );

      const ofClient = all.filter((r) => !query.clientId || r.client.id === query.clientId);
      const count = (filter: MembershipStatusFilter) =>
        ofClient.filter((r) => matchesMembershipFilter(r.membership, filter, query.today)).length;
      const matching = ofClient.filter((r) =>
        matchesMembershipFilter(r.membership, query.filter, query.today),
      );
      const rows = matching.slice(query.page * query.pageSize, (query.page + 1) * query.pageSize);
      // El solape se calcula sobre todas las suyas: la otra puede estar en otra página o filtrada.
      const overlapping = overlappingMembershipIds(owned);
      return ctx.reply({
        rows,
        counts: { all: count("all"), unpaid: count("unpaid"), expiring: count("expiring") },
        overlappingIds: rows.map((r) => r.membership.id).filter((id) => overlapping.has(id)),
      });
    },
    listMemberships: async (trainerId) =>
      ctx.reply(own(ctx.state.memberships, trainerId).sort(byStartDesc)),
    listClientMemberships: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.memberships, trainerId)
          .filter((m) => m.clientId === clientId)
          .sort(byStartDesc),
      ),
    createMembership: async (input) => {
      const membership = membershipSchema.parse({
        ...input,
        id: ctx.newId(),
        createdAt: ctx.now(),
      });
      ctx.state.memberships.push(membership);
      return ctx.reply(membership);
    },
    updateMembership: async (trainerId, membershipId, changes) => {
      const current = findOwn(ctx.state.memberships, trainerId, membershipId, "Membresía");
      const next = membershipSchema.parse({ ...current, ...changes });
      return ctx.reply(replaceById(ctx.state.memberships, next));
    },
  };
}
