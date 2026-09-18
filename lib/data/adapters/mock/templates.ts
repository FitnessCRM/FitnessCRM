import type { TemplatePort } from "@/lib/data/ports";
import {
  cloneMenuTemplate,
  cloneRoutineTemplate,
  menuTemplateSchema,
  routineTemplateSchema,
} from "@/lib/domain";
import { findOwn, own, removeById, replaceById } from "./helpers";
import type { MockContext } from "./store";

export function createTemplatePort(ctx: MockContext): TemplatePort {
  return {
    listRoutineTemplates: async (trainerId) =>
      ctx.reply(
        own(ctx.state.routineTemplates, trainerId).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      ),
    listMenuTemplates: async (trainerId) =>
      ctx.reply(
        own(ctx.state.menuTemplates, trainerId).sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt),
        ),
      ),
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
    assignRoutineTemplate: async (trainerId, clientId, templateId) => {
      findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      const template = findOwn(ctx.state.routineTemplates, trainerId, templateId, "Plantilla");
      const routine = cloneRoutineTemplate(template, {
        trainerId,
        clientId,
        newId: ctx.newId,
        now: ctx.now(),
      });
      ctx.state.routines.push(routine);
      return ctx.reply(routine);
    },
    assignMenuTemplate: async (trainerId, clientId, templateId) => {
      findOwn(ctx.state.clients, trainerId, clientId, "Cliente");
      const template = findOwn(ctx.state.menuTemplates, trainerId, templateId, "Plantilla");
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
