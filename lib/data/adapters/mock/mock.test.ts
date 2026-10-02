import { describe, expect, it } from "vitest";
import {
  DomainError,
  addCivilDays,
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
  dayRecordOn,
  isReviewComplete,
  latestDayRecord,
  reviewWeight,
  weekNumber,
} from "@/lib/domain";
import { createDemoState, createMockPorts, demoToday } from "./index";

const TRAINER = "t-adrian";
const MARTA = "c-marta";
const DAVID = "c-david";
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

  it("a reviewed review keeps the weight it had when it was viewed, whatever the log says (I24, E04)", async () => {
    const p = ports();
    const s4 = (await p.reviews.getReview(TRAINER, "rv-marta-s4"))!;
    expect(s4.status).toBe("revisada");
    const logs = await p.weightLogs.listWeightLogs(TRAINER, MARTA);
    const log = logs.find((l) => l.id === s4.weightLogId)!;
    expect(reviewWeight(s4, logs)?.weightKg).toBe(log.weightKg);
    // Lo que hace Peso: registrar otro valor en la misma fecha actualiza el pesaje (I23).
    await p.weightLogs.saveWeightLog({
      trainerId: TRAINER,
      clientId: MARTA,
      date: log.date,
      weightKg: 80,
      note: "",
    });
    const after = (await p.reviews.getReview(TRAINER, "rv-marta-s4"))!;
    const newLogs = await p.weightLogs.listWeightLogs(TRAINER, MARTA);
    expect(newLogs.find((l) => l.id === log.id)!.weightKg).toBe(80);
    expect(reviewWeight(after, newLogs)).toEqual({ weightKg: log.weightKg, date: log.date });
  });

  it("marking a review vista through the port freezes the linked log (I24)", async () => {
    const p = ports();
    const s5 = (await p.reviews.getReview(TRAINER, "rv-marta-s5"))!;
    const log = (await p.weightLogs.listWeightLogs(TRAINER, MARTA)).find(
      (l) => l.id === s5.weightLogId,
    )!;
    const viewed = await p.reviews.markReviewViewed(TRAINER, s5.id);
    expect(viewed.frozenWeight).toEqual({ weightKg: log.weightKg, date: log.date });
    expect(reviewSchema.safeParse(viewed).success).toBe(true);
  });

  it.each(["rv-marta-s4", "rv-marta-s5"])(
    "refuses to delete the weight log of a sent review (I25, %s)",
    async (id) => {
      const p = ports();
      const review = (await p.reviews.getReview(TRAINER, id))!;
      await expect(
        p.weightLogs.deleteWeightLog(TRAINER, review.weightLogId!),
      ).rejects.toMatchObject({ code: "weight_log.in_review" });
      const again = (await p.reviews.getReview(TRAINER, id))!;
      expect(again.weightLogId).toBe(review.weightLogId);
      expect(isReviewComplete(again).complete).toBe(isReviewComplete(review).complete);
    },
  );

  it("deleting a weight log used only by a draft leaves the draft without weight (I25)", async () => {
    const p = ports();
    const draft = await p.reviews.openCurrentReview(TRAINER, DAVID);
    const log = await p.weightLogs.saveWeightLog({
      trainerId: TRAINER,
      clientId: DAVID,
      date: TODAY,
      weightKg: 81,
      note: "",
    });
    await p.reviews.updateReviewDraft(TRAINER, draft.id, { weightLogId: log.id });
    await p.weightLogs.deleteWeightLog(TRAINER, log.id);
    expect((await p.reviews.getReview(TRAINER, draft.id))!.weightLogId).toBeNull();
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
    const logs = (await p.workoutLogs.listWorkoutLogs(TRAINER, MARTA)).filter(
      (l) => l.routineId === "rt-marta-hipertrofia",
    );
    expect(logs.every((l) => l.exerciseId === "ex-sentadilla-trasera")).toBe(true);
    expect((await p.exercises.getExercise(TRAINER, logs[0]!.exerciseId))?.name).toBe(
      "Sentadilla trasera",
    );
  });

  it("publishing changes to the active routine versions it and archives the old one (E27, §7)", async () => {
    const p = ports();
    const active = (await p.routines.getActiveRoutine(TRAINER, MARTA))!;
    // Lo que hace el editor: quitar del día 2 la línea que Marta tiene registrada.
    const body = {
      name: active.name,
      note: active.note,
      days: active.days.map((d) => ({
        ...d,
        exercises: d.exercises.filter((e) => e.id !== "r-marta-d2-e1"),
      })),
    };
    await expect(p.routines.updateRoutine(TRAINER, active.id, body)).rejects.toMatchObject({
      code: "routine.not_draft",
    });
    const draft = await p.routines.reviseRoutine(TRAINER, active.id, body);
    expect(draft).toMatchObject({
      status: "borrador",
      sourceTemplateName: active.sourceTemplateName,
    });
    await p.routines.activateRoutine(TRAINER, draft.id);
    const all = await p.routines.listRoutines(TRAINER, MARTA);
    const old = all.find((r) => r.id === active.id)!;
    expect(old.status).toBe("archivado");
    expect(old.days).toEqual(active.days);
    expect(all.filter((r) => r.status === "activo").map((r) => r.id)).toEqual([draft.id]);
    // Los registros de la línea quitada se siguen resolviendo en la versión archivada.
    const logs = (await p.workoutLogs.listWorkoutLogs(TRAINER, MARTA)).filter(
      (l) => l.routineDayExerciseId === "r-marta-d2-e1",
    );
    expect(logs.length).toBeGreaterThan(0);
    const oldDay = old.days.find((d) => d.exercises.some((e) => e.id === "r-marta-d2-e1"))!;
    expect(latestDayRecord(oldDay, logs).logs.length).toBeGreaterThan(0);
  });

  it("a line that continues in the new version keeps its last-time record (§7)", async () => {
    const p = ports();
    const active = (await p.routines.getActiveRoutine(TRAINER, MARTA))!;
    const body = {
      name: active.name,
      note: active.note,
      days: active.days.map((d) => ({
        ...d,
        exercises: d.exercises.map((e) =>
          e.id === "r-marta-d2-e1" ? { ...e, prescription: { ...e.prescription, sets: 5 } } : e,
        ),
      })),
    };
    const draft = await p.routines.reviseRoutine(TRAINER, active.id, body);
    const now = await p.routines.activateRoutine(TRAINER, draft.id);
    const logs = await p.workoutLogs.listWorkoutLogs(TRAINER, MARTA);
    expect(logs.every((l) => l.routineId === active.id)).toBe(true);
    const day2 = now.days.find((d) => d.exercises.some((e) => e.id === "r-marta-d2-e1"))!;
    const before = latestDayRecord(day2, logs, { before: TODAY });
    expect(before.date).not.toBeNull();
    expect(before.logs.map((l) => l.routineDayExerciseId)).toContain("r-marta-d2-e1");
    expect(dayRecordOn(day2, logs, TODAY).logs.length).toBeGreaterThan(0);
  });

  it("menus: an active one is never edited in place; a new version keeps its template and the set is archived together (§7)", async () => {
    const p = ports();
    const active = await p.menus.listActiveMenus(TRAINER, MARTA);
    const dayType = active[0]!.dayType;
    const set = active.filter((m) => m.dayType === dayType);
    const target = set[0]!;
    const { id, trainerId, clientId, status, sourceTemplateName, createdAt, updatedAt, ...body } =
      target;
    void [id, trainerId, clientId, status, sourceTemplateName, createdAt, updatedAt];
    await expect(p.menus.updateMenu(TRAINER, target.id, body)).rejects.toMatchObject({
      code: "menu.not_draft",
    });
    const drafts = [];
    for (const m of set)
      drafts.push(await p.menus.reviseMenu(TRAINER, m.id, { ...body, name: `${m.name} v2` }));
    expect(drafts.map((d) => d.sourceTemplateName)).toEqual(set.map((m) => m.sourceTemplateName));
    await p.menus.activateMenus(TRAINER, MARTA, dayType);
    const after = await p.menus.listActiveMenus(TRAINER, MARTA);
    expect(
      after
        .filter((m) => m.dayType === dayType)
        .map((m) => m.id)
        .sort(),
    ).toEqual(drafts.map((d) => d.id).sort());
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
    const logs = await p.workoutLogs.listWorkoutLogs(TRAINER, MARTA);
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
      kcal: 1950,
      proteinG: 150,
      carbsG: 200,
      fatG: 60,
    });
    const active = await p.macroTargets.listMacroTargets(TRAINER, MARTA);
    expect(active.filter((m) => m.dayType === "descanso")).toHaveLength(1);
    expect(active.find((m) => m.dayType === "descanso")?.macros.carbsG).toBe(200);
  });

  it("stores the kcal the trainer writes as they are, also when they do not match 4/4/9 (§5)", async () => {
    const p = ports();
    // 160/280/70 g darían 2.390 con 4/4/9: el entrenador escribe 2.500 y eso es lo que queda.
    const rounded = { kcal: 2500, proteinG: 160, carbsG: 280, fatG: 70 };
    await p.macroTargets.setMacroTargets(TRAINER, MARTA, "entrenamiento", rounded);
    const active = await p.macroTargets.listMacroTargets(TRAINER, MARTA);
    expect(active.find((m) => m.dayType === "entrenamiento")?.macros).toEqual(rounded);

    const templates = await p.templates.listMenuTemplates(TRAINER);
    const maintenance = templates.find((t) => t.id === "mnt-mantenimiento-2500");
    expect(maintenance?.menus[0]?.macros).toEqual(rounded);
    const [menu] = await p.templates.assignMenuTemplate(TRAINER, MARTA, "mnt-mantenimiento-2500");
    expect(menu?.macros.kcal).toBe(2500);
  });

  it("rejects macros without valid kcal", async () => {
    const p = ports();
    const macros = { proteinG: 150, carbsG: 200, fatG: 60 };
    await expect(
      p.macroTargets.setMacroTargets(TRAINER, MARTA, "descanso", { ...macros, kcal: 0 }),
    ).rejects.toThrow();
    await expect(
      p.macroTargets.setMacroTargets(TRAINER, MARTA, "descanso", { ...macros, kcal: 1950.5 }),
    ).rejects.toThrow();
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

describe("writes are tenant-scoped (I1, I2): one cross-tenant case per method (E01, E02)", () => {
  type Ports = ReturnType<typeof ports>;
  const OTHER = "t-otro";
  const GHOST = "c-no-existe";
  const routineBody = {
    name: "Rutina",
    note: "",
    days: [
      {
        id: "d1",
        dayNumber: 1,
        label: "",
        exercises: [
          {
            id: "d1-e1",
            exerciseId: "ex-sentadilla-trasera",
            prescription: { sets: 3, repsMin: 8, repsMax: 10, rir: "2", rest: "", note: "" },
          },
        ],
      },
    ],
  };
  const menuBody = {
    name: "Menú",
    dayType: "entrenamiento" as const,
    suggested: false,
    macros: { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 },
    meals: [],
    note: "",
  };

  /** Escrituras que reciben un `clientId`: (puertos, entrenador, cliente) => escritura. */
  const byClient: [string, (p: Ports, trainerId: string, clientId: string) => Promise<unknown>][] =
    [
      ["routines.createRoutine", (p, t, c) => p.routines.createRoutine(t, c, routineBody)],
      [
        "macroTargets.setMacroTargets",
        (p, t, c) => p.macroTargets.setMacroTargets(t, c, "entrenamiento", menuBody.macros),
      ],
      ["menus.createMenu", (p, t, c) => p.menus.createMenu(t, c, menuBody)],
      ["menus.activateMenus", (p, t, c) => p.menus.activateMenus(t, c, "entrenamiento")],
      [
        "memberships.createMembership",
        (p, t, c) =>
          p.memberships.createMembership({
            trainerId: t,
            clientId: c,
            type: "mensual",
            startDate: TODAY,
            endDate: "2026-09-28",
            paymentStatus: "pagada",
          }),
      ],
      [
        "weightLogs.saveWeightLog",
        (p, t, c) =>
          p.weightLogs.saveWeightLog({
            trainerId: t,
            clientId: c,
            date: TODAY,
            weightKg: 70,
            note: "",
          }),
      ],
      [
        "workoutLogs.saveWorkoutLog",
        (p, t, c) =>
          p.workoutLogs.saveWorkoutLog({
            trainerId: t,
            clientId: c,
            exerciseId: "ex-sentadilla-trasera",
            routineId: "rt-marta-hipertrofia",
            routineDayExerciseId: "r-marta-d2-e1",
            date: TODAY,
            setNumber: 4,
            weightKg: 80,
            reps: 6,
          }),
      ],
      ["reviews.openCurrentReview", (p, t, c) => p.reviews.openCurrentReview(t, c)],
      [
        "templates.assignRoutineTemplate",
        (p, t, c) => p.templates.assignRoutineTemplate(t, c, "rt-full-body-2d"),
      ],
      [
        "templates.assignMenuTemplate",
        (p, t, c) => p.templates.assignMenuTemplate(t, c, p.state.menuTemplates[0]!.id),
      ],
    ];

  it.each(byClient)("%s rejects another trainer's client and writes nothing", async (_, write) => {
    const p = ports();
    const before = JSON.stringify(p.state);
    await expect(write(p, OTHER, MARTA)).rejects.toMatchObject({ code: "not_found" });
    expect(JSON.stringify(p.state)).toBe(before);
  });

  it.each(byClient)("%s rejects a client that does not exist", async (_, write) => {
    const p = ports();
    const before = JSON.stringify(p.state);
    await expect(write(p, TRAINER, GHOST)).rejects.toMatchObject({ code: "not_found" });
    expect(JSON.stringify(p.state)).toBe(before);
  });

  /** El resto de escrituras reciben el id de lo que tocan: ninguna alcanza lo de otro entrenador. */
  const byId: [string, (p: Ports) => Promise<unknown>][] = [
    ["clients.updateClient", (p) => p.clients.updateClient(OTHER, MARTA, { goal: "x" })],
    [
      "routines.updateRoutine",
      (p) => p.routines.updateRoutine(OTHER, "rt-marta-hipertrofia", routineBody),
    ],
    [
      "routines.reviseRoutine",
      (p) => p.routines.reviseRoutine(OTHER, "rt-marta-hipertrofia", routineBody),
    ],
    ["routines.activateRoutine", (p) => p.routines.activateRoutine(OTHER, "rt-marta-hipertrofia")],
    ["menus.updateMenu", (p) => p.menus.updateMenu(OTHER, p.state.menus[0]!.id, menuBody)],
    ["menus.reviseMenu", (p) => p.menus.reviseMenu(OTHER, p.state.menus[0]!.id, menuBody)],
    ["menus.archiveMenu", (p) => p.menus.archiveMenu(OTHER, p.state.menus[0]!.id)],
    [
      "memberships.updateMembership",
      (p) => p.memberships.updateMembership(OTHER, p.state.memberships[0]!.id, { type: "anual" }),
    ],
    [
      "weightLogs.deleteWeightLog",
      (p) => p.weightLogs.deleteWeightLog(OTHER, p.state.weightLogs[0]!.id),
    ],
    [
      "workoutLogs.deleteWorkoutLog",
      (p) => p.workoutLogs.deleteWorkoutLog(OTHER, p.state.workoutLogs[0]!.id),
    ],
    ["reviews.updateReviewDraft", (p) => p.reviews.updateReviewDraft(OTHER, "rv-marta-s5", {})],
    [
      "reviews.attachReviewMedia",
      (p) => p.reviews.attachReviewMedia(OTHER, "rv-marta-s5", "frente", "x"),
    ],
    ["reviews.submitReview", (p) => p.reviews.submitReview(OTHER, "rv-marta-s5")],
    ["reviews.markReviewViewed", (p) => p.reviews.markReviewViewed(OTHER, "rv-marta-s5")],
    [
      "reviews.sendReviewFeedback",
      (p) => p.reviews.sendReviewFeedback(OTHER, "rv-marta-s4", { videoUrl: null, note: "" }),
    ],
  ];

  it.each(byId)("%s refuses another trainer's record and writes nothing", async (_, write) => {
    const p = ports();
    const before = JSON.stringify(p.state);
    await expect(write(p)).rejects.toMatchObject({ code: "not_found" });
    expect(JSON.stringify(p.state)).toBe(before);
  });

  it("activating a routine only archives routines of the same trainer (E01)", async () => {
    const p = ports();
    // Una fila ajena que apunta al cliente de otro: el puerto ya no deja crearla, pero el archivado
    // tampoco puede alcanzar la rutina activa de Marta aunque exista.
    p.state.routines.push({
      ...routineBody,
      id: "rt-ajena",
      trainerId: OTHER,
      clientId: MARTA,
      status: "borrador",
      sourceTemplateName: null,
      createdAt: `${TODAY}T08:00:00Z`,
      updatedAt: `${TODAY}T08:00:00Z`,
    });
    await p.routines.activateRoutine(OTHER, "rt-ajena");
    expect((await p.routines.getActiveRoutine(TRAINER, MARTA))?.id).toBe("rt-marta-hipertrofia");
  });

  it("a workout set is logged on a routine of that client and trainer", async () => {
    const p = ports();
    await expect(
      p.workoutLogs.saveWorkoutLog({
        trainerId: TRAINER,
        clientId: "c-jorge",
        exerciseId: "ex-sentadilla-trasera",
        routineId: "rt-marta-hipertrofia",
        routineDayExerciseId: "r-marta-d2-e1",
        date: TODAY,
        setNumber: 1,
        weightKg: 80,
        reps: 6,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("an edit never changes who a record belongs to", async () => {
    const p = ports();
    const membership = p.state.memberships.find((m) => m.clientId === MARTA)!;
    const edited = await p.memberships.updateMembership(TRAINER, membership.id, {
      type: "anual",
      clientId: "c-jorge",
      trainerId: OTHER,
    } as never);
    expect(edited).toMatchObject({ clientId: MARTA, trainerId: TRAINER, type: "anual" });
    const draft = await p.templates.assignRoutineTemplate(TRAINER, MARTA, "rt-full-body-2d");
    const updated = await p.routines.updateRoutine(TRAINER, draft.id, {
      ...routineBody,
      clientId: "c-jorge",
      trainerId: OTHER,
    } as never);
    expect(updated).toMatchObject({ clientId: MARTA, trainerId: TRAINER });
  });
});

describe("I3 on every routine write (E03)", () => {
  const withExercise = (exerciseId: string) => ({
    name: "Rutina",
    note: "",
    days: [
      {
        id: "d1",
        dayNumber: 1,
        label: "",
        exercises: [
          {
            id: "d1-e1",
            exerciseId,
            prescription: { sets: 3, repsMin: 8, repsMax: 10, rir: "2", rest: "", note: "" },
          },
        ],
      },
    ],
  });
  const code = { code: "routine.exercise_not_in_library" };

  it("rejects an exercise that is not in the trainer's library", async () => {
    const p = ports();
    const bad = withExercise("ex-que-no-existe");
    await expect(p.routines.createRoutine(TRAINER, MARTA, bad)).rejects.toMatchObject(code);
    await expect(
      p.routines.reviseRoutine(TRAINER, "rt-marta-hipertrofia", bad),
    ).rejects.toMatchObject(code);
    const draft = await p.templates.assignRoutineTemplate(TRAINER, MARTA, "rt-full-body-2d");
    await expect(p.routines.updateRoutine(TRAINER, draft.id, bad)).rejects.toMatchObject(code);
    await expect(
      p.templates.saveRoutineTemplate({ trainerId: TRAINER, description: "", ...bad }),
    ).rejects.toMatchObject(code);
  });

  it("rejects an archived exercise, which left the library (section 7)", async () => {
    const p = ports();
    await p.exercises.archiveExercise(TRAINER, "ex-sentadilla-trasera");
    await expect(
      p.routines.createRoutine(TRAINER, MARTA, withExercise("ex-sentadilla-trasera")),
    ).rejects.toMatchObject(code);
  });

  it("accepts the trainer's active exercises", async () => {
    const p = ports();
    const created = await p.routines.createRoutine(TRAINER, MARTA, withExercise("ex-press-banca"));
    expect(created.status).toBe("borrador");
  });
});

describe("I20 on the feedback write (E06)", () => {
  it("rejects a video that is not an http(s) link and keeps the review as it was", async () => {
    const p = ports();
    await p.reviews.markReviewViewed(TRAINER, "rv-marta-s5");
    await expect(
      p.reviews.sendReviewFeedback(TRAINER, "rv-marta-s5", {
        videoUrl: "ftp://host/video.mp4",
        note: "",
      }),
    ).rejects.toMatchObject({ code: "review.feedback_invalid_url" });
    expect((await p.reviews.getReview(TRAINER, "rv-marta-s5"))?.status).toBe("vista");
    const done = await p.reviews.sendReviewFeedback(TRAINER, "rv-marta-s5", {
      videoUrl: "https://youtu.be/x",
      note: "",
    });
    expect(done.status).toBe("revisada");
  });
});

describe("invariants the adapter keeps on writes the old tests did not cover (E07)", () => {
  it("I12: editing a measurement type's label leaves registered measurements as they were", async () => {
    const p = ports();
    const before = await p.reviews.listClientReviews(TRAINER, MARTA);
    const frozen = before.flatMap((r) =>
      r.measurements.filter((m) => m.measurementTypeId === "mt-cuello"),
    );
    expect(frozen.length).toBeGreaterThan(0);
    await p.measurementTypes.updateMeasurementType(TRAINER, "mt-cuello", {
      label: "Cuello (nuevo)",
    });
    const after = await p.reviews.listClientReviews(TRAINER, MARTA);
    expect(
      after.flatMap((r) => r.measurements.filter((m) => m.measurementTypeId === "mt-cuello")),
    ).toEqual(frozen);
  });

  it("I12: editing a question's prompt leaves the answers already given as they were", async () => {
    const p = ports();
    const before = await p.reviews.listClientReviews(TRAINER, MARTA);
    const answered = before.flatMap((r) => r.responses).find(() => true)!;
    const frozen = before.flatMap((r) =>
      r.responses.filter((x) => x.questionId === answered.questionId),
    );
    await p.questionnaire.updateQuestion(TRAINER, answered.questionId, {
      prompt: "Otro enunciado",
    });
    const after = await p.reviews.listClientReviews(TRAINER, MARTA);
    expect(
      after.flatMap((r) => r.responses.filter((x) => x.questionId === answered.questionId)),
    ).toEqual(frozen);
  });

  it("I17: a photo cannot be attached once the review is vista", async () => {
    const p = ports();
    await p.reviews.markReviewViewed(TRAINER, "rv-marta-s5");
    await expect(
      p.reviews.attachReviewMedia(TRAINER, "rv-marta-s5", "frente", "storage://otra.jpg"),
    ).rejects.toMatchObject({ code: "review.locked" });
    await expect(
      p.reviews.attachReviewMedia(TRAINER, "rv-marta-s4", "perfil", "storage://otra.jpg"),
    ).rejects.toMatchObject({ code: "review.locked" });
  });

  it("I22: changing a client's start date does not renumber their reviews", async () => {
    const p = ports();
    const weeks = async () =>
      (await p.reviews.listClientReviews(TRAINER, MARTA)).map((r) => [r.id, r.weekNumber]);
    const before = await weeks();
    const client = (await p.clients.getClient(TRAINER, MARTA))!;
    await p.clients.updateClient(TRAINER, MARTA, {
      startDate: addCivilDays(client.startDate, -14),
    });
    expect(await weeks()).toEqual(before);
  });

  it("I23: updating a day's weight keeps its creation time even when the clock has moved", async () => {
    let tick = 0;
    const p = createMockPorts({
      today: TODAY,
      now: () => new Date(Date.UTC(2026, 7, 29, 10, 0, tick++)).toISOString(),
    });
    const base = { trainerId: TRAINER, clientId: MARTA, date: "2026-08-30" };
    const first = await p.weightLogs.saveWeightLog({ ...base, weightKg: 63, note: "" });
    const second = await p.weightLogs.saveWeightLog({ ...base, weightKg: 62.8, note: "" });
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
  });
});
