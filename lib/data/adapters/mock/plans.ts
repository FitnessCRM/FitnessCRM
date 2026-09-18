import type { MacroTargetsPort, MenuPort, RoutinePort } from "@/lib/data/ports";
import { DomainError, macroTargetsSchema, menuSchema, routineSchema } from "@/lib/domain";
import { findOwn, own, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createRoutinePort(ctx: MockContext): RoutinePort {
  return {
    getActiveRoutine: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.routines, trainerId).find(
          (r) => r.clientId === clientId && r.status === "activo",
        ) ?? null,
      ),
    listRoutines: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.routines, trainerId)
          .filter((r) => r.clientId === clientId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    createRoutine: async (trainerId, clientId, body) => {
      const now = ctx.now();
      const routine = routineSchema.parse({
        ...body,
        id: ctx.newId(),
        trainerId,
        clientId,
        status: "borrador",
        sourceTemplateName: null,
        createdAt: now,
        updatedAt: now,
      });
      ctx.state.routines.push(routine);
      return ctx.reply(routine);
    },
    updateRoutine: async (trainerId, routineId, body) => {
      const current = findOwn(ctx.state.routines, trainerId, routineId, "Rutina");
      const next = routineSchema.parse({ ...current, ...body, updatedAt: ctx.now() });
      return ctx.reply(replaceById(ctx.state.routines, next));
    },
    activateRoutine: async (trainerId, routineId) => {
      const target = findOwn(ctx.state.routines, trainerId, routineId, "Rutina");
      if (target.status === "archivado") {
        throw new DomainError("routine.archived", "Una rutina archivada no se reactiva");
      }
      const now = ctx.now();
      // I4: como máximo una rutina activa por cliente.
      for (const r of ctx.state.routines) {
        if (r.clientId === target.clientId && r.id !== routineId && r.status === "activo") {
          r.status = "archivado";
          r.updatedAt = now;
        }
      }
      target.status = "activo";
      target.updatedAt = now;
      return ctx.reply(target);
    },
  };
}

export function createMacroTargetsPort(ctx: MockContext): MacroTargetsPort {
  return {
    listMacroTargets: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.macroTargets, trainerId).filter(
          (m) => m.clientId === clientId && m.status === "activo",
        ),
      ),
    setMacroTargets: async (trainerId, clientId, dayType, macros) => {
      const now = ctx.now();
      // I4: un juego de macros activo por tipo de día.
      for (const m of ctx.state.macroTargets) {
        if (
          m.trainerId === trainerId &&
          m.clientId === clientId &&
          m.dayType === dayType &&
          m.status === "activo"
        ) {
          m.status = "archivado";
          m.updatedAt = now;
        }
      }
      const created = macroTargetsSchema.parse({
        id: ctx.newId(),
        trainerId,
        clientId,
        dayType,
        macros,
        status: "activo",
        createdAt: now,
        updatedAt: now,
      });
      ctx.state.macroTargets.push(created);
      return ctx.reply(created);
    },
  };
}

export function createMenuPort(ctx: MockContext): MenuPort {
  return {
    listActiveMenus: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.menus, trainerId).filter(
          (m) => m.clientId === clientId && m.status === "activo",
        ),
      ),
    createMenu: async (trainerId, clientId, body) => {
      const now = ctx.now();
      const menu = menuSchema.parse({
        ...body,
        id: ctx.newId(),
        trainerId,
        clientId,
        status: "borrador",
        sourceTemplateName: null,
        createdAt: now,
        updatedAt: now,
      });
      ctx.state.menus.push(menu);
      return ctx.reply(menu);
    },
    updateMenu: async (trainerId, menuId, body) => {
      const current = findOwn(ctx.state.menus, trainerId, menuId, "Menú");
      const next = menuSchema.parse({ ...current, ...body, updatedAt: ctx.now() });
      return ctx.reply(replaceById(ctx.state.menus, next));
    },
    activateMenus: async (trainerId, clientId, dayType) => {
      const now = ctx.now();
      const mine = own(ctx.state.menus, trainerId).filter(
        (m) => m.clientId === clientId && m.dayType === dayType,
      );
      const drafts = mine.filter((m) => m.status === "borrador");
      if (drafts.length === 0) {
        throw new DomainError("menu.no_drafts", "No hay menús en borrador para ese tipo de día");
      }
      for (const m of mine) {
        if (m.status === "activo") {
          m.status = "archivado";
          m.updatedAt = now;
        }
      }
      for (const d of drafts) {
        d.status = "activo";
        d.updatedAt = now;
      }
      return ctx.reply(drafts);
    },
    archiveMenu: async (trainerId, menuId) => {
      const menu = findOwn(ctx.state.menus, trainerId, menuId, "Menú");
      menu.status = "archivado";
      menu.updatedAt = ctx.now();
      return ctx.reply(undefined);
    },
  };
}
