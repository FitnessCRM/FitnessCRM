import type { ClientPort, MembershipPort, SessionPort, TrainerPort } from "@/lib/data/ports";
import { clientSchema, membershipSchema } from "@/lib/domain";
import { findOwn, own, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createSessionPort(ctx: MockContext): SessionPort {
  return {
    getSession: async () => ctx.reply(ctx.state.session),
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
