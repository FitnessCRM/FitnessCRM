import { doc, setDoc, type Firestore } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMeasurementTypePort, createQuestionnairePort } from "./catalogs";
import { createFirebaseContext, type FirebaseContext } from "./context";
import { createFirestore } from "./config";
import { createExercisePort } from "./exercises";
import { COLLECTIONS, FLAGS } from "./helpers";
import { createWeightLogPort, createWorkoutLogPort } from "./logs";
import { createTrainerPort } from "./trainer";
import { createDemoState, type MockState } from "../mock";
import { CLIENT_IDS, TRAINER_ID } from "../mock/demo-data/common";

/**
 * Contra el emulador de Firestore: `pnpm test:firebase` lo arranca y lo para. Sin él
 * (`FIRESTORE_EMULATOR_HOST` sin definir) el archivo entero se salta, para que `pnpm test` siga
 * siendo de dominio y no dependa de Java.
 */
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const NOW = "2026-10-03T10:00:00.000Z";
const TODAY = "2026-10-03";
const STRANGER = "t-otra";

describe.skipIf(!emulatorHost)("adaptador de Firebase · sección 1", () => {
  let db: Firestore;
  let ctx: FirebaseContext;
  let state: MockState;

  beforeAll(() => {
    const [host = "127.0.0.1", port = "8080"] = (emulatorHost as string).split(":");
    db = createFirestore(
      { projectId: "demo-hector" },
      { appName: "firebase-adapter-test", emulator: { host, port: Number(port) } },
    );
  });

  // Cada test parte de la demo recién sembrada: sembrar reemplaza los documentos que el anterior tocó.
  beforeEach(async () => {
    ctx = createFirebaseContext(db, { now: () => NOW });
    state = createDemoState(TODAY);
    await seed(db, COLLECTIONS.trainers, state.trainers);
    await seed(db, COLLECTIONS.clients, state.clients);
    await seed(db, COLLECTIONS.exercises, state.exercises);
    await seed(db, COLLECTIONS.routines, state.routines);
    await seed(db, COLLECTIONS.routineTemplates, state.routineTemplates);
    await seed(db, COLLECTIONS.measurementTypes, state.measurementTypes);
    await seed(db, COLLECTIONS.questions, state.questions);
    await seed(db, COLLECTIONS.reviews, state.reviews);
  });

  it("trainer: reads and updates only its own, a stranger gets nothing to update", async () => {
    const trainers = createTrainerPort(ctx);
    expect((await trainers.getTrainer(TRAINER_ID))?.id).toBe(TRAINER_ID);
    const changed = await trainers.updateTrainer(TRAINER_ID, { timeZone: "Europe/London" });
    expect(changed.timeZone).toBe("Europe/London");
    await expect(trainers.updateTrainer(STRANGER, { name: "X" })).rejects.toMatchObject({
      code: "not_found",
    });
    await trainers.updateTrainer(TRAINER_ID, { timeZone: "Europe/Madrid" });
  });

  it("I23: a second weight on the same day updates the log in place and keeps the note", async () => {
    const weights = createWeightLogPort(ctx);
    const base = { trainerId: TRAINER_ID, clientId: CLIENT_IDS.marta, date: TODAY };
    const first = await weights.saveWeightLog({ ...base, weightKg: 70, note: "en ayunas" });
    const second = await weights.saveWeightLog({ ...base, weightKg: 69.5, note: "" });
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.note).toBe("en ayunas");
    const sameDay = (await weights.listWeightLogs(TRAINER_ID, CLIENT_IDS.marta)).filter(
      (w) => w.date === TODAY,
    );
    expect(sameDay).toHaveLength(1);
    expect(sameDay[0]?.weightKg).toBe(69.5);
  });

  it("I27 and I1/I2: no future date, and never on another trainer's client", async () => {
    const weights = createWeightLogPort(ctx);
    const base = { trainerId: TRAINER_ID, clientId: CLIENT_IDS.marta, weightKg: 70, note: "" };
    await expect(weights.saveWeightLog({ ...base, date: "2026-10-04" })).rejects.toMatchObject({
      code: "weight_log.future_date",
    });
    await expect(
      weights.saveWeightLog({ ...base, trainerId: STRANGER, date: TODAY }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("I25: a weight used by a sent review is not deletable; one used by a draft is", async () => {
    const weights = createWeightLogPort(ctx);
    await seed(db, COLLECTIONS.weightLogs, state.weightLogs);
    const sent = state.reviews.find((r) => r.weightLogId && r.status !== "borrador");
    const draft = state.reviews.find((r) => r.weightLogId && r.status === "borrador");
    if (sent?.weightLogId) {
      await expect(weights.deleteWeightLog(TRAINER_ID, sent.weightLogId)).rejects.toMatchObject({
        code: "weight_log.in_review",
      });
    }
    if (draft?.weightLogId) {
      await weights.deleteWeightLog(TRAINER_ID, draft.weightLogId);
      const logs = await weights.listWeightLogs(TRAINER_ID, draft.clientId);
      expect(logs.some((w) => w.id === draft.weightLogId)).toBe(false);
    }
  });

  it("workout log: a set is replaced, and only on a routine of that client", async () => {
    const workouts = createWorkoutLogPort(ctx);
    const routine = state.routines.find((r) => r.clientId === CLIENT_IDS.marta)!;
    const line = need(routine.days[0]?.exercises[0]);
    const base = {
      trainerId: TRAINER_ID,
      clientId: CLIENT_IDS.marta,
      exerciseId: line.exerciseId,
      routineId: routine.id,
      routineDayExerciseId: line.id,
      date: TODAY,
      setNumber: 1,
      weightKg: 40,
      reps: 8,
    };
    const first = await workouts.saveWorkoutLog(base);
    const again = await workouts.saveWorkoutLog({ ...base, reps: 10 });
    expect(again.id).toBe(first.id);
    expect(again.createdAt).toBe(first.createdAt);
    await expect(
      workouts.saveWorkoutLog({ ...base, clientId: CLIENT_IDS.jorge }),
    ).rejects.toMatchObject({ code: "not_found" });
    await workouts.deleteWorkoutLog(TRAINER_ID, again.id);
    await expect(workouts.deleteWorkoutLog(TRAINER_ID, again.id)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("I26: the unit of a measured type is locked, its label is not", async () => {
    const types = createMeasurementTypePort(ctx);
    const type = need((await types.listMeasurementTypes(TRAINER_ID))[0]);
    expect(await types.measurementTypeHasMeasurements(TRAINER_ID, type.id)).toBe(false);
    await setDoc(
      doc(db, COLLECTIONS.measurementTypes, type.id),
      { [FLAGS.hasMeasurements]: true },
      { merge: true },
    );
    expect(await types.measurementTypeHasMeasurements(TRAINER_ID, type.id)).toBe(true);
    await expect(
      types.updateMeasurementType(TRAINER_ID, type.id, { unit: "zzz" }),
    ).rejects.toMatchObject({ code: "measurement_type.unit_locked" });
    const renamed = await types.updateMeasurementType(TRAINER_ID, type.id, { label: "Nueva" });
    expect(renamed.label).toBe("Nueva");
  });

  it("I15: the format of an answered question is locked, its prompt is not", async () => {
    const questions = createQuestionnairePort(ctx);
    const question = need((await questions.listQuestions(TRAINER_ID))[0]);
    await setDoc(
      doc(db, COLLECTIONS.questions, question.id),
      { [FLAGS.hasResponses]: true },
      { merge: true },
    );
    const otherFormat =
      question.format.kind === "texto"
        ? ({ kind: "escala", min: 1, max: 5 } as const)
        : ({ kind: "texto" } as const);
    await expect(
      questions.updateQuestion(TRAINER_ID, question.id, { format: otherFormat }),
    ).rejects.toMatchObject({ code: "question.format_locked" });
    const reworded = await questions.updateQuestion(TRAINER_ID, question.id, {
      prompt: "¿Qué tal?",
    });
    expect(reworded.prompt).toBe("¿Qué tal?");
  });

  it("catalog: archive and unarchive keep the entry, reorder follows the given ids", async () => {
    const types = createMeasurementTypePort(ctx);
    const list = await types.listMeasurementTypes(TRAINER_ID);
    const a = need(list[0]);
    const b = need(list[1]);
    await types.archiveMeasurementType(TRAINER_ID, a.id);
    expect((await types.listMeasurementTypes(TRAINER_ID)).find((t) => t.id === a.id)?.status).toBe(
      "archivada",
    );
    await types.unarchiveMeasurementType(TRAINER_ID, a.id);
    const reordered = await types.reorderMeasurementTypes(TRAINER_ID, [b.id, a.id]);
    expect(reordered.slice(0, 2).map((t) => t.id)).toEqual([b.id, a.id]);
    await expect(types.archiveMeasurementType(STRANGER, a.id)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("exercises: a stranger cannot read one, and archiving removes it from live plans", async () => {
    const exercises = createExercisePort(ctx);
    const routine = state.routines.find(
      (r) => r.status !== "archivado" && r.days[0]?.exercises[0],
    )!;
    const exerciseId = need(routine.days[0]?.exercises[0]).exerciseId;
    expect(await exercises.getExercise(STRANGER, exerciseId)).toBeNull();
    const usage = await exercises.getExerciseUsage(TRAINER_ID, exerciseId);
    expect(usage.clientIds).toContain(routine.clientId);
    const archived = await exercises.archiveExercise(TRAINER_ID, exerciseId);
    expect(archived.status).toBe("archivado");
    expect((await exercises.listExercises(TRAINER_ID)).some((e) => e.id === exerciseId)).toBe(
      false,
    );
    expect((await exercises.getExerciseUsage(TRAINER_ID, exerciseId)).clientIds).toEqual([]);
  });
});

/** Falla con claridad si la demo no trae lo que el test da por hecho. */
function need<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("La demo no tiene el dato que este test necesita");
  return value;
}

async function seed<T extends { id: string }>(db: Firestore, name: string, items: T[]) {
  await Promise.all(items.map((item) => setDoc(doc(db, name, item.id), item)));
}
