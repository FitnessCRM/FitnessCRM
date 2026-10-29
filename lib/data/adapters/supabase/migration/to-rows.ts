import type {
  Exercise,
  Food,
  MacroTargets,
  Membership,
  Menu,
  MenuTemplate,
  MeasurementType,
  QuestionnaireQuestion,
  Routine,
  RoutineTemplate,
} from "@/lib/domain";
import { accountIdFor, childIdFor, clientIdFor, entityIdFor } from "./ids";

/**
 * Del dominio a las filas de las tablas de Supabase (tarjeta 119, Fase 8). Es la inversa de
 * `lib/data/adapters/supabase/{catalog,plan}-rows.ts`, con los ids ya convertidos a uuid. Pura: no
 * habla con la red ni con el SDK.
 *
 * Los tipos de medida y las preguntas salen con `has_measurements` y `has_responses` a false: los
 * pone el trigger de la tabla de medidas y de respuestas cuando se carguen esas filas (siguiente
 * sección), así que el flag siempre dice la verdad.
 */

export function exerciseRow(exercise: Exercise) {
  return {
    id: entityIdFor("exercise", exercise.id),
    trainer_id: accountIdFor(exercise.trainerId),
    name: exercise.name,
    muscle_group: exercise.muscleGroup,
    equipment: exercise.equipment,
    video_url: exercise.videoUrl,
    description: exercise.description,
    status: exercise.status,
    created_at: exercise.createdAt,
  };
}

export function foodRow(food: Food) {
  return {
    id: entityIdFor("food", food.id),
    trainer_id: accountIdFor(food.trainerId),
    name: food.name,
    kcal: food.composition.kcal,
    protein_g: food.composition.proteinG,
    carbs_g: food.composition.carbsG,
    fat_g: food.composition.fatG,
    status: food.status,
    publish_status: food.publishStatus,
    created_at: food.createdAt,
    updated_at: food.updatedAt,
  };
}

export function measurementTypeRow(type: MeasurementType) {
  return {
    id: entityIdFor("measurement-type", type.id),
    trainer_id: accountIdFor(type.trainerId),
    label: type.label,
    unit: type.unit,
    sort_order: type.order,
    status: type.status,
    has_measurements: false,
    created_at: type.createdAt,
  };
}

export function questionRow(question: QuestionnaireQuestion) {
  const format = question.format;
  return {
    id: entityIdFor("question", question.id),
    trainer_id: accountIdFor(question.trainerId),
    prompt: question.prompt,
    format_kind: format.kind,
    scale_min: format.kind === "escala" ? format.min : null,
    scale_max: format.kind === "escala" ? format.max : null,
    sort_order: question.order,
    status: question.status,
    has_responses: false,
    created_at: question.createdAt,
  };
}

/**
 * Los ids que viven dentro del cuerpo de una plantilla (`exerciseId`, `foodId`) apuntan a la
 * biblioteca del entrenador y se convierten con los mismos ids que sus filas. Los ids locales del
 * cuerpo (días, líneas, comidas) no son columnas uuid, así que se quedan tal cual.
 */
export function remapTemplateRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(remapTemplateRefs);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, field]) => {
      if (typeof field === "string" && key === "exerciseId") {
        return [key, entityIdFor("exercise", field)];
      }
      if (typeof field === "string" && key === "foodId") {
        return [key, entityIdFor("food", field)];
      }
      return [key, remapTemplateRefs(field)];
    }),
  );
}

export function routineTemplateRow(template: RoutineTemplate) {
  return {
    id: entityIdFor("routine-template", template.id),
    trainer_id: accountIdFor(template.trainerId),
    name: template.name,
    description: template.description,
    body: { note: template.note, days: remapTemplateRefs(template.days) },
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

export function menuTemplateRow(template: MenuTemplate) {
  return {
    id: entityIdFor("menu-template", template.id),
    trainer_id: accountIdFor(template.trainerId),
    name: template.name,
    description: template.description,
    body: { menus: remapTemplateRefs(template.menus) },
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

/** Una rutina y sus partes en filas: días, luego líneas. El orden del array es la posición. */
export function routineRows(routine: Routine) {
  const routineId = entityIdFor("routine", routine.id);
  const trainerId = accountIdFor(routine.trainerId);

  const days = routine.days.map((day, position) => ({
    id: childIdFor(routineId, "day", day.id),
    routine_id: routineId,
    trainer_id: trainerId,
    position,
    day_number: day.dayNumber,
    label: day.label,
  }));

  const lines = routine.days.flatMap((day) => {
    const dayId = childIdFor(routineId, "day", day.id);
    return day.exercises.map((line, position) => ({
      id: childIdFor(routineId, "line", line.id),
      routine_id: routineId,
      routine_day_id: dayId,
      trainer_id: trainerId,
      exercise_id: entityIdFor("exercise", line.exerciseId),
      position,
      sets: line.prescription.sets,
      reps_min: line.prescription.repsMin,
      reps_max: line.prescription.repsMax,
      rir: line.prescription.rir,
      rest: line.prescription.rest,
      note: line.prescription.note,
    }));
  });

  return {
    routine: {
      id: routineId,
      trainer_id: trainerId,
      client_id: clientIdFor(routine.clientId),
      status: routine.status,
      name: routine.name,
      note: routine.note,
      source_template_name: routine.sourceTemplateName,
      created_at: routine.createdAt,
      updated_at: routine.updatedAt,
    },
    days,
    lines,
  };
}

/**
 * Un menú y sus partes en filas: comidas, y alimentos de cada comida. Un alimento de la biblioteca
 * lleva su copia congelada; uno de texto libre, ninguna (I29, I30).
 */
export function menuRows(menu: Menu) {
  const menuId = entityIdFor("menu", menu.id);
  const trainerId = accountIdFor(menu.trainerId);

  const meals = menu.meals.map((meal, position) => ({
    id: childIdFor(menuId, "meal", meal.id),
    menu_id: menuId,
    trainer_id: trainerId,
    position,
    name: meal.name,
  }));

  const items = menu.meals.flatMap((meal) => {
    const mealId = childIdFor(menuId, "meal", meal.id);
    return meal.items.map((item, position) => ({
      id: childIdFor(menuId, "item", item.id),
      menu_id: menuId,
      meal_id: mealId,
      trainer_id: trainerId,
      position,
      name: item.name,
      grams: item.grams,
      food_id: item.foodId === undefined ? null : entityIdFor("food", item.foodId),
      kcal: item.composition?.kcal ?? null,
      protein_g: item.composition?.proteinG ?? null,
      carbs_g: item.composition?.carbsG ?? null,
      fat_g: item.composition?.fatG ?? null,
    }));
  });

  return {
    menu: {
      id: menuId,
      trainer_id: trainerId,
      client_id: clientIdFor(menu.clientId),
      status: menu.status,
      name: menu.name,
      day_type: menu.dayType,
      suggested: menu.suggested,
      kcal: menu.macros.kcal,
      protein_g: menu.macros.proteinG,
      carbs_g: menu.macros.carbsG,
      fat_g: menu.macros.fatG,
      note: menu.note,
      source_template_name: menu.sourceTemplateName,
      created_at: menu.createdAt,
      updated_at: menu.updatedAt,
    },
    meals,
    items,
  };
}

export function macroTargetsRow(targets: MacroTargets) {
  return {
    id: entityIdFor("macro-targets", targets.id),
    trainer_id: accountIdFor(targets.trainerId),
    client_id: clientIdFor(targets.clientId),
    day_type: targets.dayType,
    status: targets.status,
    kcal: targets.macros.kcal,
    protein_g: targets.macros.proteinG,
    carbs_g: targets.macros.carbsG,
    fat_g: targets.macros.fatG,
    created_at: targets.createdAt,
    updated_at: targets.updatedAt,
  };
}

export function membershipRow(membership: Membership) {
  return {
    id: entityIdFor("membership", membership.id),
    trainer_id: accountIdFor(membership.trainerId),
    client_id: clientIdFor(membership.clientId),
    type: membership.type,
    start_date: membership.startDate,
    end_date: membership.endDate,
    payment_status: membership.paymentStatus,
    created_at: membership.createdAt,
  };
}
