import type { MacroTargetsPort, MenuPort, RoutinePort } from "@/lib/data/ports";
import {
  DomainError,
  assertExercisesInLibrary,
  macroTargetsSchema,
  menuBodySchema,
  menuSchema,
  routineBodySchema,
  routineSchema,
  type RoutineBody,
} from "@/lib/domain";
import { findOwn, own, ownClient, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createRoutinePort(ctx: MockContext): RoutinePort {
  /** El cuerpo, validado y sin campos de identidad, con solo ejercicios de la biblioteca (I3). */
  const checkedBody = (trainerId: string, body: RoutineBody) => {
    const parsed = routineBodySchema.parse(body);
    assertExercisesInLibrary(parsed, own(ctx.state.exercises, trainerId));
    return parsed;
  };
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
      ownClient(ctx.state, trainerId, clientId);
      const now = ctx.now();
      const routine = routineSchema.parse({
        ...checkedBody(trainerId, body),
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
      // §7: lo activo no se edita en sitio; solo los borradores.
      if (current.status !== "borrador") {
        throw new DomainError("routine.not_draft", "Solo se edita en sitio un borrador");
      }
      const next = routineSchema.parse({
        ...current,
        ...checkedBody(trainerId, body),
        updatedAt: ctx.now(),
      });
      return ctx.reply(replaceById(ctx.state.routines, next));
    },
    reviseRoutine: async (trainerId, routineId, body) => {
      const current = findOwn(ctx.state.routines, trainerId, routineId, "Rutina");
      if (current.status !== "activo") {
        throw new DomainError("routine.not_active", "Solo se versiona la rutina activa");
      }
      const now = ctx.now();
      // Versión nueva en borrador: misma plantilla de origen, ids de días y líneas tal como llegan.
      const draft = routineSchema.parse({
        ...checkedBody(trainerId, body),
        id: ctx.newId(),
        trainerId,
        clientId: current.clientId,
        status: "borrador",
        sourceTemplateName: current.sourceTemplateName,
        createdAt: now,
        updatedAt: now,
      });
      ctx.state.routines.push(draft);
      return ctx.reply(draft);
    },
    activateRoutine: async (trainerId, routineId) => {
      const target = findOwn(ctx.state.routines, trainerId, routineId, "Rutina");
      if (target.status === "archivado") {
        throw new DomainError("routine.archived", "Una rutina archivada no se reactiva");
      }
      const now = ctx.now();
      // I4: como máximo una rutina activa por cliente. Solo las de este entrenador (I1).
      for (const r of own(ctx.state.routines, trainerId)) {
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
      ownClient(ctx.state, trainerId, clientId);
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
    listMenus: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.menus, trainerId).filter(
          (m) => m.clientId === clientId && m.status !== "archivado",
        ),
      ),
    listArchivedMenus: async (trainerId, clientId) =>
      ctx.reply(
        own(ctx.state.menus, trainerId).filter(
          (m) => m.clientId === clientId && m.status === "archivado",
        ),
      ),
    createMenu: async (trainerId, clientId, body) => {
      ownClient(ctx.state, trainerId, clientId);
      const now = ctx.now();
      const menu = menuSchema.parse({
        ...menuBodySchema.parse(body),
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
      // §7: lo activo no se edita en sitio; solo los borradores.
      if (current.status !== "borrador") {
        throw new DomainError("menu.not_draft", "Solo se edita en sitio un borrador");
      }
      const next = menuSchema.parse({
        ...current,
        ...menuBodySchema.parse(body),
        updatedAt: ctx.now(),
      });
      return ctx.reply(replaceById(ctx.state.menus, next));
    },
    reviseMenu: async (trainerId, menuId, body) => {
      const current = findOwn(ctx.state.menus, trainerId, menuId, "Menú");
      if (current.status !== "activo") {
        throw new DomainError("menu.not_active", "Solo se versiona un menú activo");
      }
      const now = ctx.now();
      const draft = menuSchema.parse({
        ...menuBodySchema.parse(body),
        id: ctx.newId(),
        trainerId,
        clientId: current.clientId,
        status: "borrador",
        sourceTemplateName: current.sourceTemplateName,
        createdAt: now,
        updatedAt: now,
      });
      ctx.state.menus.push(draft);
      return ctx.reply(draft);
    },
    activateMenus: async (trainerId, clientId, dayType) => {
      ownClient(ctx.state, trainerId, clientId);
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
