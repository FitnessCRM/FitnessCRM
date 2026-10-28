import type { TemplatePort } from "@/lib/data/ports";
import {
  assertExercisesInLibrary,
  duplicateMenuTemplate,
  duplicateRoutineTemplate,
  menuTemplateSchema,
  routineTemplateSchema,
  type MenuTemplate,
  type RoutineTemplate,
} from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise } from "./errors";
import { activeLibrary, readRoutine } from "./plans";
import {
  MENU_SELECT,
  MENU_TEMPLATE_COLUMNS,
  ROUTINE_TEMPLATE_COLUMNS,
  menuFromRow,
  menuTemplateFromRow,
  routineTemplateFromRow,
  type MenuRow,
  type MenuTemplateRow,
  type RoutineTemplateRow,
} from "./plan-rows";
import { rowsOf } from "./queries";

const newId = () => crypto.randomUUID();

/**
 * Las plantillas guardan su contenido en `body`. Lo que no es cuerpo (el nombre y la descripción) va
 * en sus columnas. Se clonan al asignar y nunca se enlazan (§4): por eso se pueden borrar.
 */
const routineBodyOf = (template: RoutineTemplate) => ({
  note: template.note,
  days: template.days,
});

const menuBodyOf = (template: MenuTemplate) => ({ menus: template.menus });

export function createTemplatePort(client: SupabaseClient): TemplatePort {
  const requireRoutineTemplateRow = async (trainerId: string, templateId: string) => {
    const { data, error } = await client
      .from("routine_templates")
      .select(ROUTINE_TEMPLATE_COLUMNS)
      .eq("trainer_id", trainerId)
      .eq("id", templateId)
      .maybeSingle();
    raise(error);
    if (!data) throw notFoundError("Plantilla");
    return routineTemplateFromRow(data as RoutineTemplateRow);
  };

  const requireMenuTemplateRow = async (trainerId: string, templateId: string) => {
    const { data, error } = await client
      .from("menu_templates")
      .select(MENU_TEMPLATE_COLUMNS)
      .eq("trainer_id", trainerId)
      .eq("id", templateId)
      .maybeSingle();
    raise(error);
    if (!data) throw notFoundError("Plantilla");
    return menuTemplateFromRow(data as MenuTemplateRow);
  };

  const insertRoutineTemplate = async (template: RoutineTemplate) => {
    const { data, error } = await client
      .from("routine_templates")
      .insert({
        id: template.id,
        trainer_id: template.trainerId,
        name: template.name,
        description: template.description,
        body: routineBodyOf(template),
      })
      .select(ROUTINE_TEMPLATE_COLUMNS)
      .single();
    raise(error);
    return routineTemplateFromRow(data as RoutineTemplateRow);
  };

  const insertMenuTemplate = async (template: MenuTemplate) => {
    const { data, error } = await client
      .from("menu_templates")
      .insert({
        id: template.id,
        trainer_id: template.trainerId,
        name: template.name,
        description: template.description,
        body: menuBodyOf(template),
      })
      .select(MENU_TEMPLATE_COLUMNS)
      .single();
    raise(error);
    return menuTemplateFromRow(data as MenuTemplateRow);
  };

  return {
    listRoutineTemplates: (trainerId) =>
      rowsOf(
        client
          .from("routine_templates")
          .select(ROUTINE_TEMPLATE_COLUMNS)
          .eq("trainer_id", trainerId)
          .order("updated_at", { ascending: false }),
        (row: RoutineTemplateRow) => routineTemplateFromRow(row),
      ),

    listMenuTemplates: (trainerId) =>
      rowsOf(
        client
          .from("menu_templates")
          .select(MENU_TEMPLATE_COLUMNS)
          .eq("trainer_id", trainerId)
          .order("updated_at", { ascending: false }),
        (row: MenuTemplateRow) => menuTemplateFromRow(row),
      ),

    duplicateRoutineTemplate: async (trainerId, templateId, name) => {
      const template = await requireRoutineTemplateRow(trainerId, templateId);
      const copy = routineTemplateSchema.parse(
        duplicateRoutineTemplate(template, { newId, now: new Date().toISOString(), name }),
      );
      return insertRoutineTemplate(copy);
    },

    duplicateMenuTemplate: async (trainerId, templateId, name) => {
      const template = await requireMenuTemplateRow(trainerId, templateId);
      const copy = menuTemplateSchema.parse(
        duplicateMenuTemplate(template, { newId, now: new Date().toISOString(), name }),
      );
      return insertMenuTemplate(copy);
    },

    // Con id, reemplaza el contenido de esa plantilla; sin id, crea una. Un id ajeno no existe: `not_found`.
    saveRoutineTemplate: async (input) => {
      const now = new Date().toISOString();
      const template = routineTemplateSchema.parse({
        ...input,
        id: input.id ?? newId(),
        createdAt: now,
        updatedAt: now,
      });
      // I3: una plantilla también prescribe solo ejercicios de la biblioteca del entrenador.
      assertExercisesInLibrary(template, await activeLibrary(client, input.trainerId));

      if (!input.id) return insertRoutineTemplate(template);

      const { data, error } = await client
        .from("routine_templates")
        .update({
          name: template.name,
          description: template.description,
          body: routineBodyOf(template),
        })
        .eq("trainer_id", input.trainerId)
        .eq("id", input.id)
        .select(ROUTINE_TEMPLATE_COLUMNS)
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Plantilla");
      return routineTemplateFromRow(data as RoutineTemplateRow);
    },

    saveMenuTemplate: async (input) => {
      const now = new Date().toISOString();
      const template = menuTemplateSchema.parse({
        ...input,
        id: input.id ?? newId(),
        createdAt: now,
        updatedAt: now,
      });

      if (!input.id) return insertMenuTemplate(template);

      const { data, error } = await client
        .from("menu_templates")
        .update({
          name: template.name,
          description: template.description,
          body: menuBodyOf(template),
        })
        .eq("trainer_id", input.trainerId)
        .eq("id", input.id)
        .select(MENU_TEMPLATE_COLUMNS)
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Plantilla");
      return menuTemplateFromRow(data as MenuTemplateRow);
    },

    deleteRoutineTemplate: async (trainerId, templateId) => {
      const { data, error } = await client
        .from("routine_templates")
        .delete()
        .eq("trainer_id", trainerId)
        .eq("id", templateId)
        .select("id")
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Plantilla");
    },

    deleteMenuTemplate: async (trainerId, templateId) => {
      const { data, error } = await client
        .from("menu_templates")
        .delete()
        .eq("trainer_id", trainerId)
        .eq("id", templateId)
        .select("id")
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Plantilla");
    },

    // La función copia la plantilla en una rutina en borrador del cliente (§4).
    assignRoutineTemplate: async (trainerId, clientId, templateId) => {
      const { data, error } = await client.rpc("assign_routine_template", {
        p_template_id: templateId,
        p_client_id: clientId,
      });
      raise(error);
      const routine = await readRoutine(client, trainerId, data as string);
      if (!routine) throw notFoundError("Rutina");
      return routine;
    },

    // La función devuelve los ids de los menús que crea, en el orden de la plantilla.
    assignMenuTemplate: async (trainerId, clientId, templateId) => {
      const { data, error } = await client.rpc("assign_menu_template", {
        p_template_id: templateId,
        p_client_id: clientId,
      });
      raise(error);
      const ids = data as string[];
      if (ids.length === 0) return [];
      const menus = await rowsOf(
        client.from("menus").select(MENU_SELECT).eq("trainer_id", trainerId).in("id", ids),
        (row: MenuRow) => menuFromRow(row),
      );
      return menus.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    },
  };
}
