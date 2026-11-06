import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isSeedId } from "@/lib/data/seed/ids";
import { COLLECTIONS } from "../helpers";
import { weightLogDocId, workoutLogDocId } from "../logs";
import { reviewDocId } from "../reviews";
import { SEED_COLLECTIONS, buildFirestoreSeedPlan } from "./plan";

const TRAINER_ID = "t-prueba";

/** El mismo objeto con las claves ordenadas: el orden de escritura de las claves no es contenido. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

describe("siembra · documentos de Firestore", () => {
  const plan = buildFirestoreSeedPlan({
    trainerId: TRAINER_ID,
    anchor: "2026-10-12",
    clock: { timeZone: "Europe/Madrid", now: "2026-10-12T20:00:00.000Z" },
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
    expect([...new Set(plan.docs.map((d) => d.collection))]).toEqual(SEED_COLLECTIONS);
  });

  it("weigh-ins, sets and reviews take the adapter's composite id", () => {
    for (const log of plan.weightLogs) expect(log.id).toBe(weightLogDocId(log.clientId, log.date));
    for (const log of plan.workoutLogs) {
      expect(log.id).toBe(
        workoutLogDocId(log.clientId, log.routineDayExerciseId, log.date, log.setNumber),
      );
    }
    for (const review of plan.reviews) {
      expect(review.id).toBe(reviewDocId(review.clientId, review.weekNumber));
    }
  });

  it("flags are true only for the measurement types and questions a seeded review really uses", () => {
    const flagOf = (collection: string, flag: string) =>
      new Map(
        plan.docs.filter((d) => d.collection === collection).map((d) => [d.id, d.data[flag]]),
      );
    const hasMeasurements = flagOf(COLLECTIONS.measurementTypes, "hasMeasurements");
    const hasResponses = flagOf(COLLECTIONS.questions, "hasResponses");
    for (const type of plan.measurementTypes) {
      expect(hasMeasurements.get(type.id)).toBe(plan.measured.has(type.id));
    }
    for (const question of plan.questions) {
      expect(hasResponses.get(question.id)).toBe(plan.answered.has(question.id));
    }
    expect([...hasMeasurements.values()].filter((v) => v === false)).toHaveLength(1);
    expect([...hasResponses.values()].filter((v) => v === false)).toHaveLength(1);
  });

  /**
   * La siembra ya se ejecutó contra el proyecto real (12-10-2026). Repetirla tiene que caer sobre los
   * mismos documentos con los mismos datos, así que el plan no puede cambiar al mover sus
   * constructores a `lib/data/seed/` (tarjeta 135). Las huellas se tomaron con el código de antes del
   * movimiento; si un cambio en la siembra las altera a propósito, hay que decir qué pasa con lo ya
   * sembrado antes de actualizarlas.
   */
  it.each([
    [
      "Europe/Madrid",
      "2026-10-12T20:00:00.000Z",
      "aa1a3c6a6440bef872bdf142d6d90a202255c48d2f4cc6bf3429b234df73c05b",
    ],
    [
      "Pacific/Auckland",
      "2026-10-12T09:00:00.000Z",
      "ad4cb8de32f5a73f7405884ccfc04bc8a3e6ad82d65307db6cbd6b87fe29bb70",
    ],
  ])("the plan in %s is byte for byte the one before the move", (timeZone, now, fingerprint) => {
    const docs = buildFirestoreSeedPlan({
      trainerId: "t-huella",
      anchor: "2026-10-12",
      clock: { timeZone, now },
    }).docs.map((d) => ({ collection: d.collection, id: d.id, data: d.data }));
    expect(docs).toHaveLength(273);
    const hash = createHash("sha256")
      .update(JSON.stringify(canonical(docs)))
      .digest("hex");
    expect(hash).toBe(fingerprint);
  });
});
