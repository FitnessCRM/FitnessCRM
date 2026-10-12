import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import {
  addCivilDays,
  assertExercisesInLibrary,
  civilDateInTimeZone,
  civilDaysBetween,
  isReviewComplete,
  isWeightLogInWindow,
  membershipStanding,
  overlappingMembershipIds,
  reviewWeight,
  reviewWindowForWeek,
  weekNumber,
  weightForReview,
  weightLogDateIssue,
  type CivilDate,
  type Review,
  type WeightLog,
} from "@/lib/domain";
import { es } from "@/lib/i18n/es";
import { weightLogDocId, workoutLogDocId } from "../logs";
import { reviewDocId } from "../reviews";
import { SESSIONS, WEIGHT_OFFSETS } from "./history";
import { isSeedId } from "./ids";
import type { SeedContext } from "./library";
import { CLIENT_KEYS, CLIENT_SPECS, anchorFromStartDate, type ClientKey } from "./people";
import { buildSeedPlan } from "./plan";
import { at } from "./time";

const TRAINER_ID = "t-prueba";
const ANCHOR: CivilDate = "2026-10-12";
/** Madrid y dos zonas lejanas, a un lado y a otro: +13 h y −7 h. */
const ZONES = ["Europe/Madrid", "Pacific/Auckland", "America/Los_Angeles"];

/** Las `time` del día `date` en esa zona, como instante. */
function instant(date: CivilDate, time: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, timeZone).getTime()).toISOString();
}

/** Sembrado a las 22:00 del ancla, salvo que se diga otra hora. */
function ctxFor(anchor: CivilDate, timeZone: string, time = "22:00"): SeedContext {
  return {
    trainerId: TRAINER_ID,
    anchor,
    clock: { timeZone, now: instant(anchor, time, timeZone) },
  };
}

const ofClient = <T extends { clientId: string }>(items: readonly T[], clientId: string): T[] =>
  items.filter((item) => item.clientId === clientId);

/** Pendiente en kg por semana, por mínimos cuadrados. */
function kgPerWeek(logs: readonly WeightLog[], startDate: CivilDate): number {
  const xs = logs.map((log) => civilDaysBetween(startDate, log.date) / 7);
  const ys = logs.map((log) => log.weightKg);
  const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
  const [mx, my] = [mean(xs), mean(ys)];
  const covariance = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i]! - my), 0);
  const variance = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  return covariance / variance;
}

describe.each(ZONES)("siembra · plan en %s", (timeZone) => {
  const plan = buildSeedPlan(ctxFor(ANCHOR, timeZone));
  const { clients } = plan;

  it("writes the agreed amounts", () => {
    expect(plan.exercises).toHaveLength(12);
    expect(plan.foods).toHaveLength(15);
    expect(plan.measurementTypes).toHaveLength(8);
    expect(plan.questions).toHaveLength(5);
    expect(plan.routineTemplates).toHaveLength(2);
    expect(plan.menuTemplate.menus).toHaveLength(3);
    expect(Object.keys(clients)).toHaveLength(2);
    expect(plan.memberships).toHaveLength(3);
    expect(plan.macroTargets).toHaveLength(4);
    expect(plan.menus).toHaveLength(6);
    expect(plan.reviews).toHaveLength(7);
    expect(plan.weightLogs).toHaveLength(WEIGHT_OFFSETS.lucas.length + WEIGHT_OFFSETS.irene.length);
  });

  it("every document is valid, tenant-scoped, seed-prefixed and plain data", () => {
    const seen = new Set<string>();
    for (const doc of plan.docs) {
      expect(() => doc.schema.parse(doc.data)).not.toThrow();
      expect(doc.data.id).toBe(doc.id);
      expect(doc.data.trainerId).toBe(TRAINER_ID);
      expect(isSeedId(doc.id)).toBe(true);
      // Sin `undefined` ni nada que Firestore no sepa guardar.
      expect(JSON.parse(JSON.stringify(doc.data))).toStrictEqual(doc.data);
      const path = `${doc.collection}/${doc.id}`;
      expect(seen.has(path)).toBe(false);
      seen.add(path);
    }
  });

  it("the library is active, without invented video links, and foods are pending to publish", () => {
    expect(plan.exercises.every((e) => e.status === "activo" && e.videoUrl === null)).toBe(true);
    expect(plan.foods.every((f) => f.status === "activo" && f.publishStatus === "pendiente")).toBe(
      true,
    );
  });

  it("clients are active, with a goal and a level the signup form offers", () => {
    expect(clients.lucas.startDate).toBe(addCivilDays(ANCHOR, -40));
    expect(clients.irene.startDate).toBe(addCivilDays(ANCHOR, -63));
    for (const key of CLIENT_KEYS) {
      expect(clients[key].status).toBe("activo");
      expect(es.clientData.goals).toContain(clients[key].goal);
      expect(es.clientData.levels).toContain(clients[key].level);
      expect(anchorFromStartDate(key, clients[key].startDate)).toBe(ANCHOR);
    }
  });

  it("I3: routines and templates only prescribe active exercises of the library", () => {
    for (const routine of [...plan.routineTemplates, ...Object.values(plan.routines)]) {
      expect(() => assertExercisesInLibrary(routine, plan.exercises)).not.toThrow();
    }
  });

  it("the active routine is a clone of a template: same content, its own ids", () => {
    expect(plan.routines.lucas.days).toHaveLength(3);
    expect(plan.routines.irene.days).toHaveLength(4);
    for (const routine of Object.values(plan.routines)) {
      const template = plan.routineTemplates.find((t) => t.name === routine.sourceTemplateName)!;
      expect(routine.status).toBe("activo");
      expect(routine.days.map((d) => d.exercises.map((e) => e.exerciseId))).toEqual(
        template.days.map((d) => d.exercises.map((e) => e.exerciseId)),
      );
      const templateIds = new Set(
        template.days.flatMap((d) => [d.id, ...d.exercises.map((e) => e.id)]),
      );
      const ownIds = routine.days.flatMap((d) => [d.id, ...d.exercises.map((e) => e.id)]);
      expect(ownIds.some((id) => templateIds.has(id))).toBe(false);
      expect(new Set(ownIds).size).toBe(ownIds.length);
    }
  });

  it("I4: one active routine, one set of macros per day type and one suggested menu per day type", () => {
    for (const client of Object.values(clients)) {
      expect(Object.values(plan.routines).filter((r) => r.clientId === client.id)).toHaveLength(1);
      for (const dayType of ["entrenamiento", "descanso"] as const) {
        const targets = ofClient(plan.macroTargets, client.id).filter((m) => m.dayType === dayType);
        expect(targets).toHaveLength(1);
        expect(targets[0]!.status).toBe("activo");
        const menus = ofClient(plan.menus, client.id).filter((m) => m.dayType === dayType);
        expect(menus.length).toBeGreaterThan(0);
        expect(menus.every((m) => m.status === "activo")).toBe(true);
        expect(menus.filter((m) => m.suggested)).toHaveLength(1);
      }
    }
  });

  it("I29: menu items from the library keep the frozen name and composition of their food", () => {
    const items = [...plan.menus, ...plan.menuTemplate.menus].flatMap((menu) =>
      menu.meals.flatMap((meal) => meal.items),
    );
    const fromLibrary = items.filter((item) => item.foodId !== undefined);
    expect(fromLibrary.length).toBeGreaterThan(0);
    expect(items.length).toBeGreaterThan(fromLibrary.length); // también hay texto libre (I30)
    for (const item of fromLibrary) {
      const food = plan.foods.find((f) => f.id === item.foodId)!;
      expect(item.name).toBe(food.name);
      expect(item.composition).toEqual(food.composition);
    }
  });

  it("I23 and I27: one weigh-in per client and date, never before the start nor after today", () => {
    for (const key of CLIENT_KEYS) {
      const client = clients[key];
      const logs = ofClient(plan.weightLogs, client.id);
      expect(new Set(logs.map((l) => l.date)).size).toBe(logs.length);
      for (const log of logs) {
        expect(log.id).toBe(weightLogDocId(client.id, log.date));
        expect(weightLogDateIssue(log.date, { today: ANCHOR, startDate: client.startDate })).toBe(
          null,
        );
        expect(civilDateInTimeZone(log.createdAt, timeZone)).toBe(log.date);
      }
      const gaps = logs.slice(1).map((log, i) => civilDaysBetween(logs[i]!.date, log.date));
      expect(gaps.filter((gap) => gap === 2 || gap === 3).length).toBe(gaps.length - 1);
      expect(Math.max(...gaps)).toBeGreaterThan(5); // una laguna
      expect(logs.at(-1)!.date).toBe(ANCHOR);
    }
  });

  it("weights follow the agreed trend: Lucas gains about 0.2 kg a week, Irene loses about 0.4", () => {
    const lucas = kgPerWeek(ofClient(plan.weightLogs, clients.lucas.id), clients.lucas.startDate);
    const irene = kgPerWeek(ofClient(plan.weightLogs, clients.irene.id), clients.irene.startDate);
    expect(lucas).toBeGreaterThan(0.12);
    expect(lucas).toBeLessThan(0.28);
    expect(irene).toBeLessThan(-0.32);
    expect(irene).toBeGreaterThan(-0.48);
  });

  it("workout logs are sets of the client's own active routine, with the adapter's id", () => {
    for (const key of CLIENT_KEYS) {
      const client = clients[key];
      const routine = plan.routines[key];
      const lines = new Map(routine.days.flatMap((d) => d.exercises).map((e) => [e.id, e]));
      const logs = ofClient(plan.workoutLogs, client.id);
      expect(new Set(logs.map((l) => l.date)).size).toBe(SESSIONS[key].length);
      for (const log of logs) {
        const line = lines.get(log.routineDayExerciseId)!;
        expect(log.routineId).toBe(routine.id);
        expect(log.exerciseId).toBe(line.exerciseId);
        expect(log.setNumber).toBeLessThanOrEqual(line.prescription.sets);
        expect(log.id).toBe(
          workoutLogDocId(client.id, log.routineDayExerciseId, log.date, log.setNumber),
        );
        expect(log.date >= client.startDate && log.date <= ANCHOR).toBe(true);
        expect(civilDateInTimeZone(log.createdAt, timeZone)).toBe(log.date);
      }
    }
    const span = (key: ClientKey) => Math.max(...SESSIONS[key].map(([daysAgo]) => daysAgo));
    expect(span("lucas")).toBeGreaterThanOrEqual(18); // unas tres semanas
    expect(ofClient(plan.workoutLogs, clients.irene.id).length).toBeLessThan(
      ofClient(plan.workoutLogs, clients.lucas.id).length,
    );
  });

  describe("revisiones", () => {
    const reviewsOf = (key: ClientKey) => ofClient(plan.reviews, clients[key].id);
    const clientOf = (review: Review) =>
      Object.values(clients).find((c) => c.id === review.clientId)!;
    const logsOf = (review: Review) => ofClient(plan.weightLogs, review.clientId);

    it("are in the agreed weeks and states", () => {
      expect(reviewsOf("lucas").map((r) => [r.weekNumber, r.status])).toEqual([
        [1, "revisada"],
        [2, "revisada"],
        [3, "revisada"],
        [4, "revisada"],
        [5, "enviada"],
      ]);
      expect(reviewsOf("irene").map((r) => [r.weekNumber, r.status])).toEqual([
        [9, "vista"],
        [10, "borrador"],
      ]);
    });

    it("I22 and I16: the week is the one of the day it was opened, and it is the document id", () => {
      for (const review of plan.reviews) {
        const client = clientOf(review);
        const openedOn = civilDateInTimeZone(review.createdAt, timeZone);
        expect(review.weekNumber).toBe(weekNumber(client.startDate, openedOn, timeZone));
        expect(review.window).toEqual(reviewWindowForWeek(client.startDate, review.weekNumber));
        expect(review.id).toBe(reviewDocId(client.id, review.weekNumber));
      }
      expect(new Set(plan.reviews.map((r) => r.id)).size).toBe(plan.reviews.length);
    });

    it("I5: requirements are the catalog as it was when opened, and no review is complete without photos", () => {
      const activeAt = <T extends { id: string; order: number; createdAt: string }>(
        entries: readonly T[],
        instantIso: string,
      ) =>
        entries
          .filter((entry) => entry.createdAt <= instantIso)
          .sort((a, b) => a.order - b.order)
          .map((entry) => entry.id);
      for (const review of plan.reviews) {
        expect(review.requirements).toEqual({
          measurementTypeIds: activeAt(plan.measurementTypes, review.createdAt),
          questionIds: activeAt(plan.questions, review.createdAt),
        });
        expect(review.media).toEqual([]);
        const completeness = isReviewComplete(review);
        expect(completeness.complete).toBe(false);
        expect(completeness.missing.poses).toHaveLength(3);
        // A las enviadas solo les faltan las fotos; al borrador, casi todo.
        const sent = review.status !== "borrador";
        expect(completeness.blocks.weight).toBe(true);
        expect(completeness.blocks.measurements).toBe(sent);
        expect(completeness.blocks.questionnaire).toBe(sent);
      }
      // Lo que el entrenador añadió ayer solo se le exige al borrador de hoy.
      expect(reviewsOf("lucas").at(-1)!.requirements.questionIds).toHaveLength(4);
      expect(reviewsOf("irene").at(-1)!.requirements.questionIds).toHaveLength(5);
      expect(reviewsOf("irene").at(-1)!.requirements.measurementTypeIds).toHaveLength(8);
    });

    it("I9: the weight is the client's latest weigh-in inside the window when it was saved", () => {
      for (const review of plan.reviews) {
        const logs = logsOf(review);
        const log = logs.find((l) => l.id === review.weightLogId)!;
        expect(log).toBeDefined();
        expect(isWeightLogInWindow(log, review.window)).toBe(true);
        const savedOn = civilDateInTimeZone(review.submittedAt ?? review.createdAt, timeZone);
        expect(
          weightForReview(
            logs.filter((l) => l.date <= savedOn),
            review.window,
          )?.id,
        ).toBe(log.id);
      }
    });

    it("I12: measurements and answers carry the label, unit, prompt and format of their catalog entry", () => {
      for (const review of plan.reviews) {
        for (const measurement of review.measurements) {
          const type = plan.measurementTypes.find((t) => t.id === measurement.measurementTypeId)!;
          expect(review.requirements.measurementTypeIds).toContain(type.id);
          expect([measurement.label, measurement.unit]).toEqual([type.label, type.unit]);
        }
        for (const response of review.responses) {
          const question = plan.questions.find((q) => q.id === response.questionId)!;
          expect(review.requirements.questionIds).toContain(question.id);
          expect([response.prompt, response.format]).toEqual([question.prompt, question.format]);
        }
      }
    });

    it("I24: editable reviews hold no copy of the weight; viewed ones hold the one of their weigh-in", () => {
      for (const review of plan.reviews) {
        const log = logsOf(review).find((l) => l.id === review.weightLogId)!;
        const editable = review.status === "borrador" || review.status === "enviada";
        expect(review.frozenWeight).toEqual(
          editable ? null : { weightKg: log.weightKg, date: log.date },
        );
        expect(reviewWeight(review, logsOf(review))).toEqual({
          weightKg: log.weightKg,
          date: log.date,
        });
      }
    });

    it("feedback is a note and an external link only on reviewed ones (I20)", () => {
      for (const review of plan.reviews) {
        if (review.status === "revisada") {
          expect(review.feedbackVideoUrl).toMatch(/^https:\/\/example\.com\//);
          expect(review.feedbackNote.length).toBeGreaterThan(0);
        } else {
          expect(review.feedbackVideoUrl).toBe(null);
          expect(review.feedbackNote).toBe("");
        }
      }
    });

    it("moments go in order and none is later than the run", () => {
      for (const review of plan.reviews) {
        const moments = [
          review.createdAt,
          review.submittedAt,
          review.viewedAt,
          review.reviewedAt,
        ].filter((m) => m !== null);
        expect([...moments].sort()).toEqual(moments);
        expect(moments.length).toBe(
          { borrador: 1, enviada: 2, vista: 3, revisada: 4 }[review.status],
        );
      }
      for (const doc of plan.docs) {
        for (const key of ["createdAt", "updatedAt", "submittedAt", "viewedAt", "reviewedAt"]) {
          const value = doc.data[key];
          if (typeof value === "string") expect(value <= plan.ctx.clock.now).toBe(true);
        }
      }
    });
  });

  it("flags are true only for the measurement types and questions a seeded review really uses", () => {
    const flagOf = (collection: string, flag: string) =>
      new Map(
        plan.docs.filter((d) => d.collection === collection).map((d) => [d.id, d.data[flag]]),
      );
    const hasMeasurements = flagOf("measurementTypes", "hasMeasurements");
    const hasResponses = flagOf("questions", "hasResponses");
    for (const type of plan.measurementTypes) {
      const used = plan.reviews.some((r) =>
        r.measurements.some((m) => m.measurementTypeId === type.id),
      );
      expect(hasMeasurements.get(type.id)).toBe(used);
    }
    for (const question of plan.questions) {
      const used = plan.reviews.some((r) => r.responses.some((x) => x.questionId === question.id));
      expect(hasResponses.get(question.id)).toBe(used);
    }
    // Queda al menos uno de cada sin usar: su unidad y su formato siguen editables.
    expect([...hasMeasurements.values()].filter((v) => v === false)).toHaveLength(1);
    expect([...hasResponses.values()].filter((v) => v === false)).toHaveLength(1);
  });

  it("is deterministic: the same anchor gives the same documents whenever it runs", () => {
    const again = buildSeedPlan(ctxFor(ANCHOR, timeZone));
    expect(again.docs.map((d) => d.data)).toEqual(plan.docs.map((d) => d.data));
    // Otra ejecución, días después y con el ancla deducida: mismos ids, nada nuevo que crear.
    const later = buildSeedPlan({
      ...plan.ctx,
      clock: { timeZone, now: instant(addCivilDays(ANCHOR, 9), "10:00", timeZone) },
    });
    expect(later.docs.map((d) => `${d.collection}/${d.id}`)).toEqual(
      plan.docs.map((d) => `${d.collection}/${d.id}`),
    );
  });
});

describe("siembra · fechas", () => {
  /** Dos meses de anclas, más fines de mes y un bisiesto: donde `membershipEndDate` se complica. */
  const anchors: CivilDate[] = [
    ...Array.from({ length: 62 }, (_, i) => addCivilDays("2026-01-01", i * 6)),
    "2026-03-31",
    "2026-04-10",
    "2026-05-31",
    "2027-03-01",
    "2028-02-29",
    "2028-04-09",
  ];

  it.each(anchors)(
    "memberships chain without overlap and the current one is right on %s",
    (anchor) => {
      const plan = buildSeedPlan(ctxFor(anchor, "Europe/Madrid"));
      const [first, second] = ofClient(plan.memberships, CLIENT_SPECS.lucas.id);
      const [quarterly] = ofClient(plan.memberships, CLIENT_SPECS.irene.id);
      expect(overlappingMembershipIds(plan.memberships).size).toBe(0);

      expect([first!.type, first!.paymentStatus]).toEqual(["mensual", "pagada"]);
      expect([second!.type, second!.paymentStatus]).toEqual(["mensual", "pagada"]);
      expect(first!.startDate).toBe(plan.clients.lucas.startDate);
      expect(second!.startDate).toBe(addCivilDays(first!.endDate, 1));
      expect(first!.endDate < anchor).toBe(true);
      expect(membershipStanding([first!, second!], anchor).current?.id).toBe(second!.id);

      expect([quarterly!.type, quarterly!.paymentStatus]).toEqual(["trimestral", "no_pagada"]);
      expect(membershipStanding([quarterly!], anchor).current?.id).toBe(quarterly!.id);
    },
  );

  it.each(anchors)("the plan builds with the agreed reviews on %s", (anchor) => {
    const plan = buildSeedPlan(ctxFor(anchor, "Europe/Madrid"));
    expect(plan.reviews.map((r) => `${r.weekNumber}:${r.status}`)).toEqual([
      "1:revisada",
      "2:revisada",
      "3:revisada",
      "4:revisada",
      "5:enviada",
      "9:vista",
      "10:borrador",
    ]);
    expect(plan.reviews.every((r) => r.weightLogId !== null)).toBe(true);
  });

  it.each(ZONES)("a moment falls on its civil day in %s", (timeZone) => {
    const clock = { timeZone, now: instant(ANCHOR, "23:30", timeZone) };
    for (const time of ["00:05", "07:40", "13:00", "23:20"]) {
      // Los dos cambios de hora de Europa anteriores al ancla, y el propio ancla.
      for (const date of ["2025-10-26", "2026-03-29", ANCHOR] as CivilDate[]) {
        expect(civilDateInTimeZone(at(clock, date, time), timeZone)).toBe(date);
      }
    }
  });

  it("seeded before dawn, today's moments stay at the run instant and nothing is in the future", () => {
    const ctx = ctxFor(ANCHOR, "Europe/Madrid", "00:20");
    const plan = buildSeedPlan(ctx);
    const today = plan.weightLogs.filter((l) => l.date === ANCHOR);
    expect(today.length).toBe(2);
    expect(today.every((l) => l.createdAt === ctx.clock.now)).toBe(true);
    const draft = plan.reviews.find((r) => r.status === "borrador")!;
    expect(draft.createdAt).toBe(ctx.clock.now);
    // Lo de ayer ya existía: el borrador de hoy sigue exigiendo el catálogo entero.
    expect(draft.requirements.questionIds).toHaveLength(5);
  });
});
