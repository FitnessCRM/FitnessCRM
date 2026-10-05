import { deleteDoc, setDoc, where, writeBatch } from "firebase/firestore";
import type { TemplatePort } from "@/lib/data/ports";
import {
  assertExercisesInLibrary,
  clientSchema,
  cloneMenuTemplate,
  cloneRoutineTemplate,
  duplicateMenuTemplate,
  duplicateRoutineTemplate,
  exerciseSchema,
  menuTemplateSchema,
  routineTemplateSchema,
} from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, listOwn, ref, requireOwn } from "./helpers";

/**
 * Plantillas (§4): sin cliente, se clonan al asignar y nunca se enlazan. Por eso se pueden borrar:
 * no cuelga histórico de ellas. El uso es un dato derivado que se cuenta sobre los planes con ese
 * `sourceTemplateName`, no un campo de la plantilla.
 */
const byUpdatedDesc = <T extends { updatedAt: string }>(a: T, b: T) =>
  b.updatedAt.localeCompare(a.updatedAt);

export function createTemplatePort(ctx: FirebaseContext): TemplatePort {
  const routineTemplates = COLLECTIONS.routineTemplates;
  const menuTemplates = COLLECTIONS.menuTemplates;

  const library = (trainerId: string) =>
    listOwn(ctx, COLLECTIONS.exercises, exerciseSchema, trainerId, where("status", "==", "activo"));

  return {
    listRoutineTemplates: async (trainerId) =>
      (await listOwn(ctx, routineTemplates, routineTemplateSchema, trainerId)).sort(byUpdatedDesc),

    listMenuTemplates: async (trainerId) =>
      (await listOwn(ctx, menuTemplates, menuTemplateSchema, trainerId)).sort(byUpdatedDesc),

    duplicateRoutineTemplate: async (trainerId, templateId, name) => {
      const template = await requireOwn(
        ctx,
        routineTemplates,
        routineTemplateSchema,
        trainerId,
        templateId,
        "Plantilla",
      );
      const copy = routineTemplateSchema.parse(
        duplicateRoutineTemplate(template, { newId: ctx.newId, now: ctx.now(), name }),
      );
      await setDoc(ref(ctx, routineTemplates, copy.id), copy);
      return copy;
    },

    duplicateMenuTemplate: async (trainerId, templateId, name) => {
      const template = await requireOwn(
        ctx,
        menuTemplates,
        menuTemplateSchema,
        trainerId,
        templateId,
        "Plantilla",
      );
      const copy = menuTemplateSchema.parse(
        duplicateMenuTemplate(template, { newId: ctx.newId, now: ctx.now(), name }),
      );
      await setDoc(ref(ctx, menuTemplates, copy.id), copy);
      return copy;
    },

    saveRoutineTemplate: async (input) => {
      const now = ctx.now();
      const existing = input.id
        ? await requireOwn(
            ctx,
            routineTemplates,
            routineTemplateSchema,
            input.trainerId,
            input.id,
            "Plantilla",
          )
        : null;
      const template = routineTemplateSchema.parse({
        ...input,
        id: existing?.id ?? ctx.newId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      // I3: una plantilla también prescribe solo ejercicios de la biblioteca del entrenador.
      assertExercisesInLibrary(template, await library(input.trainerId));
      await setDoc(ref(ctx, routineTemplates, template.id), template);
      return template;
    },

    saveMenuTemplate: async (input) => {
      const now = ctx.now();
      const existing = input.id
        ? await requireOwn(
            ctx,
            menuTemplates,
            menuTemplateSchema,
            input.trainerId,
            input.id,
            "Plantilla",
          )
        : null;
      const template = menuTemplateSchema.parse({
        ...input,
        id: existing?.id ?? ctx.newId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      await setDoc(ref(ctx, menuTemplates, template.id), template);
      return template;
    },

    deleteRoutineTemplate: async (trainerId, templateId) => {
      await requireOwn(
        ctx,
        routineTemplates,
        routineTemplateSchema,
        trainerId,
        templateId,
        "Plantilla",
      );
      await deleteDoc(ref(ctx, routineTemplates, templateId));
    },

    deleteMenuTemplate: async (trainerId, templateId) => {
      await requireOwn(ctx, menuTemplates, menuTemplateSchema, trainerId, templateId, "Plantilla");
      await deleteDoc(ref(ctx, menuTemplates, templateId));
    },

    // Clona la plantilla en una rutina en borrador del cliente (§4: copiar, no enlazar).
    assignRoutineTemplate: async (trainerId, clientId, templateId) => {
      await requireOwn(ctx, COLLECTIONS.clients, clientSchema, trainerId, clientId, "Cliente");
      const template = await requireOwn(
        ctx,
        routineTemplates,
        routineTemplateSchema,
        trainerId,
        templateId,
        "Plantilla",
      );
      const routine = cloneRoutineTemplate(template, {
        trainerId,
        clientId,
        newId: ctx.newId,
        now: ctx.now(),
      });
      await setDoc(ref(ctx, COLLECTIONS.routines, routine.id), routine);
      return routine;
    },

    // Clona cada menú de la plantilla en un menú en borrador del cliente, todos o ninguno.
    assignMenuTemplate: async (trainerId, clientId, templateId) => {
      await requireOwn(ctx, COLLECTIONS.clients, clientSchema, trainerId, clientId, "Cliente");
      const template = await requireOwn(
        ctx,
        menuTemplates,
        menuTemplateSchema,
        trainerId,
        templateId,
        "Plantilla",
      );
      const menus = cloneMenuTemplate(template, {
        trainerId,
        clientId,
        newId: ctx.newId,
        now: ctx.now(),
      });
      const batch = writeBatch(ctx.db);
      for (const menu of menus) batch.set(ref(ctx, COLLECTIONS.menus, menu.id), menu);
      await batch.commit();
      return menus;
    },
  };
}
