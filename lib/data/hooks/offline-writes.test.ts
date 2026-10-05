import {
  dehydrate,
  hydrate,
  MutationObserver,
  onlineManager,
  QueryClient,
} from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { createMockPorts } from "@/lib/data/adapters/mock";
import { createDemoState } from "@/lib/data/adapters/mock/store";
import { registerOfflineWrites, writeKeys } from "./offline-writes";

const TODAY = "2026-08-29";
const TRAINER = "t-adrian";
const MARTA = "c-marta";

function setup() {
  const ports = createMockPorts({ state: createDemoState(TODAY), today: TODAY });
  const client = new QueryClient();
  registerOfflineWrites(client, ports);
  return { ports, client };
}

/** Lo que hace `useMutation` con la clave de una escritura, sin React. */
function enqueue(client: QueryClient, key: readonly unknown[], variables: unknown) {
  const observer = new MutationObserver<unknown, Error, unknown>(client, { mutationKey: key });
  void observer.mutate(variables).catch(() => {});
}

/** Lo que manda la pantalla: la serie sin los campos que pone el puerto. */
function withoutIds(log: object) {
  return Object.fromEntries(Object.entries(log).filter(([k]) => k !== "id" && k !== "createdAt"));
}

afterEach(() => onlineManager.setOnline(true));

describe("offline write queue", () => {
  it("holds a workout log while offline and sends it once when the connection returns", async () => {
    const { ports, client } = setup();
    const [existing] = await ports.workoutLogs.listWorkoutLogs(TRAINER, MARTA);
    const input = withoutIds(existing!);
    const before = await ports.workoutLogs.listWorkoutLogs(TRAINER, MARTA);

    onlineManager.setOnline(false);
    enqueue(client, writeKeys.saveWorkoutLog, { ...input, reps: 99 });
    await new Promise((r) => setTimeout(r, 20));
    expect(client.getMutationCache().getAll()[0]!.state.isPaused).toBe(true);
    expect(
      (await ports.workoutLogs.listWorkoutLogs(TRAINER, MARTA)).find((l) => l.id === existing!.id)!
        .reps,
    ).toBe(existing!.reps);

    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    const after = await ports.workoutLogs.listWorkoutLogs(TRAINER, MARTA);
    expect(after).toHaveLength(before.length);
    expect(after.find((l) => l.id === existing!.id)!.reps).toBe(99);
  });

  it("runs an edit and a later delete of the same set in the order they were made", async () => {
    const { ports, client } = setup();
    const [existing] = await ports.workoutLogs.listWorkoutLogs(TRAINER, MARTA);
    const id = existing!.id;
    const input = withoutIds(existing!);

    onlineManager.setOnline(false);
    enqueue(client, writeKeys.saveWorkoutLog, { ...input, reps: 50 });
    enqueue(client, writeKeys.deleteWorkoutLog, {
      trainerId: TRAINER,
      clientId: MARTA,
      workoutLogId: id,
    });
    await new Promise((r) => setTimeout(r, 20));

    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await new Promise((r) => setTimeout(r, 50));
    expect((await ports.workoutLogs.listWorkoutLogs(TRAINER, MARTA)).some((l) => l.id === id)).toBe(
      false,
    );
  });

  it("restores a queued write from disk after a reload and does not duplicate it", async () => {
    const { ports, client } = setup();
    const before = await ports.weightLogs.listWeightLogs(TRAINER, MARTA);
    const date = "2026-08-28"; // sin pesaje en la demo

    onlineManager.setOnline(false);
    enqueue(client, writeKeys.saveWeightLog, {
      trainerId: TRAINER,
      clientId: MARTA,
      date,
      weightKg: 63,
      note: "",
    });
    await new Promise((r) => setTimeout(r, 20));
    // Lo que se guarda en IndexedDB: solo la mutación pausada, con sus variables.
    const saved = JSON.parse(JSON.stringify(dehydrate(client)));
    expect(saved.mutations).toHaveLength(1);

    // La pestaña se recarga: cliente nuevo, funciones registradas de nuevo, estado restaurado.
    const reloaded = new QueryClient();
    registerOfflineWrites(reloaded, ports);
    hydrate(reloaded, saved);
    onlineManager.setOnline(true);
    await reloaded.resumePausedMutations();
    await reloaded.resumePausedMutations();

    const after = await ports.weightLogs.listWeightLogs(TRAINER, MARTA);
    expect(after).toHaveLength(before.length + 1);
    expect(after.filter((w) => w.date === date)).toHaveLength(1);
  });
});
