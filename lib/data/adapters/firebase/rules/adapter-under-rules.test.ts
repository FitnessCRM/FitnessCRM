import { readFileSync } from "node:fs";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, type Firestore } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { menuBodySchema, routineBodySchema } from "@/lib/domain";
import { createDemoState, type MockState } from "../../mock";
import { CLIENT_IDS, TRAINER_ID } from "../../mock/demo-data/common";
import { createMeasurementTypePort, createQuestionnairePort } from "../catalogs";
import { createClientPort } from "../clients";
import { createFirebaseContext } from "../context";
import { createExercisePort } from "../exercises";
import { COLLECTIONS } from "../helpers";
import { createWeightLogPort, createWorkoutLogPort } from "../logs";
import { createMembershipPort } from "../memberships";
import { createMacroTargetsPort, createMenuPort, createRoutinePort } from "../plans";
import { createTemplatePort } from "../templates";
import { createTrainerPort } from "../trainer";

/**
 * Los puertos del adaptador ejecutados contra las reglas de seguridad, con la identidad de cada
 * cuenta: lo que el entrenador y el cliente hacen de verdad desde la app. Si una consulta o una
 * escritura del adaptador no es lo que las reglas permiten, falla aquí y no en producción.
 * `pnpm test:rules` lo ejecuta junto a las reglas.
 */
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const TODAY = "2026-10-03";
const NOW = "2026-10-03T10:00:00.000Z";

describe.skipIf(!emulatorHost)("el adaptador de Firebase bajo las reglas de seguridad", () => {
  let env: RulesTestEnvironment;
  let state: MockState;

  beforeAll(async () => {
    const [host = "127.0.0.1", port = "8080"] = (emulatorHost as string).split(":");
    env = await initializeTestEnvironment({
      projectId: "demo-hector",
      firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
    });
  });

  afterAll(async () => {
    await env.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    state = createDemoState(TODAY);
    await env.withSecurityRulesDisabled(async (admin) => {
      const db = admin.firestore();
      const seed = (name: string, items: { id: string }[]) =>
        Promise.all(items.map((item) => setDoc(doc(db, name, item.id), item)));
      await seed(COLLECTIONS.trainers, state.trainers);
      await seed(COLLECTIONS.clients, state.clients);
      await seed(COLLECTIONS.memberships, state.memberships);
      await seed(COLLECTIONS.exercises, state.exercises);
      await seed(COLLECTIONS.routines, state.routines);
      await seed(COLLECTIONS.routineTemplates, state.routineTemplates);
      await seed(COLLECTIONS.menus, state.menus);
      await seed(COLLECTIONS.macroTargets, state.macroTargets);
      await seed(COLLECTIONS.menuTemplates, state.menuTemplates);
      await seed(COLLECTIONS.measurementTypes, state.measurementTypes);
      await seed(COLLECTIONS.questions, state.questions);
      await seed(COLLECTIONS.reviews, state.reviews);
      await seed(COLLECTIONS.weightLogs, state.weightLogs);
      await seed(COLLECTIONS.workoutLogs, state.workoutLogs);
      // Una cuenta por persona: el entrenador y cada cliente de la demo.
      await setDoc(doc(db, "users", "u-trainer"), {
        role: "trainer",
        trainerId: TRAINER_ID,
        clientId: null,
        email: "adrian@hector.app",
      });
      await Promise.all(
        state.clients.map((c) =>
          setDoc(doc(db, "users", `u-${c.id}`), {
            role: "client",
            trainerId: TRAINER_ID,
            clientId: c.id,
            email: c.email,
          }),
        ),
      );
    });
  });

  /** El contexto del adaptador con la identidad de una cuenta, tal como lo monta la app. */
  const as = (uid: string) => {
    // El paquete de pruebas de reglas tipa su Firestore como el compat; en ejecución es el modular.
    const db = env
      .authenticatedContext(uid, { email_verified: true })
      .firestore() as unknown as Firestore;
    return createFirebaseContext(db, { now: () => NOW });
  };
  const trainer = () => as("u-trainer");
  const client = (id: string) => as(`u-${id}`);

  describe("como entrenador", () => {
    it("reads and writes the trainer and the clients", async () => {
      const ctx = trainer();
      expect((await createTrainerPort(ctx).getTrainer(TRAINER_ID))?.id).toBe(TRAINER_ID);
      expect(
        (await createTrainerPort(ctx).updateTrainer(TRAINER_ID, { name: "Adrián V." })).name,
      ).toBe("Adrián V.");

      const clients = createClientPort(ctx);
      expect((await clients.listClients(TRAINER_ID)).length).toBe(state.clients.length);
      const page = await clients.listClientsTracking(TRAINER_ID, {
        filter: "todos",
        today: TODAY,
        page: 0,
        pageSize: 3,
      });
      expect(page.rows).toHaveLength(3);
      expect(page.counts.todos).toBe(state.clients.length);

      const base = state.clients[0]!;
      const created = await clients.createClient({ ...base, email: "nueva@email.com" });
      expect(created.status).toBe("invitado");
      expect((await clients.updateClient(TRAINER_ID, created.id, { goal: "Fuerza" })).goal).toBe(
        "Fuerza",
      );
    });

    it("reads and writes memberships", async () => {
      const memberships = createMembershipPort(trainer());
      const table = await memberships.listMembershipsWithClients(TRAINER_ID, {
        filter: "all",
        today: TODAY,
        page: 0,
        pageSize: 50,
      });
      expect(table.rows.length).toBeGreaterThan(3);
      const created = await memberships.createMembership({
        trainerId: TRAINER_ID,
        clientId: CLIENT_IDS.marta,
        type: "mensual",
        startDate: "2026-11-01",
        endDate: "2026-11-30",
        paymentStatus: "no_pagada",
      });
      const updated = await memberships.updateMembership(TRAINER_ID, created.id, {
        paymentStatus: "pagada",
      });
      expect(updated.paymentStatus).toBe("pagada");
      expect(
        (await memberships.listClientMemberships(TRAINER_ID, CLIENT_IDS.marta)).length,
      ).toBeGreaterThan(1);
    });

    it("manages the library: create, edit, usage and archive an exercise", async () => {
      const exercises = createExercisePort(trainer());
      const created = await exercises.createExercise({
        trainerId: TRAINER_ID,
        name: "Dominadas lastradas",
        muscleGroup: "",
        equipment: "",
        videoUrl: null,
        description: "",
      });
      expect(
        (await exercises.updateExercise(TRAINER_ID, created.id, { name: "Dominadas" })).name,
      ).toBe("Dominadas");
      expect(await exercises.getExerciseUsage(TRAINER_ID, created.id)).toEqual({
        clientIds: [],
        routineTemplateIds: [],
      });
      expect((await exercises.archiveExercise(TRAINER_ID, created.id)).status).toBe("archivado");

      // Y uno que ya está en rutinas y plantillas: el archivado las edita todas en un lote.
      const used = state.routines.find((r) => r.status !== "archivado")!.days[0]!.exercises[0]!
        .exerciseId;
      expect((await exercises.archiveExercise(TRAINER_ID, used)).status).toBe("archivado");
    });

    it("manages the catalogs: create, edit, reorder, archive", async () => {
      const types = createMeasurementTypePort(trainer());
      const created = await types.createMeasurementType(TRAINER_ID, { label: "Muslo", unit: "cm" });
      await types.updateMeasurementType(TRAINER_ID, created.id, { unit: "mm" });
      const all = await types.listMeasurementTypes(TRAINER_ID);
      await types.reorderMeasurementTypes(TRAINER_ID, all.map((t) => t.id).reverse());
      await types.archiveMeasurementType(TRAINER_ID, created.id);
      await types.unarchiveMeasurementType(TRAINER_ID, created.id);

      const questions = createQuestionnairePort(trainer());
      const question = await questions.createQuestion(TRAINER_ID, {
        prompt: "¿Qué tal el descanso?",
        format: { kind: "escala", min: 1, max: 5 },
      });
      await questions.updateQuestion(TRAINER_ID, question.id, { prompt: "¿Cómo has descansado?" });
      await questions.archiveQuestion(TRAINER_ID, question.id);
      expect(await questions.questionHasResponses(TRAINER_ID, question.id)).toBe(false);
    });
  });

  describe("como entrenador · planes y plantillas", () => {
    const marta = CLIENT_IDS.marta;
    const activeRoutine = () =>
      state.routines.find((r) => r.clientId === marta && r.status === "activo")!;

    it("creates, revises and activates a routine, archiving the previous one", async () => {
      const routines = createRoutinePort(trainer());
      const body = routineBodySchema.parse(activeRoutine());
      const draft = await routines.createRoutine(TRAINER_ID, marta, body);
      await routines.updateRoutine(TRAINER_ID, draft.id, { ...body, name: "Otra" });
      const activated = await routines.activateRoutine(TRAINER_ID, draft.id);
      expect(activated.status).toBe("activo");
      const revised = await routines.reviseRoutine(TRAINER_ID, activated.id, body);
      expect(revised.status).toBe("borrador");
      const all = await routines.listRoutines(TRAINER_ID, marta);
      expect(all.filter((r) => r.status === "activo")).toHaveLength(1);
    });

    it("sets macros and manages menus with their day-type set", async () => {
      const macros = createMacroTargetsPort(trainer());
      const set = await macros.setMacroTargets(TRAINER_ID, marta, "descanso", {
        kcal: 2100,
        proteinG: 170,
        carbsG: 200,
        fatG: 70,
      });
      expect(set.status).toBe("activo");

      const menus = createMenuPort(trainer());
      const active = state.menus.find((m) => m.clientId === marta && m.status === "activo")!;
      const draft = await menus.reviseMenu(TRAINER_ID, active.id, menuBodySchema.parse(active));
      const activated = await menus.activateMenus(TRAINER_ID, marta, active.dayType);
      expect(activated.map((m) => m.id)).toEqual([draft.id]);
      await menus.archiveMenu(TRAINER_ID, draft.id);
      const created = await menus.createMenu(TRAINER_ID, marta, menuBodySchema.parse(active));
      await menus.updateMenu(TRAINER_ID, created.id, {
        ...menuBodySchema.parse(active),
        name: "Otro",
      });
    });

    it("saves, duplicates, assigns and deletes templates", async () => {
      const templates = createTemplatePort(trainer());
      const source = state.routineTemplates[0]!;
      const { id: _id, createdAt: _c, updatedAt: _u, ...input } = source;
      void [_id, _c, _u];
      const saved = await templates.saveRoutineTemplate({ ...input, name: "Mía" });
      await templates.saveRoutineTemplate({ ...input, id: saved.id, name: "Mía v2" });
      const copy = await templates.duplicateRoutineTemplate(TRAINER_ID, saved.id, "Copia");
      await templates.assignRoutineTemplate(TRAINER_ID, CLIENT_IDS.jorge, copy.id);
      const menuTemplate = state.menuTemplates[0]!;
      const assigned = await templates.assignMenuTemplate(
        TRAINER_ID,
        CLIENT_IDS.jorge,
        menuTemplate.id,
      );
      expect(assigned.length).toBe(menuTemplate.menus.length);
      expect((await templates.listRoutineTemplates(TRAINER_ID)).length).toBeGreaterThan(1);
      expect((await templates.listMenuTemplates(TRAINER_ID)).length).toBeGreaterThan(0);
      await templates.deleteRoutineTemplate(TRAINER_ID, copy.id);
    });
  });

  describe("como cliente", () => {
    it("logs a weight, replaces it on the same day and deletes it", async () => {
      const ctx = client(CLIENT_IDS.marta);
      const weights = createWeightLogPort(ctx);
      const base = {
        trainerId: TRAINER_ID,
        clientId: CLIENT_IDS.marta,
        date: TODAY,
        weightKg: 70,
        note: "",
      };
      const first = await weights.saveWeightLog(base);
      const second = await weights.saveWeightLog({ ...base, weightKg: 69.5 });
      expect(second.id).toBe(first.id);
      expect(
        (await weights.listWeightLogs(TRAINER_ID, CLIENT_IDS.marta)).some((w) => w.id === first.id),
      ).toBe(true);
      await weights.deleteWeightLog(TRAINER_ID, first.id);
    });

    it("cannot log a weight for another client", async () => {
      const weights = createWeightLogPort(client(CLIENT_IDS.marta));
      await expect(
        weights.saveWeightLog({
          trainerId: TRAINER_ID,
          clientId: CLIENT_IDS.jorge,
          date: TODAY,
          weightKg: 80,
          note: "",
        }),
      ).rejects.toThrow();
    });

    it("logs and retires a set on the active routine", async () => {
      const routine = state.routines.find(
        (r) => r.clientId === CLIENT_IDS.marta && r.status === "activo",
      )!;
      const line = routine.days[0]!.exercises[0]!;
      const workouts = createWorkoutLogPort(client(CLIENT_IDS.marta));
      const saved = await workouts.saveWorkoutLog({
        trainerId: TRAINER_ID,
        clientId: CLIENT_IDS.marta,
        exerciseId: line.exerciseId,
        routineId: routine.id,
        routineDayExerciseId: line.id,
        date: TODAY,
        setNumber: 9,
        weightKg: 40,
        reps: 8,
      });
      expect(
        (await workouts.listWorkoutLogs(TRAINER_ID, CLIENT_IDS.marta)).some(
          (l) => l.id === saved.id,
        ),
      ).toBe(true);
      await workouts.deleteWorkoutLog(TRAINER_ID, saved.id);
    });

    it("reads the published plan and never a draft or the whole history", async () => {
      const marta = CLIENT_IDS.marta;
      const ctx = client(marta);
      const routine = await createRoutinePort(ctx).getActiveRoutine(TRAINER_ID, marta);
      expect(routine?.status).toBe("activo");
      expect(
        (await createMacroTargetsPort(ctx).listMacroTargets(TRAINER_ID, marta)).length,
      ).toBeGreaterThan(0);
      expect((await createMenuPort(ctx).listActiveMenus(TRAINER_ID, marta)).length).toBeGreaterThan(
        0,
      );
      // Los borradores y el histórico completo son del entrenador.
      await expect(createRoutinePort(ctx).listRoutines(TRAINER_ID, marta)).rejects.toThrow();
      await expect(createMenuPort(ctx).listMenus(TRAINER_ID, marta)).rejects.toThrow();
    });

    it("cannot write a plan", async () => {
      const marta = CLIENT_IDS.marta;
      const body = routineBodySchema.parse(
        state.routines.find((r) => r.clientId === marta && r.status === "activo")!,
      );
      await expect(
        createRoutinePort(client(marta)).createRoutine(TRAINER_ID, marta, body),
      ).rejects.toThrow();
      await expect(
        createMacroTargetsPort(client(marta)).setMacroTargets(TRAINER_ID, marta, "descanso", {
          kcal: 1,
          proteinG: 1,
          carbsG: 1,
          fatG: 1,
        }),
      ).rejects.toThrow();
    });

    it("reads their own record and nobody else's", async () => {
      const clients = createClientPort(client(CLIENT_IDS.marta));
      expect((await clients.getClient(TRAINER_ID, CLIENT_IDS.marta))?.id).toBe(CLIENT_IDS.marta);
      await expect(clients.getClient(TRAINER_ID, CLIENT_IDS.jorge)).rejects.toThrow();
      await expect(clients.listClients(TRAINER_ID)).rejects.toThrow();
    });
  });
});
