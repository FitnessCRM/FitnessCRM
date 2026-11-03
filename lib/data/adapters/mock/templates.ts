import type { TemplatePort } from "@/lib/data/ports";
import {
  assertExercisesInLibrary,
  draftExistsError,
  menuDraftsBlocking,
  routineDraftsBlocking,
  cloneMenuTemplate,
  cloneRoutineTemplate,
  duplicateMenuTemplate,
  duplicateRoutineTemplate,
  menuTemplateSchema,
  routineTemplateSchema,
} from "@/lib/domain";
import { findOwn, own, removeById, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createTemplatePort(ctx: MockContext): TemplatePort {
  return {
    listRoutineTemplates: async (trainerId) => {
      return ctx.reply(
        own(ctx.state.routineTemplates, trainerId).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    },
    listMenuTemplates: async (trainerId) => {
      return ctx.reply(
        own(ctx.state.menuTemplates, trainerId).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      );
    },
    duplicateRoutineTemplate: async (trainerId, templateId, name) => {
      const template = findOwn(ctx.state.routineTemplates, trainerId, templateId, "Plantilla");
      const copy = routineTemplateSchema.parse(
        duplicateRoutineTemplate(template, { newId: ctx.newId, now: ctx.now(), name }),
      );
      return ctx.reply(replaceById(ctx.state.routineTemplates, copy));
    },
    duplicateMenuTemplate: async (trainerId, templateId, name) => {
      const template = findOwn(ctx.state.menuTemplates, trainerId, templateId, "Plantilla");
      const copy = menuTemplateSchema.parse(
        duplicateMenuTemplate(template, { newId: ctx.newId, now: ctx.now(), name }),
      );
      return ctx.reply(replaceById(ctx.state.menuTemplates, copy));
    },
    saveRoutineTemplate: async (input) => {
      const now = ctx.now();
      const existing = input.id
        ? findOwn(ctx.state.routineTemplates, input.trainerId, input.id, "Plantilla")
        : null;
      const template = routineTemplateSchema.parse({
        ...input,
        id: existing?.id ?? ctx.newId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      // I3: una plantilla también prescribe solo ejercicios de la biblioteca del entrenador.
      assertExercisesInLibrary(template, own(ctx.state.exercises, input.trainerId));
      return ctx.reply(replaceById(ctx.state.routineTemplates, template));
    },
    saveMenuTemplate: async (input) => {
      const now = ctx.now();
      const existing = input.id
        ? findOwn(ctx.state.menuTemplates, input.trainerId, input.id, "Plantilla")
        : null;
      const template = menuTemplateSchema.parse({
        ...input,
        id: existing?.id ?? ctx.newId(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      return ctx.reply(replaceById(ctx.state.menuTemplates, template));
    },
    deleteRoutineTemplate: async (trainerId, templateId) => {
      findOwn(ctx.state.routineTemplates, trainerId, templateId, "Plantilla");
      removeById(ctx.state.routineTemplates, templateId);
      return ctx.reply(undefined);
    },
    deleteMenuTemplate: async (trainerId, templateId) => {
      findOwn(ctx.state.menuTemplates, trainerId, templateId, "Plantilla");
      removeById(ctx.state.menuTemplates, templateId);
      return ctx.reply(undefined);
    },
    assignRoutineTemplate: async (trainerId, clientId, templateId, options) => {
      findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      const template = findOwn(ctx.state.routineTemplates, trainerId, templateId, "Plantilla");
      // I32: un borrador por cliente; sustituirlo lo borra, porque un borrador no tiene histórico.
      const drafts = new Set(routineDraftsBlocking(own(ctx.state.routines, trainerId), clientId));
      if (drafts.size > 0) {
        if (!options?.replaceDraft) throw draftExistsError();
        ctx.state.routines = ctx.state.routines.filter((r) => !drafts.has(r.id));
      }
      const routine = cloneRoutineTemplate(template, {
        trainerId,
        clientId,
        newId: ctx.newId,
        now: ctx.now(),
      });
      ctx.state.routines.push(routine);
      return ctx.reply(routine);
    },
    assignMenuTemplate: async (trainerId, clientId, templateId, options) => {
      findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      const template = findOwn(ctx.state.menuTemplates, trainerId, templateId, "Plantilla");
      // I32: un conjunto en borrador por tipo de día; solo chocan los tipos que trae la plantilla.
      const drafts = new Set(
        menuDraftsBlocking(own(ctx.state.menus, trainerId), clientId, template),
      );
      if (drafts.size > 0) {
        if (!options?.replaceDraft) throw draftExistsError();
        ctx.state.menus = ctx.state.menus.filter((m) => !drafts.has(m.id));
      }
      const menus = cloneMenuTemplate(template, {
        trainerId,
        clientId,
        newId: ctx.newId,
        now: ctx.now(),
      });
      ctx.state.menus.push(...menus);
      return ctx.reply(menus);
    },
  };
}
