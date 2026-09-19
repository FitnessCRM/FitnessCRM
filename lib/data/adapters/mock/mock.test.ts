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
const ports = () =>
  createMockPorts({ latencyMs: 0, today: TODAY, now: () => `${TODAY}T10:00:00Z` });

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
      const p = createMockPorts({ latencyMs: 0, today });
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

describe("tenancy (I1)", () => {
  it("returns nothing for another trainer", async () => {
    const p = ports();
    expect(await p.clients.listClients("t-otro")).toEqual([]);
    expect(await p.clients.getClient("t-otro", MARTA)).toBeNull();
    expect(await p.reviews.listSubmittedReviews("t-otro")).toEqual([]);
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

describe("flows", () => {
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
    expect(first.requirements.questionIds).toHaveLength(5);
    expect((await p.reviews.getCurrentReview(TRAINER, "c-david"))?.id).toBe(first.id);
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

  it("simulates latency when asked", async () => {
    const slow = createMockPorts({ latencyMs: 30 });
    const started = Date.now();
    await slow.session.getSession();
    expect(Date.now() - started).toBeGreaterThanOrEqual(25);
  });
});
