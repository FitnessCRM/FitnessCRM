import type { TemplatePort } from "@/lib/data/ports";
import {
  cloneMenuTemplate,
  cloneRoutineTemplate,
  duplicateMenuTemplate,
  duplicateRoutineTemplate,
  menuTemplateSchema,
  routineTemplateSchema,
} from "@/lib/domain";
import { findOwn, own, removeById, replaceById } from "./helpers";
import type { MockContext } from "./store";

/** Clientes distintos con algún plan copiado de una plantilla con ese nombre congelado. */
function usageByName(plans: { clientId: string; sourceTemplateName: string | null }[]) {
  const clientsByName = new Map<string, Set<string>>();
  for (const plan of plans) {
    if (plan.sourceTemplateName === null) continue;
    const clients = clientsByName.get(plan.sourceTemplateName) ?? new Set<string>();
    clients.add(plan.clientId);
    clientsByName.set(plan.sourceTemplateName, clients);
  }
  return (name: string) => clientsByName.get(name)?.size ?? 0;
}

export function createTemplatePort(ctx: MockContext): TemplatePort {
  return {
    listRoutineTemplates: async (trainerId) => {
      const usage = usageByName(own(ctx.state.routines, trainerId));
      return ctx.reply(
        own(ctx.state.routineTemplates, trainerId)
          .map((t) => ({ ...t, usageCount: usage(t.name) }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      );
    },
    listMenuTemplates: async (trainerId) => {
      const usage = usageByName(own(ctx.state.menus, trainerId));
      return ctx.reply(
        own(ctx.state.menuTemplates, trainerId)
          .map((t) => ({ ...t, usageCount: usage(t.name) }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
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
