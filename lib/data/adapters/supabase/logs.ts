import type { WeightLogPort, WorkoutLogPort } from "@/lib/data/ports";
import {
  assertWeightLogDate,
  assertWeightLogDeletable,
  civilDateInTimeZone,
  weightLogSchema,
  workoutLogSchema,
  type Review,
} from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise } from "./errors";
import { readClient, rowsOf, timeZoneOf } from "./queries";
import {
  WEIGHT_LOG_COLUMNS,
  WORKOUT_LOG_COLUMNS,
  weightLogFromRow,
  workoutLogFromRow,
  type WeightLogRow,
  type WorkoutLogRow,
} from "./review-rows";

/**
 * Pesajes y series: los escribe el cliente, directamente, mientras su ficha está activa (RLS). El
 * entrenador solo los lee. Las reglas que la base comprueba por disparador (I25, I27) se comprueban
 * también aquí con el dominio, para que el error llegue con su código.
 */
export function createWeightLogPort(client: SupabaseClient): WeightLogPort {
  return {
    listWeightLogs: (trainerId, clientId) =>
      rowsOf(
        client
          .from("weight_logs")
          .select(WEIGHT_LOG_COLUMNS)
          .eq("trainer_id", trainerId)
          .eq("client_id", clientId)
          .order("log_date", { ascending: true })
          .order("created_at", { ascending: true }),
        (row: WeightLogRow) => weightLogFromRow(row),
      ),

    // Un pesaje por cliente y día (I23): si ya hay uno, se actualiza conservando su id y su fecha de
    // alta; una nota vacía conserva la anterior.
    saveWeightLog: async (input) => {
      const data = weightLogSchema.omit({ id: true, createdAt: true }).parse(input);
      const { startDate } = await readClient(client, data.trainerId, data.clientId);
      const timeZone = await timeZoneOf(client, data.trainerId);
      assertWeightLogDate(data.date, {
        today: civilDateInTimeZone(new Date(), timeZone),
        startDate,
      });

      const { data: existing, error } = await client
        .from("weight_logs")
        .select(WEIGHT_LOG_COLUMNS)
        .eq("trainer_id", data.trainerId)
        .eq("client_id", data.clientId)
        .eq("log_date", data.date)
        .maybeSingle();
      raise(error);

      if (existing) {
        const current = existing as WeightLogRow;
        const { data: row, error: updateError } = await client
          .from("weight_logs")
          .update({ weight_kg: data.weightKg, note: data.note || current.note })
          .eq("id", current.id)
          .select(WEIGHT_LOG_COLUMNS)
          .single();
        raise(updateError);
        return weightLogFromRow(row as WeightLogRow);
      }

      const { data: row, error: insertError } = await client
        .from("weight_logs")
        .insert({
          trainer_id: data.trainerId,
          client_id: data.clientId,
          log_date: data.date,
          weight_kg: data.weightKg,
          note: data.note,
        })
        .select(WEIGHT_LOG_COLUMNS)
        .single();
      raise(insertError);
      return weightLogFromRow(row as WeightLogRow);
    },

    // I25: un pesaje que usa una revisión enviada no se borra. Las revisiones que lo apuntan y son
    // borradores pierden el peso (la clave foránea lo pone a nulo).
    deleteWeightLog: async (trainerId, weightLogId) => {
      const { data: log, error } = await client
        .from("weight_logs")
        .select(WEIGHT_LOG_COLUMNS)
        .eq("trainer_id", trainerId)
        .eq("id", weightLogId)
        .maybeSingle();
      raise(error);
      if (!log) throw notFoundError("Pesaje");

      const { data: pointing, error: pointingError } = await client
        .from("reviews")
        .select("id, status, weight_log_id")
        .eq("weight_log_id", weightLogId);
      raise(pointingError);
      assertWeightLogDeletable(
        weightLogId,
        ((pointing ?? []) as { status: Review["status"]; weight_log_id: string }[]).map((r) => ({
          status: r.status,
          weightLogId: r.weight_log_id,
        })),
      );

      const { error: deleteError } = await client
        .from("weight_logs")
        .delete()
        .eq("trainer_id", trainerId)
        .eq("id", weightLogId);
      raise(deleteError);
    },
  };
}

export function createWorkoutLogPort(client: SupabaseClient): WorkoutLogPort {
  return {
    listWorkoutLogs: (trainerId, clientId) =>
      rowsOf(
        client
          .from("workout_logs")
          .select(WORKOUT_LOG_COLUMNS)
          .eq("trainer_id", trainerId)
          .eq("client_id", clientId),
        (row: WorkoutLogRow) => workoutLogFromRow(row),
      ),

    // Una serie por línea, fecha y número (índice `workout_logs_series_key`): guardarla de nuevo la
    // sustituye.
    saveWorkoutLog: async (input) => {
      const data = workoutLogSchema.omit({ id: true, createdAt: true }).parse(input);

      // La serie se registra sobre una rutina de ese cliente y de ese entrenador.
      const { data: routine, error } = await client
        .from("routines")
        .select("client_id")
        .eq("trainer_id", data.trainerId)
        .eq("id", data.routineId)
        .maybeSingle();
      raise(error);
      if (!routine || (routine as { client_id: string }).client_id !== data.clientId) {
        throw notFoundError("Rutina");
      }

      const { data: row, error: upsertError } = await client
        .from("workout_logs")
        .upsert(
          {
            trainer_id: data.trainerId,
            client_id: data.clientId,
            exercise_id: data.exerciseId,
            routine_id: data.routineId,
            routine_day_exercise_id: data.routineDayExerciseId,
            log_date: data.date,
            set_number: data.setNumber,
            weight_kg: data.weightKg,
            reps: data.reps,
          },
          { onConflict: "client_id,routine_day_exercise_id,log_date,set_number" },
        )
        .select(WORKOUT_LOG_COLUMNS)
        .single();
      raise(upsertError);
      return workoutLogFromRow(row as WorkoutLogRow);
    },

    deleteWorkoutLog: async (trainerId, workoutLogId) => {
      const { data, error } = await client
        .from("workout_logs")
        .delete()
        .eq("trainer_id", trainerId)
        .eq("id", workoutLogId)
        .select("id")
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Serie");
    },
  };
}
