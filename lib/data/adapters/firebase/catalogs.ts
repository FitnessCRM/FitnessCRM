import { getDoc, runTransaction, setDoc, writeBatch } from "firebase/firestore";
import type { MeasurementTypePort, QuestionnairePort } from "@/lib/data/ports";
import {
  DomainError,
  canUpdateMeasurementType,
  canUpdateQuestion,
  measurementTypeSchema,
  questionnaireQuestionSchema,
} from "@/lib/domain";
import type { FirebaseContext } from "./context";
import { COLLECTIONS, FLAGS, listOwn, ref, requireOwn, txRequireOwn } from "./helpers";

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

/** Reasigna `order` según `orderedIds`; lo que no venga en la lista conserva el suyo. */
async function reorder<T extends { id: string; order: number }>(
  ctx: FirebaseContext,
  name: string,
  items: T[],
  orderedIds: string[],
): Promise<T[]> {
  const batch = writeBatch(ctx.db);
  orderedIds.forEach((id, order) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    item.order = order;
    batch.update(ref(ctx, name, id), { order });
  });
  await batch.commit();
  return items.sort(byOrder);
}

export function createMeasurementTypePort(ctx: FirebaseContext): MeasurementTypePort {
  const name = COLLECTIONS.measurementTypes;
  const mine = async (trainerId: string) =>
    (await listOwn(ctx, name, measurementTypeSchema, trainerId)).sort(byOrder);
  const setStatus = (trainerId: string, typeId: string, status: "activa" | "archivada") =>
    runTransaction(ctx.db, async (tx) => {
      const docRef = ref(ctx, name, typeId);
      await txRequireOwn(tx, docRef, measurementTypeSchema, trainerId, "Tipo de medida");
      tx.update(docRef, { status });
    });
  return {
    listMeasurementTypes: mine,
    createMeasurementType: async (trainerId, input) => {
      const created = measurementTypeSchema.parse({
        ...input,
        id: ctx.newId(),
        trainerId,
        order: (await mine(trainerId)).length,
        status: "activa",
        createdAt: ctx.now(),
      });
      await setDoc(ref(ctx, name, created.id), created);
      return created;
    },
    updateMeasurementType: (trainerId, typeId, changes) =>
      runTransaction(ctx.db, async (tx) => {
        const docRef = ref(ctx, name, typeId);
        const { value: type, raw } = await txRequireOwn(
          tx,
          docRef,
          measurementTypeSchema,
          trainerId,
          "Tipo de medida",
        );
        const next = { label: changes.label ?? type.label, unit: changes.unit ?? type.unit };
        // I26: la unidad es inmutable desde la primera medida registrada; la etiqueta, editable siempre.
        if (!canUpdateMeasurementType(type, next, raw[FLAGS.hasMeasurements] === true)) {
          throw new DomainError(
            "measurement_type.unit_locked",
            "El tipo ya tiene medidas registradas: su unidad no se puede cambiar",
          );
        }
        const updated = measurementTypeSchema.parse({ ...type, ...next });
        tx.set(docRef, updated, { merge: true });
        return updated;
      }),
    reorderMeasurementTypes: async (trainerId, orderedIds) =>
      reorder(ctx, name, await mine(trainerId), orderedIds),
    // I13: se archiva, nunca se borra. Las revisiones pasadas conservan su copia congelada (I12).
    archiveMeasurementType: (trainerId, typeId) => setStatus(trainerId, typeId, "archivada"),
    // Vuelve con su id y su orden: el histórico de esa medida sigue siendo una sola serie.
    unarchiveMeasurementType: (trainerId, typeId) => setStatus(trainerId, typeId, "activa"),
    measurementTypeHasMeasurements: async (trainerId, typeId) => {
      await requireOwn(ctx, name, measurementTypeSchema, trainerId, typeId, "Tipo de medida");
      return (await getDoc(ref(ctx, name, typeId))).data()?.[FLAGS.hasMeasurements] === true;
    },
  };
}

export function createQuestionnairePort(ctx: FirebaseContext): QuestionnairePort {
  const name = COLLECTIONS.questions;
  const mine = async (trainerId: string) =>
    (await listOwn(ctx, name, questionnaireQuestionSchema, trainerId)).sort(byOrder);
  const setStatus = (trainerId: string, questionId: string, status: "activa" | "archivada") =>
    runTransaction(ctx.db, async (tx) => {
      const docRef = ref(ctx, name, questionId);
      await txRequireOwn(tx, docRef, questionnaireQuestionSchema, trainerId, "Pregunta");
      tx.update(docRef, { status });
    });
  return {
    listQuestions: mine,
    createQuestion: async (trainerId, input) => {
      const created = questionnaireQuestionSchema.parse({
        ...input,
        id: ctx.newId(),
        trainerId,
        order: (await mine(trainerId)).length,
        status: "activa",
        createdAt: ctx.now(),
      });
      await setDoc(ref(ctx, name, created.id), created);
      return created;
    },
    updateQuestion: (trainerId, questionId, changes) =>
      runTransaction(ctx.db, async (tx) => {
        const docRef = ref(ctx, name, questionId);
        const { value: question, raw } = await txRequireOwn(
          tx,
          docRef,
          questionnaireQuestionSchema,
          trainerId,
          "Pregunta",
        );
        const next = {
          prompt: changes.prompt ?? question.prompt,
          format: changes.format ?? question.format,
        };
        // I15: el formato es inmutable desde la primera respuesta; el enunciado, editable siempre.
        if (!canUpdateQuestion(question, next, raw[FLAGS.hasResponses] === true)) {
          throw new DomainError(
            "question.format_locked",
            "La pregunta ya tiene respuestas: su formato no se puede cambiar",
          );
        }
        const updated = questionnaireQuestionSchema.parse({ ...question, ...next });
        tx.set(docRef, updated, { merge: true });
        return updated;
      }),
    reorderQuestions: async (trainerId, orderedIds) =>
      reorder(ctx, name, await mine(trainerId), orderedIds),
    archiveQuestion: (trainerId, questionId) => setStatus(trainerId, questionId, "archivada"),
    unarchiveQuestion: (trainerId, questionId) => setStatus(trainerId, questionId, "activa"),
    questionHasResponses: async (trainerId, questionId) => {
      await requireOwn(ctx, name, questionnaireQuestionSchema, trainerId, questionId, "Pregunta");
      return (await getDoc(ref(ctx, name, questionId))).data()?.[FLAGS.hasResponses] === true;
    },
  };
}
