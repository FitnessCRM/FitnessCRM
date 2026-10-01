import { describe, expect, it } from "vitest";
import {
  DomainError,
  clientSchema,
  exerciseSchema,
  macroTargetsSchema,
  measurementTypeSchema,
  membershipSchema,
  menuSchema,
  menuTemplateSchema,
  questionnaireQuestionSchema,
  reviewSchema,
  routineSchema,
  routineTemplateSchema,
  trainerSchema,
  weightLogSchema,
  workoutLogSchema,
  isReviewComplete,
  weekNumber,
} from "@/lib/domain";
import { createDemoState, createMockPorts, demoToday } from "./index";

const TRAINER = "t-adrian";
const MARTA = "c-marta";
/** Fecha fija para que las expectativas sean deterministas; los datos se generan relativos a ella. */
const TODAY = "2026-08-29";
const ports = () => createMockPorts({ today: TODAY, now: () => `${TODAY}T10:00:00Z` });

describe("demo data", () => {
  it("validates against every domain schema", () => {
    const s = createDemoState(TODAY);
    const check = (schema: { parse: (v: unknown) => unknown }, items: unknown[]) =>
      items.forEach((i) => schema.parse(i));
    check(trainerSchema, s.trainers);
    check(clientSchema, s.clients);
    check(membershipSchema, s.memberships);
    check(exerciseSchema, s.exercises);
    check(routineSchema, s.routines);
    check(macroTargetsSchema, s.macroTargets);
    check(menuSchema, s.menus);
    check(routineTemplateSchema, s.routineTemplates);
    check(menuTemplateSchema, s.menuTemplates);
    check(measurementTypeSchema, s.measurementTypes);
    check(questionnaireQuestionSchema, s.questions);
    check(reviewSchema, s.reviews);
    check(weightLogSchema, s.weightLogs);
    check(workoutLogSchema, s.workoutLogs);
  });

  it("only references existing exercises from routines (I3) and existing weight logs from reviews (I9)", () => {
    const s = createDemoState(TODAY);
    const exerciseIds = new Set(s.exercises.map((e) => e.id));
    for (const r of [...s.routines, ...s.routineTemplates]) {
      for (const d of r.days)
        for (const e of d.exercises) expect(exerciseIds.has(e.exerciseId)).toBe(true);
    }
    const logIds = new Set(s.weightLogs.map((w) => w.id));
    for (const r of s.reviews) if (r.weightLogId) expect(logIds.has(r.weightLogId)).toBe(true);
  });

  it("requires of each review only what existed when it was opened (I5)", () => {
    const s = createDemoState(TODAY);
    const typeIds = new Set(s.measurementTypes.map((t) => t.id));
    const questionIds = new Set(s.questions.map((q) => q.id));
    /** La de Sara se envió a propósito sin medidas: es el caso «Parcial» de la demo. */
    const PARTIAL_ON_PURPOSE = "rv-sara-s3";
    expect(s.reviews.some((r) => r.id === PARTIAL_ON_PURPOSE)).toBe(true);

    for (const review of s.reviews) {
      for (const id of review.requirements.measurementTypeIds) expect(typeIds.has(id)).toBe(true);
      for (const id of review.requirements.questionIds) expect(questionIds.has(id)).toBe(true);
      // Nadie puede responder una pregunta que no existía al abrir la revisión: exigirla dejaba
      // en «Parcial» revisiones cerradas semanas antes.
      const missing = isReviewComplete(review).missing;
      expect(missing.questionIds).toEqual([]);
      if (review.id !== PARTIAL_ON_PURPOSE) expect(missing.measurementTypeIds).toEqual([]);
    }
  });

  it("matches the demo: Marta's five weekly weights and waist/hip/thigh deltas", async () => {
    const p = ports();
    const reviews = await p.reviews.listClientReviews(TRAINER, MARTA);
    const logs = await p.weightLogs.listWeightLogs(TRAINER, MARTA);
    const kg = (r: (typeof reviews)[number]) => logs.find((l) => l.id === r.weightLogId)?.weightKg;
    const byWeek = [...reviews].sort((a, b) => a.weekNumber - b.weekNumber);
    expect(byWeek.map(kg)).toEqual([65.5, 64.8, 64.3, 63.9, 63.4]);
    const m = (r: (typeof reviews)[number], id: string) =>
      r.measurements.find((x) => x.measurementTypeId === id)?.value;
    expect([m(byWeek[0]!, "mt-cintura"), m(byWeek[4]!, "mt-cintura")]).toEqual([74, 71]);
    expect([m(byWeek[0]!, "mt-cadera"), m(byWeek[4]!, "mt-cadera")]).toEqual([98, 96.5]);
    expect(m(byWeek[4]!, "mt-muslo")! - m(byWeek[0]!, "mt-muslo")!).toBeCloseTo(0.8);
    expect(logs).toHaveLength(13);
  });

  it("is relative to today: any date keeps Marta in S5, Jorge in S8, Sara in S3 and David in S11", async () => {
    for (const today of [demoToday(), "2027-03-14", "2026-12-31"]) {
      const p = createMockPorts({ today });
      const trainer = (await p.trainer.getTrainer(TRAINER))!;
      const weeks = Object.fromEntries(
        (await p.clients.listClients(TRAINER)).map((c) => [
          c.id,
          weekNumber(c.startDate, today, trainer.timeZone),
        ]),
      );
      expect(weeks).toMatchObject({ "c-marta": 5, "c-jorge": 8, "c-sara": 3, "c-david": 11 });
      const s = createDemoState(today);
      for (const r of s.reviews) {
        reviewSchema.parse(r);
        const log = s.weightLogs.find((w) => w.id === r.weightLogId)!;
        expect(log.date >= r.window.start && log.date <= r.window.end).toBe(true);
      }
      s.memberships.forEach((m) => membershipSchema.parse(m));
      expect((await p.reviews.listSubmittedReviews(TRAINER)).map((r) => r.id)).toEqual([
        "rv-marta-s5",
        "rv-jorge-s8",
        "rv-sara-s3",
      ]);
    }
  });
});

describe("client tracking (server-side)", () => {
  const query = { filter: "todos", today: TODAY, page: 0, pageSize: 2 } as const;

  it("paginates, puts new reviews first and counts without paginating", async () => {
    const p = ports();
    const first = await p.clients.listClientsTracking(TRAINER, query);
    const second = await p.clients.listClientsTracking(TRAINER, { ...query, page: 1 });
    expect(first.rows).toHaveLength(2);
    expect(first.rows.every((r) => r.newReviewWeek !== null)).toBe(true);
    expect(first.counts.todos).toBe(
      first.counts.activo + first.counts.invitado + first.counts.dado_de_baja,
    );
    const ids = [...first.rows, ...second.rows].map((r) => r.client.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("filters by status and by a single client", async () => {
    const p = ports();
    const active = await p.clients.listClientsTracking(TRAINER, {
      ...query,
      filter: "activo",
      pageSize: 50,
    });
    expect(active.rows.every((r) => r.client.status === "activo")).toBe(true);
    const marta = await p.clients.listClientsTracking(TRAINER, { ...query, clientId: "c-marta" });
    expect(marta.rows.map((r) => r.client.id)).toEqual(["c-marta"]);
    expect(marta.counts.todos).toBe(1);
  });

  it("returns the active routine name as the plan", async () => {
    const p = ports();
    const { rows } = await p.clients.listClientsTracking(TRAINER, {
      ...query,
      clientId: "c-marta",
    });
    const routine = await p.routines.getActiveRoutine(TRAINER, "c-marta");
    expect(rows[0]!.routineName).toBe(routine?.name ?? null);
    expect(rows[0]!.routineName).not.toBeNull();
  });

  it("is tenant-scoped (I1)", async () => {
    const page = await ports().clients.listClientsTracking("t-otro", query);
    expect(page.rows).toEqual([]);
    expect(page.counts.todos).toBe(0);
  });
});

describe("client signup", () => {
  it("always creates the client as invitado, even if the input carries another status", async () => {
    const p = ports().clients;
    const input = {
      trainerId: TRAINER,
      firstName: "Sara",
      lastName: "Peña",
      email: "sara@example.com",
      phone: "",
      goal: "",
      level: "",
      initialNotes: "",
      startDate: TODAY,
      reviewCadence: { everyDays: 7 },
    };
    const created = await p.createClient({ ...input, status: "activo" } as typeof input);
    expect(created.status).toBe("invitado");
    expect((await p.getClient(TRAINER, created.id))?.status).toBe("invitado");
  });
});

describe("tenancy (I1)", () => {
  it("returns nothing for another trainer", async () => {
    const p = ports();
    expect(await p.clients.listClients("t-otro")).toEqual([]);
    expect(await p.clients.getClient("t-otro", MARTA)).toBeNull();
    expect(await p.reviews.listSubmittedReviews("t-otro")).toEqual([]);
    expect(
      (
        await p.memberships.listMembershipsWithClients("t-otro", {
          filter: "all",
          today: TODAY,
          page: 0,
          pageSize: 50,
        })
      ).rows,
    ).toEqual([]);
    await expect(p.exercises.archiveExercise("t-otro", "ex-press-banca")).rejects.toThrow(
      DomainError,
    );
  });

  it("returns copies: mutating a result does not touch the store", async () => {
    const p = ports();
    const [first] = await p.clients.listClients(TRAINER);
    first!.firstName = "Hackeada";
    expect((await p.clients.listClients(TRAINER))[0]?.firstName).toBe("Marta");
  });
});

describe("memberships", () => {
  const query = { filter: "all", today: TODAY, page: 0, pageSize: 4 } as const;

  it("pages on the server, by client name and then latest start first, with counts for the whole set", async () => {
    const p = ports().memberships;
    const total = createDemoState(TODAY).memberships.length;
    const first = await p.listMembershipsWithClients(TRAINER, query);
    const second = await p.listMembershipsWithClients(TRAINER, { ...query, page: 1 });
    expect(first.rows).toHaveLength(4);
    expect(first.counts.all).toBe(total);
    const rows = [...first.rows, ...second.rows];
    const ids = rows.map((r) => r.membership.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = rows.map((r) => `${r.client.firstName} ${r.client.lastName}`);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "es")));
    const marta = rows.filter((r) => r.client.id === MARTA).map((r) => r.membership.startDate);
    expect(marta).toEqual([...marta].sort().reverse());
  });

  it("filters by client and by cut, and the counts follow the client but not the cut", async () => {
    const p = ports().memberships;
    const all = { ...query, pageSize: 50, clientId: MARTA };
    const marta = await p.listMembershipsWithClients(TRAINER, all);
    expect(marta.rows.every((r) => r.client.id === MARTA)).toBe(true);
    expect(marta.counts.all).toBe(marta.rows.length);
    const unpaid = await p.listMembershipsWithClients(TRAINER, { ...all, filter: "unpaid" });
    expect(unpaid.rows.every((r) => r.membership.paymentStatus === "no_pagada")).toBe(true);
    expect(unpaid.counts).toEqual(marta.counts);
    expect(unpaid.rows.length).toBe(marta.counts.unpaid);
  });

  it("flags an overlap even when its pair is on another page", async () => {
    const p = ports().memberships;
    const all = { ...query, pageSize: 50, clientId: MARTA };
    const { rows } = await p.listMembershipsWithClients(TRAINER, all);
    const latest = rows[0]!;
    const oldest = rows.at(-1)!;
    await p.updateMembership(TRAINER, oldest.membership.id, {
      endDate: latest.membership.endDate,
    });
    const page = await p.listMembershipsWithClients(TRAINER, { ...all, pageSize: 1 });
    expect(page.rows).toHaveLength(1);
    expect(page.overlappingIds).toContain(page.rows[0]!.membership.id);
  });

  it("edits type, dates and payment status through the domain schema, and refuses end before start", async () => {
    const p = ports();
    const { rows } = await p.memberships.listMembershipsWithClients(TRAINER, query);
    const membership = rows[0]!.membership;
    const saved = await p.memberships.updateMembership(TRAINER, membership.id, {
      type: "anual",
      paymentStatus: membership.paymentStatus === "pagada" ? "no_pagada" : "pagada",
    });
    expect(saved).toMatchObject({
      id: membership.id,
      clientId: membership.clientId,
      type: "anual",
    });
    await expect(
      p.memberships.updateMembership(TRAINER, membership.id, { endDate: "2000-01-01" }),
    ).rejects.toThrow();
    await expect(
      p.memberships.updateMembership("t-otro", membership.id, { type: "mensual" }),
    ).rejects.toThrow(DomainError);
  });
});

describe("flows", () => {
  it("registering a weight on a day that already has one updates it in place (I23)", async () => {
    const p = ports();
    const before = await p.weightLogs.listWeightLogs(TRAINER, MARTA);
    const date = "2026-08-30"; // sin pesaje en la demo
    const base = { trainerId: TRAINER, clientId: MARTA, date };
    const first = await p.weightLogs.saveWeightLog({ ...base, weightKg: 63.0, note: "En ayunas" });
    const second = await p.weightLogs.saveWeightLog({ ...base, weightKg: 62.8, note: "" });
    const after = await p.weightLogs.listWeightLogs(TRAINER, MARTA);
    const sameDay = after.filter((w) => w.date === date);
    expect(sameDay).toHaveLength(1);
    expect(after).toHaveLength(before.length + 1);
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(sameDay[0]).toMatchObject({ weightKg: 62.8, note: "En ayunas" });
    const third = await p.weightLogs.saveWeightLog({
      ...base,
      weightKg: 62.7,
      note: "Tras correr",
    });
    expect(third.note).toBe("Tras correr");
  });

  it("keeps a review's weight link valid when its weight log is updated (I9, I23)", async () => {
    const p = ports();
    const s = createDemoState(TODAY);
    const linked = s.reviews.find((r) => r.weightLogId)!;
    const log = s.weightLogs.find((w) => w.id === linked.weightLogId)!;
    const updated = await p.weightLogs.saveWeightLog({
      trainerId: log.trainerId,
      clientId: log.clientId,
      date: log.date,
      weightKg: log.weightKg + 0.4,
      note: "",
    });
    expect(updated.id).toBe(log.id);
    const reviews = await p.reviews.listClientReviews(TRAINER, log.clientId);
    expect(reviews.find((r) => r.id === linked.id)!.weightLogId).toBe(log.id);
  });

  it("archiving an exercise warns about usage, removes it from routines and keeps the row (I13)", async () => {
    const p = ports();
    const usage = await p.exercises.getExerciseUsage(TRAINER, "ex-press-banca");
    expect(usage.clientIds).toEqual([MARTA]);
    expect(usage.routineTemplateIds.length).toBeGreaterThan(0);
    await p.exercises.archiveExercise(TRAINER, "ex-press-banca");
    const routine = await p.routines.getActiveRoutine(TRAINER, MARTA);
    const ids = routine!.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain("ex-press-banca");
    expect(routine!.days).toHaveLength(5);
    // Fuera de la biblioteca, pero la fila sigue ahí para leer WorkoutLogs antiguos.
    expect((await p.exercises.listExercises(TRAINER)).map((e) => e.id)).not.toContain(
      "ex-press-banca",
    );
    expect((await p.exercises.getExercise(TRAINER, "ex-press-banca"))?.status).toBe("archivado");
  });

  it("archiving leaves archived routines untouched and workout logs still name the exercise", async () => {
    const p = ports();
    const draft = await p.templates.assignRoutineTemplate(TRAINER, MARTA, "rt-full-body-2d");
    await p.routines.activateRoutine(TRAINER, draft.id); // archiva la rutina de hipertrofia
    await p.exercises.archiveExercise(TRAINER, "ex-sentadilla-trasera");
    const all = await p.routines.listRoutines(TRAINER, MARTA);
    const archived = all.find((r) => r.id === "rt-marta-hipertrofia")!;
    const active = all.find((r) => r.id === draft.id)!;
    const ids = (r: typeof archived) => r.days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
    expect(archived.status).toBe("archivado");
    expect(ids(archived)).toContain("ex-sentadilla-trasera");
    expect(ids(active)).not.toContain("ex-sentadilla-trasera");
    const logs = await p.workoutLogs.listWorkoutLogs(TRAINER, MARTA, "rt-marta-hipertrofia");
    expect(logs.every((l) => l.exerciseId === "ex-sentadilla-trasera")).toBe(true);
    expect((await p.exercises.getExercise(TRAINER, logs[0]!.exerciseId))?.name).toBe(
      "Sentadilla trasera",
    );
  });

  it("deletes a workout log only for its own trainer", async () => {
    const p = ports();
    const saved = await p.workoutLogs.saveWorkoutLog({
      trainerId: TRAINER,
      clientId: MARTA,
      exerciseId: "ex-sentadilla-trasera",
      routineId: "rt-marta-hipertrofia",
      routineDayExerciseId: "r-marta-d2-e1",
      date: TODAY,
      setNumber: 3,
      weightKg: 82.5,
      reps: 6,
    });
    await expect(p.workoutLogs.deleteWorkoutLog("t-otro", saved.id)).rejects.toBeInstanceOf(
      DomainError,
    );
    await p.workoutLogs.deleteWorkoutLog(TRAINER, saved.id);
    const logs = await p.workoutLogs.listWorkoutLogs(TRAINER, MARTA, "rt-marta-hipertrofia");
    expect(logs.map((l) => l.id)).not.toContain(saved.id);
    expect(logs.filter((l) => l.date === TODAY).map((l) => l.setNumber)).toEqual([1, 2]);
    await expect(p.workoutLogs.deleteWorkoutLog(TRAINER, saved.id)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("template lists carry how many clients received a copy, counted by frozen name", async () => {
    const p = ports();
    const before = await p.templates.listRoutineTemplates(TRAINER);
    const hiper = before.find((t) => t.id === "rt-hiper-5d-v3")!;
    expect(hiper.usageCount).toBe(1); // la rutina de Marta salió de «Hiper 5d v3»
    expect(before.find((t) => t.id === "rt-full-body-2d")!.usageCount).toBe(0);
    await p.templates.assignRoutineTemplate(TRAINER, MARTA, "rt-hiper-5d-v3"); // mismo cliente
    await p.templates.assignRoutineTemplate(TRAINER, "c-jorge", "rt-hiper-5d-v3");
    const after = await p.templates.listRoutineTemplates(TRAINER);
    expect(after.find((t) => t.id === "rt-hiper-5d-v3")!.usageCount).toBe(2);
  });

  it("duplicating a template stores an independent copy with no usage, and deleting it leaves plans alone", async () => {
    const p = ports();
    const copy = await p.templates.duplicateRoutineTemplate(
      TRAINER,
      "rt-hiper-5d-v3",
      "Hiper (copia)",
    );
    const list = await p.templates.listRoutineTemplates(TRAINER);
    expect(list.find((t) => t.id === copy.id)?.usageCount).toBe(0);
    await p.templates.deleteRoutineTemplate(TRAINER, "rt-hiper-5d-v3");
    const routines = await p.routines.listRoutines(TRAINER, MARTA);
    expect(routines.some((r) => r.id === "rt-marta-hipertrofia")).toBe(true);
    await expect(p.templates.duplicateRoutineTemplate("t-otro", copy.id, "x")).rejects.toThrow();
  });

  it("assigning a template clones it and activating archives the previous routine (I4)", async () => {
    const p = ports();
    const draft = await p.templates.assignRoutineTemplate(TRAINER, MARTA, "rt-fuerza-basicos-3d");
    expect(draft.status).toBe("borrador");
    expect(draft.sourceTemplateName).toBe("Fuerza básicos 3d");
    await p.routines.activateRoutine(TRAINER, draft.id);
    const all = await p.routines.listRoutines(TRAINER, MARTA);
    expect(all.filter((r) => r.status === "activo").map((r) => r.id)).toEqual([draft.id]);
    expect(all.find((r) => r.id === "rt-marta-hipertrofia")?.status).toBe("archivado");
  });

  it("setting macros keeps one active set per day type (I4)", async () => {
    const p = ports();
    await p.macroTargets.setMacroTargets(TRAINER, MARTA, "descanso", {
      proteinG: 150,
      carbsG: 200,
      fatG: 60,
    });
    const active = await p.macroTargets.listMacroTargets(TRAINER, MARTA);
    expect(active.filter((m) => m.dayType === "descanso")).toHaveLength(1);
    expect(active.find((m) => m.dayType === "descanso")?.macros.carbsG).toBe(200);
  });

  it("opens the current week's review once (I16), freezing the active catalog (I5/I22)", async () => {
    const p = ports();
    // Leer no crea: visitar la pantalla no deja una fila vacía.
    expect(await p.reviews.getCurrentReview(TRAINER, "c-david")).toBeNull();
    await p.measurementTypes.archiveMeasurementType(TRAINER, "mt-hombros");
    const first = await p.reviews.openCurrentReview(TRAINER, "c-david");
    const again = await p.reviews.openCurrentReview(TRAINER, "c-david");
    expect(again.id).toBe(first.id);
    expect(first.weekNumber).toBe(11);
    expect(first.requirements.measurementTypeIds).not.toContain("mt-hombros");
    expect(first.requirements.questionIds).toHaveLength(6);
    // La sexta es la recién añadida: se exige desde ya, pero todavía nadie la ha respondido,
    // así que su formato sigue siendo editable (I15).
    expect(first.requirements.questionIds).toContain("q-estres");
    expect(await p.questionnaire.questionHasResponses(TRAINER, "q-estres")).toBe(false);
    expect(await p.questionnaire.questionHasResponses(TRAINER, "q-energia")).toBe(true);
    expect((await p.reviews.getCurrentReview(TRAINER, "c-david"))?.id).toBe(first.id);
  });

  it("unarchives a catalogue entry with its own id, so its history stays one series", async () => {
    const p = ports();
    await p.measurementTypes.archiveMeasurementType(TRAINER, "mt-hombros");
    const archived = (await p.measurementTypes.listMeasurementTypes(TRAINER)).find(
      (m) => m.id === "mt-hombros",
    );
    expect(archived?.status).toBe("archivada");

    await p.measurementTypes.unarchiveMeasurementType(TRAINER, "mt-hombros");
    const restored = (await p.measurementTypes.listMeasurementTypes(TRAINER)).find(
      (m) => m.id === "mt-hombros",
    );
    expect(restored?.status).toBe("activa");
    expect(restored?.order).toBe(archived?.order);

    // Y vuelve a exigirse en la siguiente revisión que se abra.
    const review = await p.reviews.openCurrentReview(TRAINER, "c-david");
    expect(review.requirements.measurementTypeIds).toContain("mt-hombros");
  });

  it("unarchives a question too, and refuses an unknown id", async () => {
    const p = ports();
    await p.questionnaire.archiveQuestion(TRAINER, "q-energia");
    await p.questionnaire.unarchiveQuestion(TRAINER, "q-energia");
    const question = (await p.questionnaire.listQuestions(TRAINER)).find(
      (q) => q.id === "q-energia",
    );
    expect(question?.status).toBe("activa");
    await expect(p.questionnaire.unarchiveQuestion(TRAINER, "q-no-existe")).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it("rejects a review weight outside the window (I9) and edits after vista (I17)", async () => {
    const p = ports();
    const review = await p.reviews.openCurrentReview(TRAINER, "c-david");
    await expect(
      p.reviews.updateReviewDraft(TRAINER, review.id, { weightLogId: "w-c-marta-2026-08-01" }),
    ).rejects.toThrow(DomainError);
    const submitted = await p.reviews.submitReview(TRAINER, review.id);
    expect(isReviewComplete(submitted).complete).toBe(false);
    await p.reviews.markReviewViewed(TRAINER, review.id);
    await expect(
      p.reviews.updateReviewDraft(TRAINER, review.id, {
        responses: [{ questionId: "q-energia", value: 3 }],
      }),
    ).rejects.toThrow(DomainError);
  });

  it("locks a question's format once answered but still allows editing the prompt (I15)", async () => {
    const p = ports();
    await expect(
      p.questionnaire.updateQuestion(TRAINER, "q-energia", {
        format: { kind: "escala", min: 1, max: 10 },
      }),
    ).rejects.toThrow(DomainError);
    const q = await p.questionnaire.updateQuestion(TRAINER, "q-energia", {
      prompt: "Energía (1-5)",
    });
    expect(q.prompt).toBe("Energía (1-5)");
    const fresh = await p.questionnaire.createQuestion(TRAINER, {
      prompt: "Estrés",
      format: { kind: "texto" },
    });
    const changed = await p.questionnaire.updateQuestion(TRAINER, fresh.id, {
      format: { kind: "escala", min: 1, max: 5 },
    });
    expect(changed.format.kind).toBe("escala");
  });

  it("feedback moves the review to revisada and the dashboard list shrinks", async () => {
    const p = ports();
    expect((await p.reviews.listSubmittedReviews(TRAINER)).map((r) => r.id)).toEqual([
      "rv-marta-s5",
      "rv-jorge-s8",
      "rv-sara-s3",
    ]);
    await p.reviews.markReviewViewed(TRAINER, "rv-marta-s5");
    const done = await p.reviews.sendReviewFeedback(TRAINER, "rv-marta-s5", {
      videoUrl: "https://youtu.be/x",
      note: "Bien",
    });
    expect(done.status).toBe("revisada");
    expect((await p.reviews.listSubmittedReviews(TRAINER)).map((r) => r.id)).toEqual([
      "rv-jorge-s8",
      "rv-sara-s3",
    ]);
  });
});
