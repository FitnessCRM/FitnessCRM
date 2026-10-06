import { runTransaction, where } from "firebase/firestore";
import type { MacroTargetsPort, MenuPort, RoutinePort } from "@/lib/data/ports";
import {
  DomainError,
  assertExercisesInLibrary,
  clientSchema,
  exerciseSchema,
  macroTargetsSchema,
  menuBodySchema,
  menuSchema,
  routineBodySchema,
  routineSchema,
  type RoutineBody,
} from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, listOwn, ref, requireOwn, txRequireOwn } from "./helpers";

/**
 * Rutina, macros y menú del cliente (§7, I4). Los planes se escriben enteros, sin `merge`: el
 * documento es el objeto del dominio y no lleva nada más, así que reemplazarlo no deja claves viejas.
 *
 * Lo que en Postgres habría sido una restricción —una rutina activa por cliente, un juego de macros
 * por tipo de día— es aquí una transacción: se leen por referencia los documentos que van a cambiar
 * y se escriben todos juntos. Las consultas que los encuentran no pueden ir dentro de la
 * transacción (el SDK de cliente no lo permite), así que un plan activado en el mismo instante por
 * otro dispositivo no entraría en ella: las reglas no pueden contar documentos activos, y el riesgo
 * queda en que dos entrenadores —o dos pestañas— activen a la vez.
 */

export function createRoutinePort(ctx: FirebaseContext): RoutinePort {
  const name = COLLECTIONS.routines;

  /** El cuerpo, validado y sin campos de identidad, con solo ejercicios de la biblioteca (I3). */
  const checkedBody = async (trainerId: string, body: RoutineBody) => {
    const parsed = routineBodySchema.parse(body);
    const library = await listOwn(
      ctx,
      COLLECTIONS.exercises,
      exerciseSchema,
      trainerId,
      where("status", "==", "activo"),
    );
    assertExercisesInLibrary(parsed, library);
    return parsed;
  };

  const clientRef = (clientId: string) => ref(ctx, COLLECTIONS.clients, clientId);

  /** Las activas de un cliente: lo que una activación nueva tiene que archivar. */
  const activeOf = (trainerId: string, clientId: string) =>
    listOwn(
      ctx,
      name,
      routineSchema,
      trainerId,
      where("clientId", "==", clientId),
      where("status", "==", "activo"),
    );

  return {
    getActiveRoutine: async (trainerId, clientId) =>
      (await activeOf(trainerId, clientId))[0] ?? null,

    listRoutines: async (trainerId, clientId) =>
      (await listOwn(ctx, name, routineSchema, trainerId, where("clientId", "==", clientId))).sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt),
      ),

    createRoutine: async (trainerId, clientId, body) => {
      // Primero de quién es (not_found), después qué lleva: así no se dice nada de lo ajeno.
      await requireOwn(ctx, COLLECTIONS.clients, clientSchema, trainerId, clientId, "Cliente");
      const checked = await checkedBody(trainerId, body);
      return runTransaction(ctx.db, async (tx) => {
        await txRequireOwn(tx, clientRef(clientId), clientSchema, trainerId, "Cliente");
        const now = ctx.now();
        const routine = routineSchema.parse({
          ...checked,
          id: ctx.newId(),
          trainerId,
          clientId,
          status: "borrador",
          sourceTemplateName: null,
          createdAt: now,
          updatedAt: now,
        });
        tx.set(ref(ctx, name, routine.id), routine);
        return routine;
      });
    },

    updateRoutine: async (trainerId, routineId, body) => {
      await requireOwn(ctx, name, routineSchema, trainerId, routineId, "Rutina");
      const checked = await checkedBody(trainerId, body);
      return runTransaction(ctx.db, async (tx) => {
        const docRef = ref(ctx, name, routineId);
        const { value: current } = await txRequireOwn(
          tx,
          docRef,
          routineSchema,
          trainerId,
          "Rutina",
        );
        // §7: lo activo no se edita en sitio; solo los borradores.
        if (current.status !== "borrador") {
          throw new DomainError("routine.not_draft", "Solo se edita en sitio un borrador");
        }
        const next = routineSchema.parse({ ...current, ...checked, updatedAt: ctx.now() });
        tx.set(docRef, next);
        return next;
      });
    },

    reviseRoutine: async (trainerId, routineId, body) => {
      await requireOwn(ctx, name, routineSchema, trainerId, routineId, "Rutina");
      const checked = await checkedBody(trainerId, body);
      return runTransaction(ctx.db, async (tx) => {
        const { value: current } = await txRequireOwn(
          tx,
          ref(ctx, name, routineId),
          routineSchema,
          trainerId,
          "Rutina",
        );
        if (current.status !== "activo") {
          throw new DomainError("routine.not_active", "Solo se versiona la rutina activa");
        }
        const now = ctx.now();
        // Versión nueva en borrador: misma plantilla de origen, ids de días y líneas tal como llegan.
        const draft = routineSchema.parse({
          ...checked,
          id: ctx.newId(),
          trainerId,
          clientId: current.clientId,
          status: "borrador",
          sourceTemplateName: current.sourceTemplateName,
          createdAt: now,
          updatedAt: now,
        });
        tx.set(ref(ctx, name, draft.id), draft);
        return draft;
      });
    },

    activateRoutine: async (trainerId, routineId) => {
      // Para saber a quién archivar hace falta el cliente del plan, y las consultas van fuera de la
      // transacción: dentro se vuelve a leer cada documento por referencia antes de escribir.
      const plan = await requireOwn(ctx, name, routineSchema, trainerId, routineId, "Rutina");
      const siblings = (await activeOf(trainerId, plan.clientId)).filter((r) => r.id !== routineId);
      return runTransaction(ctx.db, async (tx) => {
        const targetRef = ref(ctx, name, routineId);
        const { value: target } = await txRequireOwn(
          tx,
          targetRef,
          routineSchema,
          trainerId,
          "Rutina",
        );
        if (target.status === "archivado") {
          throw new DomainError("routine.archived", "Una rutina archivada no se reactiva");
        }
        const current = await Promise.all(
          siblings.map((s) =>
            txRequireOwn(tx, ref(ctx, name, s.id), routineSchema, trainerId, "Rutina"),
          ),
        );
        const now = ctx.now();
        // I4: como máximo una rutina activa por cliente. Solo las de este entrenador (I1).
        for (const { value } of current) {
          if (value.status === "activo") {
            tx.set(ref(ctx, name, value.id), { ...value, status: "archivado", updatedAt: now });
          }
        }
        const next = { ...target, status: "activo" as const, updatedAt: now };
        tx.set(targetRef, next);
        return next;
      });
    },
  };
}

export function createMacroTargetsPort(ctx: FirebaseContext): MacroTargetsPort {
  const name = COLLECTIONS.macroTargets;
  const activeTargets = (trainerId: string, clientId: string) =>
    listOwn(
      ctx,
      name,
      macroTargetsSchema,
      trainerId,
      where("clientId", "==", clientId),
      where("status", "==", "activo"),
    );
  return {
    listMacroTargets: activeTargets,

    setMacroTargets: async (trainerId, clientId, dayType, macros) => {
      const previous = (await activeTargets(trainerId, clientId)).filter(
        (m) => m.dayType === dayType,
      );
      return runTransaction(ctx.db, async (tx) => {
        await txRequireOwn(
          tx,
          ref(ctx, COLLECTIONS.clients, clientId),
          clientSchema,
          trainerId,
          "Cliente",
        );
        const current = await Promise.all(
          previous.map((m) =>
            txRequireOwn(tx, ref(ctx, name, m.id), macroTargetsSchema, trainerId, "Macros"),
          ),
        );
        const now = ctx.now();
        // I4: un juego de macros activo por tipo de día.
        for (const { value } of current) {
          if (value.status === "activo") {
            tx.set(ref(ctx, name, value.id), { ...value, status: "archivado", updatedAt: now });
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
        tx.set(ref(ctx, name, created.id), created);
        return created;
      });
    },
  };
}

export function createMenuPort(ctx: FirebaseContext): MenuPort {
  const name = COLLECTIONS.menus;
  const clientRef = (clientId: string) => ref(ctx, COLLECTIONS.clients, clientId);
  const ofClient = (trainerId: string, clientId: string, ...more: ReturnType<typeof where>[]) =>
    listOwn(ctx, name, menuSchema, trainerId, where("clientId", "==", clientId), ...more);

  return {
    listActiveMenus: (trainerId, clientId) =>
      ofClient(trainerId, clientId, where("status", "==", "activo")),

    // Los activos y los borradores, no los archivados.
    listMenus: (trainerId, clientId) =>
      ofClient(trainerId, clientId, where("status", "in", ["borrador", "activo"])),

    listArchivedMenus: (trainerId, clientId) =>
      ofClient(trainerId, clientId, where("status", "==", "archivado")),

    createMenu: (trainerId, clientId, body) =>
      runTransaction(ctx.db, async (tx) => {
        await txRequireOwn(tx, clientRef(clientId), clientSchema, trainerId, "Cliente");
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
        tx.set(ref(ctx, name, menu.id), menu);
        return menu;
      }),

    updateMenu: (trainerId, menuId, body) =>
      runTransaction(ctx.db, async (tx) => {
        const docRef = ref(ctx, name, menuId);
        const { value: current } = await txRequireOwn(tx, docRef, menuSchema, trainerId, "Menú");
        // §7: lo activo no se edita en sitio; solo los borradores.
        if (current.status !== "borrador") {
          throw new DomainError("menu.not_draft", "Solo se edita en sitio un borrador");
        }
        const next = menuSchema.parse({
          ...current,
          ...menuBodySchema.parse(body),
          updatedAt: ctx.now(),
        });
        tx.set(docRef, next);
        return next;
      }),

    reviseMenu: (trainerId, menuId, body) =>
      runTransaction(ctx.db, async (tx) => {
        const { value: current } = await txRequireOwn(
          tx,
          ref(ctx, name, menuId),
          menuSchema,
          trainerId,
          "Menú",
        );
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
        tx.set(ref(ctx, name, draft.id), draft);
        return draft;
      }),

    activateMenus: async (trainerId, clientId, dayType) => {
      const ofDay = await ofClient(trainerId, clientId, where("dayType", "==", dayType));
      return runTransaction(ctx.db, async (tx) => {
        await txRequireOwn(tx, clientRef(clientId), clientSchema, trainerId, "Cliente");
        const current = await Promise.all(
          ofDay.map((m) => txRequireOwn(tx, ref(ctx, name, m.id), menuSchema, trainerId, "Menú")),
        );
        const mine = current.map((c) => c.value);
        const drafts = mine.filter((m) => m.status === "borrador");
        if (drafts.length === 0) {
          throw new DomainError("menu.no_drafts", "No hay menús en borrador para ese tipo de día");
        }
        const now = ctx.now();
        // I4: activar el conjunto nuevo de un tipo de día archiva todo el activo que había.
        for (const m of mine) {
          if (m.status === "activo") {
            tx.set(ref(ctx, name, m.id), { ...m, status: "archivado", updatedAt: now });
          }
        }
        return drafts.map((d) => {
          const activated = { ...d, status: "activo" as const, updatedAt: now };
          tx.set(ref(ctx, name, d.id), activated);
          return activated;
        });
      });
    },

    archiveMenu: (trainerId, menuId) =>
      runTransaction(ctx.db, async (tx) => {
        const docRef = ref(ctx, name, menuId);
        const { value } = await txRequireOwn(tx, docRef, menuSchema, trainerId, "Menú");
        tx.set(docRef, { ...value, status: "archivado", updatedAt: ctx.now() });
      }),
  };
}
