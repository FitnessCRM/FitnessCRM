import type { ExerciseChanges, ExerciseInput, ExercisePort } from "@/lib/data/ports";
import {
  exerciseSchema,
  routineBodySchema,
  routinesUsingExercise,
  type Exercise,
} from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise } from "./errors";
import { rowsOf } from "./queries";
import { EXERCISE_COLUMNS, exerciseFromRow, type ExerciseRow } from "./catalog-rows";

/** Lo que aporta el entrenador al crear o editar: sin identidad ni estado. */
const exerciseInputSchema = exerciseSchema.omit({ id: true, createdAt: true, status: true });

/** Solo las columnas de los campos que llegan. */
function exerciseColumns(changes: ExerciseChanges) {
  return {
    ...(changes.name !== undefined && { name: changes.name }),
    ...(changes.muscleGroup !== undefined && { muscle_group: changes.muscleGroup }),
    ...(changes.equipment !== undefined && { equipment: changes.equipment }),
    ...(changes.videoUrl !== undefined && { video_url: changes.videoUrl }),
    ...(changes.description !== undefined && { description: changes.description }),
  };
}

export function createExercisePort(client: SupabaseClient): ExercisePort {
  /** Un ejercicio que no es del entrenador no existe para él: `not_found`. */
  async function readExercise(trainerId: string, exerciseId: string): Promise<Exercise | null> {
    const { data, error } = await client
      .from("exercises")
      .select(EXERCISE_COLUMNS)
      .eq("trainer_id", trainerId)
      .eq("id", exerciseId)
      .maybeSingle();
    raise(error);
    return data ? exerciseFromRow(data as ExerciseRow) : null;
  }

  return {
    listExercises: async (trainerId) =>
      (
        await rowsOf(
          client
            .from("exercises")
            .select(EXERCISE_COLUMNS)
            .eq("trainer_id", trainerId)
            .eq("status", "activo"),
          exerciseFromRow,
        )
      ).sort((a, b) => a.name.localeCompare(b.name)),

    getExercise: readExercise,

    createExercise: async (input: ExerciseInput) => {
      const data = exerciseInputSchema.parse(input);
      const { data: row, error } = await client
        .from("exercises")
        .insert({ ...exerciseColumns(data), trainer_id: data.trainerId, status: "activo" })
        .select(EXERCISE_COLUMNS)
        .single();
      raise(error);
      return exerciseFromRow(row as ExerciseRow);
    },

    updateExercise: async (trainerId, exerciseId, changes) => {
      const current = await readExercise(trainerId, exerciseId);
      if (!current) throw notFoundError("Ejercicio");
      exerciseSchema.parse({ ...current, ...changes });

      const { data, error } = await client
        .from("exercises")
        .update(exerciseColumns(changes))
        .eq("trainer_id", trainerId)
        .eq("id", exerciseId)
        .select(EXERCISE_COLUMNS)
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Ejercicio");
      return exerciseFromRow(data as ExerciseRow);
    },

    // Las rutinas vivas (borrador y activo) que lo prescriben, y las plantillas (su cuerpo es jsonb).
    getExerciseUsage: async (trainerId, exerciseId) => {
      const usedIn = await rowsOf(
        client
          .from("routine_day_exercises")
          .select("routine_id")
          .eq("trainer_id", trainerId)
          .eq("exercise_id", exerciseId),
        (row: { routine_id: string }) => row.routine_id,
      );
      const routines =
        usedIn.length === 0
          ? []
          : await rowsOf(
              client
                .from("routines")
                .select("id, client_id")
                .eq("trainer_id", trainerId)
                .in("id", usedIn)
                .in("status", ["borrador", "activo"]),
              (row: { id: string; client_id: string }) => row,
            );

      const templates = await rowsOf(
        client.from("routine_templates").select("id, body").eq("trainer_id", trainerId),
        (row: { id: string; body: unknown }) => ({
          id: row.id,
          ...routineBodySchema.parse(row.body),
        }),
      );

      return {
        clientIds: [...new Set(routines.map((r) => r.client_id))],
        routineTemplateIds: routinesUsingExercise(templates, exerciseId).map((t) => t.id),
      };
    },

    // Archivar lo saca de la biblioteca y de las rutinas y plantillas que lo prescribían: lo hace la
    // función en una sola transacción (migración rpc, `archive_exercise`).
    archiveExercise: async (trainerId, exerciseId) => {
      const { error } = await client.rpc("archive_exercise", { p_exercise_id: exerciseId });
      raise(error);
      const archived = await readExercise(trainerId, exerciseId);
      if (!archived) throw notFoundError("Ejercicio");
      return archived;
    },
  };
}
