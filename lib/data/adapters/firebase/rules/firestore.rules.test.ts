import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Las reglas de `firestore.rules` contra el emulador: `pnpm test:rules` lo arranca. Un test por
 * invariante que las reglas defienden, con su caso negativo. Sin emulador el archivo se salta.
 */
const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

const T_A = "t-a";
const T_B = "t-b";

type Claims = { email?: string; email_verified?: boolean };

describe.skipIf(!emulatorHost)("reglas de seguridad de Firestore", () => {
  let env: RulesTestEnvironment;

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

  /** Una sesión con su correo (por defecto verificado), como la deja Firebase Auth. */
  const as = (uid: string, claims: Claims = {}) =>
    env.authenticatedContext(uid, { email_verified: true, ...claims }).firestore();
  const anon = () => env.unauthenticatedContext().firestore();

  const trainerA = () => as("u-ta");
  const trainerB = () => as("u-tb");
  const clientA = () => as("u-ca"); // c-a, de T_A
  const clientA2 = () => as("u-ca2"); // c-a2, de T_A

  const client = (id: string, trainerId: string, extra: object = {}) => ({
    id,
    trainerId,
    firstName: "Nombre",
    lastName: "Apellido",
    email: `${id}@hector.test`,
    status: "activo",
    startDate: "2026-09-01",
    createdAt: "2026-09-01T08:00:00.000Z",
    ...extra,
  });

  const food = (id: string, extra: object = {}) => ({
    id,
    trainerId: T_A,
    name: "Avena",
    composition: { kcal: 372, proteinG: 13.5, carbsG: 58.7, fatG: 7 },
    status: "activo",
    publishStatus: "publicado",
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:00:00.000Z",
    ...extra,
  });

  const review = (extra: object = {}) => ({
    id: "c-a_3",
    trainerId: T_A,
    clientId: "c-a",
    weekNumber: 3,
    window: { start: "2026-09-15", end: "2026-09-21" },
    status: "borrador",
    requirements: { measurementTypeIds: [], questionIds: [] },
    media: [],
    weightLogId: null,
    frozenWeight: null,
    measurements: [],
    responses: [],
    feedbackVideoUrl: null,
    feedbackNote: "",
    createdAt: "2026-09-15T08:00:00.000Z",
    submittedAt: null,
    viewedAt: null,
    reviewedAt: null,
    ...extra,
  });

  // Cada test parte de la misma cartera: dos entrenadores, sus clientes y un poco de todo.
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      const put = (path: string, id: string, data: object) => setDoc(doc(db, path, id), data);
      await Promise.all([
        put("trainers", T_A, {
          id: T_A,
          name: "A",
          email: "a@hector.test",
          timeZone: "Europe/Madrid",
        }),
        put("trainers", T_B, {
          id: T_B,
          name: "B",
          email: "b@hector.test",
          timeZone: "Europe/Madrid",
        }),
        put("users", "u-ta", {
          role: "trainer",
          trainerId: T_A,
          clientId: null,
          email: "a@hector.test",
        }),
        put("users", "u-tb", {
          role: "trainer",
          trainerId: T_B,
          clientId: null,
          email: "b@hector.test",
        }),
        put("users", "u-ca", {
          role: "client",
          trainerId: T_A,
          clientId: "c-a",
          email: "c-a@hector.test",
        }),
        put("users", "u-ca2", {
          role: "client",
          trainerId: T_A,
          clientId: "c-a2",
          email: "c-a2@hector.test",
        }),
        put("clients", "c-a", client("c-a", T_A)),
        put("clients", "c-a2", client("c-a2", T_A)),
        put("clients", "c-b", client("c-b", T_B)),
        put(
          "clients",
          "c-inv",
          client("c-inv", T_A, { status: "invitado", email: "Nuevo@Hector.test" }),
        ),
        put("memberships", "ms-a", {
          id: "ms-a",
          trainerId: T_A,
          clientId: "c-a",
          type: "mensual",
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          paymentStatus: "pagada",
          createdAt: "2026-09-01T08:00:00.000Z",
        }),
        put("exercises", "e-a", {
          id: "e-a",
          trainerId: T_A,
          name: "Sentadilla",
          status: "activo",
        }),
        put("exercises", "e-old", {
          id: "e-old",
          trainerId: T_A,
          name: "Viejo",
          status: "archivado",
        }),
        put("foods", "f-a", food("f-a")),
        put("foods", "f-old", food("f-old", { status: "archivado" })),
        put("routines", "r-act", {
          id: "r-act",
          trainerId: T_A,
          clientId: "c-a",
          status: "activo",
          days: [],
        }),
        put("routines", "r-draft", {
          id: "r-draft",
          trainerId: T_A,
          clientId: "c-a",
          status: "borrador",
          days: [],
        }),
        put("routines", "r-a2", {
          id: "r-a2",
          trainerId: T_A,
          clientId: "c-a2",
          status: "activo",
          days: [],
        }),
        put("menus", "m-act", {
          id: "m-act",
          trainerId: T_A,
          clientId: "c-a",
          status: "activo",
          dayType: "descanso",
        }),
        put("macroTargets", "mt-act", {
          id: "mt-act",
          trainerId: T_A,
          clientId: "c-a",
          status: "activo",
          dayType: "descanso",
        }),
        put("measurementTypes", "mt-free", {
          id: "mt-free",
          trainerId: T_A,
          label: "Cintura",
          unit: "cm",
          order: 0,
          status: "activa",
        }),
        put("measurementTypes", "mt-used", {
          id: "mt-used",
          trainerId: T_A,
          label: "Pecho",
          unit: "cm",
          order: 1,
          status: "activa",
          hasMeasurements: true,
        }),
        put("questions", "q-free", {
          id: "q-free",
          trainerId: T_A,
          prompt: "¿Qué tal?",
          format: { kind: "texto" },
          order: 0,
          status: "activa",
        }),
        put("questions", "q-used", {
          id: "q-used",
          trainerId: T_A,
          prompt: "Energía",
          format: { kind: "escala", min: 1, max: 5 },
          order: 1,
          status: "activa",
          hasResponses: true,
        }),
        put("reviews", "c-a_3", review()),
        put(
          "reviews",
          "c-a_2",
          review({
            id: "c-a_2",
            weekNumber: 2,
            status: "enviada",
            submittedAt: "2026-09-14T08:00:00.000Z",
          }),
        ),
        put(
          "reviews",
          "c-a_1",
          review({
            id: "c-a_1",
            weekNumber: 1,
            status: "vista",
            viewedAt: "2026-09-08T08:00:00.000Z",
          }),
        ),
        put("weightLogs", "c-a_2026-09-10", {
          id: "c-a_2026-09-10",
          trainerId: T_A,
          clientId: "c-a",
          date: "2026-09-10",
          weightKg: 70,
          note: "",
          createdAt: "2026-09-10T08:00:00.000Z",
        }),
      ]);
    });
  });

  describe("leer lo que no existe responde «no hay», no un permiso denegado", () => {
    it("a trainer asking for a missing record gets an empty answer", async () => {
      for (const [name, id] of [
        ["clients", "no-existe"],
        ["exercises", "no-existe"],
        ["foods", "no-existe"],
        ["memberships", "no-existe"],
        ["reviews", "no-existe"],
        ["weightLogs", "no-existe"],
      ] as const) {
        const snap = await assertSucceeds(getDoc(doc(trainerA(), name, id)));
        expect(snap.exists()).toBe(false);
      }
    });

    it("a client probes only ids that start with their own client id", async () => {
      const own = await assertSucceeds(getDoc(doc(clientA(), "weightLogs", "c-a_2026-01-01")));
      expect(own.exists()).toBe(false);
      await assertSucceeds(getDoc(doc(clientA(), "workoutLogs", "c-a_line_2026-01-01_1")));
      await assertSucceeds(getDoc(doc(clientA(), "reviews", "c-a_9")));
      // El de otro cliente, o una colección que el cliente no consulta por id, sigue denegado.
      await assertFails(getDoc(doc(clientA(), "weightLogs", "c-a2_2026-01-01")));
      await assertFails(getDoc(doc(clientA(), "clients", "no-existe")));
      await assertFails(getDoc(doc(clientA(), "exercises", "no-existe")));
    });

    it("nobody signed in probes anything, and an existing foreign record is still denied", async () => {
      await assertFails(getDoc(doc(anon(), "clients", "no-existe")));
      await assertFails(getDoc(doc(anon(), "weightLogs", "c-a_2026-01-01")));
      await assertFails(getDoc(doc(trainerB(), "clients", "c-a")));
    });
  });

  describe("I1, I2 · cada entrenador, solo lo suyo", () => {
    it("nobody signed in reads or writes anything", async () => {
      await assertFails(getDoc(doc(anon(), "clients", "c-a")));
      await assertFails(getDocs(collection(anon(), "exercises")));
      await assertFails(
        setDoc(doc(anon(), "exercises", "x"), { id: "x", trainerId: T_A, status: "activo" }),
      );
    });

    it("a trainer lists their own clients and gets refused on another's", async () => {
      await assertSucceeds(
        getDocs(query(collection(trainerA(), "clients"), where("trainerId", "==", T_A))),
      );
      await assertFails(
        getDocs(query(collection(trainerB(), "clients"), where("trainerId", "==", T_A))),
      );
      await assertFails(getDoc(doc(trainerB(), "clients", "c-a")));
      await assertFails(getDocs(collection(trainerA(), "clients"))); // sin filtro: no se puede probar que es suyo
    });

    it("trainer B cannot write on trainer A's data", async () => {
      await assertFails(updateDoc(doc(trainerB(), "clients", "c-a"), { goal: "x" }));
      await assertFails(updateDoc(doc(trainerB(), "exercises", "e-a"), { name: "x" }));
      await assertFails(
        setDoc(doc(trainerB(), "clients", "c-new"), client("c-new", T_A, { status: "invitado" })),
      );
    });

    it("a client is born invited, of the trainer who creates it, and never changes trainer", async () => {
      await assertSucceeds(
        setDoc(doc(trainerA(), "clients", "c-new"), client("c-new", T_A, { status: "invitado" })),
      );
      await assertFails(setDoc(doc(trainerA(), "clients", "c-act"), client("c-act", T_A))); // nace activo
      await assertFails(updateDoc(doc(trainerA(), "clients", "c-a"), { trainerId: T_B })); // I2
      await assertSucceeds(updateDoc(doc(trainerA(), "clients", "c-a"), { goal: "Fuerza" }));
    });

    it("a membership, plan or log is written only for a client of the same trainer", async () => {
      const ms = (clientId: string, trainerId = T_A) => ({
        id: "ms-new",
        trainerId,
        clientId,
        type: "mensual",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        paymentStatus: "no_pagada",
        createdAt: "2026-10-01T08:00:00.000Z",
      });
      await assertSucceeds(setDoc(doc(trainerA(), "memberships", "ms-new"), ms("c-a")));
      await assertFails(setDoc(doc(trainerA(), "memberships", "ms-new"), ms("c-b"))); // cliente de B
      await assertFails(setDoc(doc(trainerB(), "memberships", "ms-new"), ms("c-a", T_B)));
      await assertFails(
        setDoc(doc(trainerA(), "routines", "r-new"), {
          id: "r-new",
          trainerId: T_A,
          clientId: "c-b",
          status: "borrador",
          days: [],
        }),
      );
    });

    it("a client reads their own record and nothing of the other clients", async () => {
      await assertSucceeds(getDoc(doc(clientA(), "clients", "c-a")));
      await assertFails(getDoc(doc(clientA(), "clients", "c-a2")));
      await assertFails(getDoc(doc(clientA(), "clients", "c-b")));
      await assertFails(
        getDocs(query(collection(clientA(), "clients"), where("trainerId", "==", T_A))),
      );
    });
  });

  describe("I11 · el cliente lee su plan y nunca lo escribe", () => {
    it("reads what is published, not drafts", async () => {
      await assertSucceeds(getDoc(doc(clientA(), "routines", "r-act")));
      await assertFails(getDoc(doc(clientA(), "routines", "r-draft")));
      await assertFails(getDoc(doc(clientA(), "routines", "r-a2"))); // de otro cliente
      await assertSucceeds(
        getDocs(
          query(
            collection(clientA(), "routines"),
            where("trainerId", "==", T_A),
            where("clientId", "==", "c-a"),
            where("status", "in", ["activo", "archivado"]),
          ),
        ),
      );
      await assertSucceeds(getDoc(doc(clientA(), "menus", "m-act")));
      await assertSucceeds(getDoc(doc(clientA(), "macroTargets", "mt-act")));
    });

    it("cannot write routine, menu or macros, nor a membership", async () => {
      await assertFails(updateDoc(doc(clientA(), "routines", "r-act"), { status: "archivado" }));
      await assertFails(updateDoc(doc(clientA(), "menus", "m-act"), { status: "archivado" }));
      await assertFails(
        updateDoc(doc(clientA(), "macroTargets", "mt-act"), { status: "archivado" }),
      );
      await assertFails(
        updateDoc(doc(clientA(), "memberships", "ms-a"), { paymentStatus: "no_pagada" }),
      );
      await assertSucceeds(getDoc(doc(clientA(), "memberships", "ms-a")));
    });
  });

  describe("I13 · nada con histórico se borra", () => {
    it("neither side deletes clients, exercises, plans, catalogs, reviews or memberships", async () => {
      for (const [name, id] of [
        ["clients", "c-a"],
        ["exercises", "e-a"],
        ["routines", "r-act"],
        ["menus", "m-act"],
        ["macroTargets", "mt-act"],
        ["measurementTypes", "mt-free"],
        ["questions", "q-free"],
        ["reviews", "c-a_3"],
        ["memberships", "ms-a"],
      ] as const) {
        await assertFails(deleteDoc(doc(trainerA(), name, id)));
      }
    });

    it("an archived exercise does not come back to the library", async () => {
      await assertSucceeds(updateDoc(doc(trainerA(), "exercises", "e-a"), { status: "archivado" }));
      await assertFails(updateDoc(doc(trainerA(), "exercises", "e-old"), { status: "activo" }));
    });
  });

  describe("I15 · el formato de una pregunta, inmutable desde la primera respuesta", () => {
    it("the prompt is always editable, the format only while unanswered", async () => {
      const scale = { kind: "escala", min: 1, max: 10 };
      await assertSucceeds(updateDoc(doc(trainerA(), "questions", "q-used"), { prompt: "Nuevo" }));
      await assertFails(updateDoc(doc(trainerA(), "questions", "q-used"), { format: scale }));
      await assertSucceeds(updateDoc(doc(trainerA(), "questions", "q-free"), { format: scale }));
    });

    it("the trainer cannot lower the flag; the client can only raise it", async () => {
      await assertFails(updateDoc(doc(trainerA(), "questions", "q-used"), { hasResponses: false }));
      await assertFails(updateDoc(doc(trainerA(), "questions", "q-free"), { hasResponses: true }));
      await assertSucceeds(
        updateDoc(doc(clientA(), "questions", "q-free"), { hasResponses: true }),
      );
      await assertFails(updateDoc(doc(clientA(), "questions", "q-used"), { hasResponses: false }));
      await assertFails(updateDoc(doc(clientA(), "questions", "q-free"), { prompt: "Mío" }));
      await assertFails(updateDoc(doc(as("u-tb"), "questions", "q-free"), { hasResponses: true }));
    });
  });

  describe("I26 · la unidad de un tipo de medida, inmutable desde la primera medida", () => {
    it("the label is always editable, the unit only while nothing was measured", async () => {
      await assertSucceeds(
        updateDoc(doc(trainerA(), "measurementTypes", "mt-used"), { label: "Torso" }),
      );
      await assertFails(updateDoc(doc(trainerA(), "measurementTypes", "mt-used"), { unit: "mm" }));
      await assertSucceeds(
        updateDoc(doc(trainerA(), "measurementTypes", "mt-free"), { unit: "mm" }),
      );
    });

    it("the trainer cannot raise the flag; the client does, and cannot change anything else", async () => {
      await assertFails(
        updateDoc(doc(trainerA(), "measurementTypes", "mt-free"), { hasMeasurements: true }),
      );
      await assertSucceeds(
        updateDoc(doc(clientA(), "measurementTypes", "mt-free"), { hasMeasurements: true }),
      );
      await assertFails(updateDoc(doc(clientA(), "measurementTypes", "mt-used"), { unit: "mm" }));
      await assertFails(
        updateDoc(doc(clientA(), "measurementTypes", "mt-used"), { hasMeasurements: false }),
      );
    });
  });

  describe("I16, I22 · una revisión por cliente y semana, con la semana congelada", () => {
    it("the id is the client and the week, so there is room for only one", async () => {
      await env.withSecurityRulesDisabled((ctx) =>
        deleteDoc(doc(ctx.firestore(), "reviews", "c-a_3")),
      );
      await assertSucceeds(setDoc(doc(clientA(), "reviews", "c-a_3"), review()));
      await env.withSecurityRulesDisabled((ctx) =>
        deleteDoc(doc(ctx.firestore(), "reviews", "c-a_3")),
      );
      await assertFails(setDoc(doc(clientA(), "reviews", "otra-id"), review({ id: "otra-id" })));
      await assertFails(setDoc(doc(clientA(), "reviews", "c-a_4"), review({ id: "c-a_4" }))); // semana 3
      await assertFails(setDoc(doc(clientA2(), "reviews", "c-a_3"), review())); // de otro cliente
    });

    it("the client opens it empty: no feedback, no frozen weight, not already sent", async () => {
      await env.withSecurityRulesDisabled((ctx) =>
        deleteDoc(doc(ctx.firestore(), "reviews", "c-a_3")),
      );
      await assertFails(setDoc(doc(clientA(), "reviews", "c-a_3"), review({ status: "enviada" })));
      await assertFails(setDoc(doc(clientA(), "reviews", "c-a_3"), review({ feedbackNote: "ya" })));
      await assertFails(
        setDoc(
          doc(clientA(), "reviews", "c-a_3"),
          review({ frozenWeight: { weightKg: 70, date: "2026-09-16" } }),
        ),
      );
    });

    it("the week, the window and the requirements are written once", async () => {
      await assertFails(updateDoc(doc(clientA(), "reviews", "c-a_3"), { weekNumber: 9 }));
      await assertFails(
        updateDoc(doc(clientA(), "reviews", "c-a_3"), {
          window: { start: "2026-01-01", end: "2026-01-07" },
        }),
      );
      await assertFails(
        updateDoc(doc(clientA(), "reviews", "c-a_3"), {
          requirements: { measurementTypeIds: ["x"], questionIds: [] },
        }),
      );
    });
  });

  describe("I17, I24 · el cliente edita hasta que el entrenador la marca vista", () => {
    it("the client edits a draft and a sent review, and can send", async () => {
      await assertSucceeds(
        updateDoc(doc(clientA(), "reviews", "c-a_3"), { weightLogId: "c-a_2026-09-10" }),
      );
      await assertSucceeds(
        updateDoc(doc(clientA(), "reviews", "c-a_3"), {
          status: "enviada",
          submittedAt: "2026-09-20T08:00:00.000Z",
        }),
      );
      await assertSucceeds(updateDoc(doc(clientA(), "reviews", "c-a_2"), { measurements: [] }));
    });

    it("the client cannot go past sent, edit a seen review, take it back or write the trainer's part", async () => {
      await assertFails(updateDoc(doc(clientA(), "reviews", "c-a_3"), { status: "vista" }));
      await assertFails(updateDoc(doc(clientA(), "reviews", "c-a_1"), { measurements: [] })); // vista
      await assertFails(updateDoc(doc(clientA(), "reviews", "c-a_2"), { status: "borrador" }));
      await assertFails(
        updateDoc(doc(clientA(), "reviews", "c-a_2"), { feedbackNote: "me felicito" }),
      );
      await assertFails(
        updateDoc(doc(clientA(), "reviews", "c-a_2"), {
          frozenWeight: { weightKg: 60, date: "2026-09-10" },
        }),
      );
      await assertFails(updateDoc(doc(clientA2(), "reviews", "c-a_3"), { weightLogId: null })); // ajena
    });

    it("the trainer marks it seen with the frozen weight, then sends feedback, only forward", async () => {
      await assertSucceeds(
        updateDoc(doc(trainerA(), "reviews", "c-a_2"), {
          status: "vista",
          viewedAt: "2026-09-15T09:00:00.000Z",
          frozenWeight: { weightKg: 70, date: "2026-09-10" },
        }),
      );
      await assertSucceeds(
        updateDoc(doc(trainerA(), "reviews", "c-a_1"), {
          status: "revisada",
          reviewedAt: "2026-09-16T09:00:00.000Z",
          feedbackNote: "Bien",
          feedbackVideoUrl: "https://example.com/v",
        }),
      );
      await assertFails(updateDoc(doc(trainerA(), "reviews", "c-a_2"), { status: "enviada" }));
      await assertFails(updateDoc(doc(trainerA(), "reviews", "c-a_3"), { status: "vista" })); // un borrador no se ve
    });

    it("the trainer cannot rewrite what the client answered, and another trainer cannot touch it", async () => {
      await assertFails(
        updateDoc(doc(trainerA(), "reviews", "c-a_2"), {
          status: "vista",
          measurements: [
            { id: "m1", measurementTypeId: "mt-free", value: 1, label: "x", unit: "cm" },
          ],
        }),
      );
      await assertFails(updateDoc(doc(trainerB(), "reviews", "c-a_2"), { status: "vista" }));
      await assertFails(getDoc(doc(trainerB(), "reviews", "c-a_2")));
      await assertFails(getDoc(doc(clientA2(), "reviews", "c-a_2")));
    });
  });

  describe("I18, I23 · un pesaje por cliente y día, en kg", () => {
    const log = (date: string, extra: object = {}) => ({
      id: `c-a_${date}`,
      trainerId: T_A,
      clientId: "c-a",
      date,
      weightKg: 70.5,
      note: "",
      createdAt: "2026-09-12T08:00:00.000Z",
      ...extra,
    });

    it("the id is the client and the day, so a second save lands on the same document", async () => {
      await assertSucceeds(
        setDoc(doc(clientA(), "weightLogs", "c-a_2026-09-12"), log("2026-09-12")),
      );
      await assertSucceeds(
        setDoc(doc(clientA(), "weightLogs", "c-a_2026-09-10"), {
          ...log("2026-09-10"),
          weightKg: 69.9,
          createdAt: "2026-09-10T08:00:00.000Z",
        }),
      );
      await assertFails(
        setDoc(doc(clientA(), "weightLogs", "otro-id"), { ...log("2026-09-12"), id: "otro-id" }),
      );
      await assertFails(
        setDoc(
          doc(clientA(), "weightLogs", "c-a_2026-09-13"),
          log("2026-09-12", { id: "c-a_2026-09-13" }),
        ),
      );
    });

    it("the weight is a number between 0 and 400", async () => {
      await assertFails(
        setDoc(doc(clientA(), "weightLogs", "c-a_2026-09-12"), log("2026-09-12", { weightKg: 0 })),
      );
      await assertFails(
        setDoc(
          doc(clientA(), "weightLogs", "c-a_2026-09-12"),
          log("2026-09-12", { weightKg: 401 }),
        ),
      );
      await assertFails(
        setDoc(
          doc(clientA(), "weightLogs", "c-a_2026-09-12"),
          log("2026-09-12", { weightKg: "70" }),
        ),
      );
    });

    it("only the client writes their own, the trainer reads and nobody else sees them", async () => {
      await assertFails(setDoc(doc(trainerA(), "weightLogs", "c-a_2026-09-12"), log("2026-09-12")));
      await assertFails(
        setDoc(doc(clientA2(), "weightLogs", "c-a_2026-09-12"), log("2026-09-12")), // pesaje de otro cliente
      );
      await assertSucceeds(getDoc(doc(trainerA(), "weightLogs", "c-a_2026-09-10")));
      await assertFails(getDoc(doc(trainerB(), "weightLogs", "c-a_2026-09-10")));
      await assertFails(getDoc(doc(clientA2(), "weightLogs", "c-a_2026-09-10")));
      await assertSucceeds(deleteDoc(doc(clientA(), "weightLogs", "c-a_2026-09-10")));
    });
  });

  describe("registros de entreno", () => {
    const set = (extra: object = {}) => ({
      id: "c-a_line1_2026-09-12_1",
      trainerId: T_A,
      clientId: "c-a",
      exerciseId: "e-a",
      routineId: "r-act",
      routineDayExerciseId: "line1",
      date: "2026-09-12",
      setNumber: 1,
      weightKg: 40,
      reps: 8,
      createdAt: "2026-09-12T08:00:00.000Z",
      ...extra,
    });

    it("a set is unique by line, day and number, and goes on a routine of the same client", async () => {
      await assertSucceeds(setDoc(doc(clientA(), "workoutLogs", "c-a_line1_2026-09-12_1"), set()));
      await assertFails(setDoc(doc(clientA(), "workoutLogs", "x"), set({ id: "x" })));
      await assertFails(
        setDoc(doc(clientA(), "workoutLogs", "c-a_line1_2026-09-12_1"), set({ routineId: "r-a2" })),
      );
      await assertFails(
        setDoc(doc(clientA(), "workoutLogs", "c-a_line1_2026-09-12_1"), set({ reps: -1 })),
      );
      await assertFails(setDoc(doc(trainerA(), "workoutLogs", "c-a_line1_2026-09-12_1"), set()));
    });
  });

  describe("I21 · una membresía registra el estado de pago, nunca importes", () => {
    it("rejects any field beyond the model, and a client of another trainer", async () => {
      const base = {
        id: "ms-x",
        trainerId: T_A,
        clientId: "c-a",
        type: "mensual",
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        paymentStatus: "pagada",
        createdAt: "2026-10-01T08:00:00.000Z",
      };
      await assertSucceeds(setDoc(doc(trainerA(), "memberships", "ms-x"), base));
      await assertFails(
        setDoc(doc(trainerA(), "memberships", "ms-y"), { ...base, id: "ms-y", amount: 50 }),
      );
      await assertFails(
        setDoc(doc(trainerA(), "memberships", "ms-z"), {
          ...base,
          id: "ms-z",
          paymentStatus: "50€",
        }),
      );
      await assertSucceeds(
        updateDoc(doc(trainerA(), "memberships", "ms-a"), { paymentStatus: "no_pagada" }),
      );
      await assertFails(updateDoc(doc(trainerA(), "memberships", "ms-a"), { clientId: "c-b" }));
    });
  });

  describe("I28 · la copia propia de los alimentos, solo de su entrenador", () => {
    it("the owner reads, creates and edits; another trainer neither reads nor writes", async () => {
      await assertSucceeds(getDoc(doc(trainerA(), "foods", "f-a")));
      await assertSucceeds(
        getDocs(query(collection(trainerA(), "foods"), where("trainerId", "==", T_A))),
      );
      await assertSucceeds(setDoc(doc(trainerA(), "foods", "f-new"), food("f-new")));
      await assertSucceeds(
        updateDoc(doc(trainerA(), "foods", "f-a"), {
          name: "Avena fina",
          publishStatus: "pendiente",
          updatedAt: "2026-10-01T08:00:00.000Z",
        }),
      );

      await assertFails(getDoc(doc(trainerB(), "foods", "f-a")));
      await assertFails(
        getDocs(query(collection(trainerB(), "foods"), where("trainerId", "==", T_A))),
      );
      await assertFails(updateDoc(doc(trainerB(), "foods", "f-a"), { name: "x" }));
      await assertFails(
        setDoc(doc(trainerB(), "foods", "f-b"), food("f-b")), // a nombre de otro entrenador
      );
      await assertFails(getDocs(collection(anon(), "foods")));
    });

    it("no client reads it: their menu already carries the frozen copy (I29)", async () => {
      await assertFails(getDoc(doc(clientA(), "foods", "f-a")));
      await assertFails(
        getDocs(query(collection(clientA(), "foods"), where("trainerId", "==", T_A))),
      );
      await assertFails(setDoc(doc(clientA(), "foods", "f-c"), food("f-c")));
    });

    it("keeps its identity and creation date, and is born active", async () => {
      await assertFails(updateDoc(doc(trainerA(), "foods", "f-a"), { trainerId: T_B }));
      await assertFails(updateDoc(doc(trainerA(), "foods", "f-a"), { id: "otro" }));
      await assertFails(
        updateDoc(doc(trainerA(), "foods", "f-a"), { createdAt: "2026-10-01T08:00:00.000Z" }),
      );
      await assertFails(setDoc(doc(trainerA(), "foods", "f-x"), food("f-y")));
      await assertFails(
        setDoc(doc(trainerA(), "foods", "f-z"), food("f-z", { status: "archivado" })),
      );
    });

    it("is archived, an archived one never comes back, and nobody deletes (I13)", async () => {
      await assertSucceeds(updateDoc(doc(trainerA(), "foods", "f-a"), { status: "archivado" }));
      await assertFails(updateDoc(doc(trainerA(), "foods", "f-old"), { status: "activo" }));
      await assertFails(deleteDoc(doc(trainerA(), "foods", "f-old")));
      await assertFails(deleteDoc(doc(trainerB(), "foods", "f-old")));
      await assertFails(deleteDoc(doc(clientA(), "foods", "f-old")));
    });
  });

  describe("el entrenador y sus plantillas", () => {
    it("updates name and time zone, not the email; the client reads the trainer", async () => {
      await assertSucceeds(
        updateDoc(doc(trainerA(), "trainers", T_A), { timeZone: "Europe/London" }),
      );
      await assertFails(updateDoc(doc(trainerA(), "trainers", T_A), { email: "otro@hector.test" }));
      await assertFails(updateDoc(doc(trainerB(), "trainers", T_A), { name: "x" }));
      await assertSucceeds(getDoc(doc(clientA(), "trainers", T_A)));
      await assertFails(getDoc(doc(trainerB(), "trainers", T_A)));
    });

    it("templates are the trainer's alone, and can be deleted: nothing hangs from them", async () => {
      await assertSucceeds(
        setDoc(doc(trainerA(), "routineTemplates", "tp"), {
          id: "tp",
          trainerId: T_A,
          name: "P",
          days: [],
        }),
      );
      await assertFails(getDoc(doc(clientA(), "routineTemplates", "tp")));
      await assertFails(getDoc(doc(trainerB(), "routineTemplates", "tp")));
      await assertSucceeds(deleteDoc(doc(trainerA(), "routineTemplates", "tp")));
    });
  });

  describe("cuentas · users/{uid} y la invitación", () => {
    const link = (
      uid: string,
      extra: object = {},
      claims: Claims = { email: "nuevo@hector.test" },
    ) =>
      setDoc(doc(as(uid, claims), "users", uid), {
        role: "client",
        trainerId: T_A,
        clientId: "c-inv",
        email: "Nuevo@Hector.test",
        ...extra,
      });

    it("a verified email equal to the invited client's links the account, case aside", async () => {
      await assertSucceeds(link("u-new"));
    });

    it("refuses an unverified email, another email, an already active client or a made-up role", async () => {
      await assertFails(link("u-new", {}, { email: "nuevo@hector.test", email_verified: false }));
      await assertFails(link("u-new", {}, { email: "otro@hector.test" }));
      await assertFails(
        link("u-new", { clientId: "c-a", email: "c-a@hector.test" }, { email: "c-a@hector.test" }),
      );
      await assertFails(link("u-new", { role: "trainer" }));
      await assertFails(link("u-new", { trainerId: T_B }));
      await assertFails(link("u-new", { extra: true }));
      await assertFails(
        setDoc(doc(anon(), "users", "u-new"), {
          role: "client",
          trainerId: T_A,
          clientId: "c-inv",
          email: "x",
        }),
      );
    });

    it("an account reads only its own link and cannot edit or delete it", async () => {
      await assertSucceeds(getDoc(doc(clientA(), "users", "u-ca")));
      await assertFails(getDoc(doc(clientA(), "users", "u-ca2")));
      await assertFails(getDoc(doc(clientA(), "users", "u-ta")));
      await assertFails(updateDoc(doc(clientA(), "users", "u-ca"), { clientId: "c-a2" }));
      await assertFails(updateDoc(doc(trainerA(), "users", "u-ta"), { trainerId: T_B }));
      await assertFails(deleteDoc(doc(clientA(), "users", "u-ca")));
    });

    it("the invitation recipient reads the invited record and only moves it to active", async () => {
      const recipient = () => as("u-new", { email: "nuevo@hector.test" });
      await assertSucceeds(getDoc(doc(recipient(), "clients", "c-inv")));
      await assertFails(getDoc(doc(recipient(), "clients", "c-a")));
      await assertFails(
        updateDoc(doc(recipient(), "clients", "c-inv"), { status: "activo", goal: "x" }),
      );
      await assertFails(
        updateDoc(doc(recipient(), "clients", "c-inv"), { status: "dado_de_baja" }),
      );
      await assertSucceeds(updateDoc(doc(recipient(), "clients", "c-inv"), { status: "activo" }));
    });

    it("an unverified or foreign account neither reads nor activates the invitation", async () => {
      const unverified = as("u-x", { email: "nuevo@hector.test", email_verified: false });
      const stranger = as("u-y", { email: "otro@hector.test" });
      await assertFails(getDoc(doc(unverified, "clients", "c-inv")));
      await assertFails(updateDoc(doc(unverified, "clients", "c-inv"), { status: "activo" }));
      await assertFails(getDoc(doc(stranger, "clients", "c-inv")));
      await assertFails(updateDoc(doc(stranger, "clients", "c-inv"), { status: "activo" }));
    });

    it("accepting is one batch: link the account and activate the client together", async () => {
      const db = as("u-new", { email: "nuevo@hector.test" });
      const batch = writeBatch(db);
      batch.set(doc(db, "users", "u-new"), {
        role: "client",
        trainerId: T_A,
        clientId: "c-inv",
        email: "Nuevo@Hector.test",
      });
      batch.update(doc(db, "clients", "c-inv"), { status: "activo" });
      await assertSucceeds(batch.commit());
    });
  });
});
