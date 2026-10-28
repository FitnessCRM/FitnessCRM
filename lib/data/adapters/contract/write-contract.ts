import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { DataPorts } from "@/lib/data/ports";

/**
 * Contrato de escritura que cumple cualquier adaptador (I1, I2, I3, I11, I13, I28 de
 * `lib/data/ports/index.ts`). Cada adaptador lo ejecuta contra su backend: el mock sobre su estado en
 * memoria y Supabase sobre el stack local. La suite no sabe cuál es; solo ve puertos y actores.
 */

export type ContractActor = "trainer" | "otherTrainer" | "client";

export interface ContractFixture {
  ports: DataPorts;
  /** Entrenador de la cartera bajo prueba, otro entrenador y el cliente de la cartera bajo prueba. */
  ids: { trainer: string; otherTrainer: string; client: string };
  /** Hace que los puertos actúen como ese actor a partir de ahora. */
  as: (actor: ContractActor) => Promise<void>;
  /** Devuelve el backend a como estaba. */
  dispose: () => Promise<void>;
}

const prescription = { sets: 3, repsMin: 8, repsMax: null, rir: "", rest: "", note: "" };

/** Ids de día y de línea son uuid: Supabase los guarda en columnas uuid. */
const routineWith = (exerciseId: string | null) => ({
  name: "Rutina de contrato",
  note: "",
  days: exerciseId
    ? [
        {
          id: crypto.randomUUID(),
          dayNumber: 1,
          label: "",
          exercises: [{ id: crypto.randomUUID(), exerciseId, prescription }],
        },
      ]
    : [],
});

const foodDraft = {
  name: "Avena de contrato",
  composition: { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
};

/**
 * Corre la suite contra un adaptador. `setup` monta el backend y devuelve el fixture; `enabled` la
 * salta cuando el backend no está disponible (p. ej. sin el stack local de Supabase).
 */
export function runWriteContract(
  label: string,
  setup: () => Promise<ContractFixture>,
  { enabled = true }: { enabled?: boolean } = {},
): void {
  const suite = enabled ? describe : describe.skip;

  suite(`contrato de escritura · ${label}`, () => {
    let fixture: ContractFixture;
    let ids: { exercise: string; otherExercise: string; otherClient: string };

    beforeAll(async () => {
      fixture = await setup();
      const { ports } = fixture;

      await fixture.as("trainer");
      const exercise = await ports.exercises.createExercise({
        trainerId: fixture.ids.trainer,
        name: "Sentadilla de contrato",
        muscleGroup: "",
        equipment: "",
        videoUrl: null,
        description: "",
      });

      await fixture.as("otherTrainer");
      const otherExercise = await ports.exercises.createExercise({
        trainerId: fixture.ids.otherTrainer,
        name: "Remo de contrato ajeno",
        muscleGroup: "",
        equipment: "",
        videoUrl: null,
        description: "",
      });
      const otherClient = await ports.clients.createClient({
        trainerId: fixture.ids.otherTrainer,
        firstName: "Otra",
        lastName: "Clienta",
        email: "otra-clienta@hector.test",
        phone: "",
        goal: "",
        level: "",
        initialNotes: "",
        startDate: "2026-08-01",
        reviewCadence: { everyDays: 7 },
      });

      ids = {
        exercise: exercise.id,
        otherExercise: otherExercise.id,
        otherClient: otherClient.id,
      };
    });

    afterAll(async () => {
      await fixture?.dispose();
    });

    it("I1, I2: un entrenador no lee ni escribe sobre un cliente de otra cartera", async () => {
      const { ports, ids: f } = fixture;
      await fixture.as("otherTrainer");

      expect(await ports.clients.getClient(f.otherTrainer, f.client)).toBeNull();
      await expect(
        ports.clients.updateClient(f.otherTrainer, f.client, { goal: "cambiado" }),
      ).rejects.toMatchObject({ code: "not_found" });
      // Sin líneas: que el ejercicio (de otra biblioteca) no tape la comprobación del cliente.
      await expect(
        ports.routines.createRoutine(f.otherTrainer, f.client, routineWith(null)),
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("I2: una rutina solo se crea para un cliente de su propio entrenador", async () => {
      const { ports, ids: f } = fixture;
      await fixture.as("trainer");

      await expect(
        ports.routines.createRoutine(f.trainer, ids.otherClient, routineWith(ids.exercise)),
      ).rejects.toMatchObject({ code: "not_found" });
    });

    it("I3: una rutina prescribe ejercicios de la biblioteca del entrenador, y solo activos", async () => {
      const { ports, ids: f } = fixture;
      await fixture.as("trainer");

      // Control: con un ejercicio propio activo, la escritura pasa.
      const ok = await ports.routines.createRoutine(f.trainer, f.client, routineWith(ids.exercise));
      expect(ok.days[0]?.exercises[0]?.exerciseId).toBe(ids.exercise);

      await expect(
        ports.routines.createRoutine(f.trainer, f.client, routineWith(ids.otherExercise)),
      ).rejects.toMatchObject({ code: "routine.exercise_not_in_library" });

      const archivable = await ports.exercises.createExercise({
        trainerId: f.trainer,
        name: "Curl de contrato",
        muscleGroup: "",
        equipment: "",
        videoUrl: null,
        description: "",
      });
      await ports.exercises.archiveExercise(f.trainer, archivable.id);
      await expect(
        ports.routines.createRoutine(f.trainer, f.client, routineWith(archivable.id)),
      ).rejects.toMatchObject({ code: "routine.exercise_not_in_library" });
    });

    it("I11: solo el cliente de la sesión cambia sus macros, y solo en su ficha", async () => {
      const { ports, ids: f } = fixture;

      await fixture.as("client");
      try {
        const changed = await ports.clients.setMacrosVisible(f.client, false);
        expect(changed.macrosVisible).toBe(false);
        await expect(ports.clients.setMacrosVisible(ids.otherClient, false)).rejects.toMatchObject({
          code: "not_found",
        });
      } finally {
        await ports.clients.setMacrosVisible(f.client, true);
      }
      // Qué puede hacer el entrenador con `setMacrosVisible` no está en el contrato: el dominio dice que
      // lo fija él (I11), y el mock y Supabase no coinciden. Queda fuera hasta decidirlo.
    });

    it("I13: archivar un ejercicio lo conserva; no se borra", async () => {
      const { ports, ids: f } = fixture;
      await fixture.as("trainer");

      const created = await ports.exercises.createExercise({
        trainerId: f.trainer,
        name: "Press de contrato",
        muscleGroup: "",
        equipment: "",
        videoUrl: null,
        description: "",
      });
      const archived = await ports.exercises.archiveExercise(f.trainer, created.id);
      expect(archived.status).toBe("archivado");
      expect(await ports.exercises.getExercise(f.trainer, created.id)).toMatchObject({
        status: "archivado",
      });
    });

    it("I28: un alimento propio no se lee ni se escribe desde otro entrenador", async () => {
      const { ports, ids: f } = fixture;
      await fixture.as("trainer");
      const food = await ports.ownFoods.createFood(f.trainer, foodDraft);

      await fixture.as("otherTrainer");
      expect(await ports.ownFoods.getFood(f.otherTrainer, food.id)).toBeNull();
      await expect(
        ports.ownFoods.updateFood(f.otherTrainer, food.id, foodDraft),
      ).rejects.toMatchObject({ code: "not_found" });
      await expect(ports.ownFoods.archiveFood(f.otherTrainer, food.id)).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });
}
