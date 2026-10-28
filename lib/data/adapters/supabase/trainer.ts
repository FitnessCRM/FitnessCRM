import type { TrainerPort } from "@/lib/data/ports";
import { DomainError, trainerSchema, type Trainer } from "@/lib/domain";
import type { SupabaseClient } from "./client";

/** Fila de `public.trainers` tal como la devuelve PostgREST. */
export interface TrainerRow {
  id: string;
  name: string;
  email: string;
  time_zone: string;
  created_at: string;
}

/**
 * Fila → dominio. `timestamptz` llega con desfase (`+00:00`), y el dominio pide ISO con `Z`: se
 * normaliza con `toISOString`.
 */
export function trainerFromRow(row: TrainerRow): Trainer {
  return trainerSchema.parse({
    id: row.id,
    name: row.name,
    email: row.email,
    timeZone: row.time_zone,
    createdAt: new Date(row.created_at).toISOString(),
  });
}

/** Lo que el entrenador puede cambiar de sí mismo; el resto de la fila no se toca desde la app. */
const editableTrainer = trainerSchema.pick({ name: true, timeZone: true }).partial();

export function createTrainerPort(client: SupabaseClient): TrainerPort {
  return {
    getTrainer: async (trainerId) => {
      const { data, error } = await client
        .from("trainers")
        .select("id, name, email, time_zone, created_at")
        .eq("id", trainerId)
        .maybeSingle();
      if (error) throw error;
      return data ? trainerFromRow(data as TrainerRow) : null;
    },
    updateTrainer: async (trainerId, changes) => {
      const parsed = editableTrainer.parse(changes);
      const row = {
        ...(parsed.name !== undefined && { name: parsed.name }),
        ...(parsed.timeZone !== undefined && { time_zone: parsed.timeZone }),
      };
      const { data, error } = await client
        .from("trainers")
        .update(row)
        .eq("id", trainerId)
        .select("id, name, email, time_zone, created_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new DomainError("not_found", "Entrenador no encontrado");
      return trainerFromRow(data as TrainerRow);
    },
  };
}
