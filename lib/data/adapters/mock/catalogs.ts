import type { MeasurementTypePort, QuestionnairePort } from "@/lib/data/ports";
import {
  DomainError,
  canUpdateMeasurementType,
  canUpdateQuestion,
  measurementTypeSchema,
  questionnaireQuestionSchema,
} from "@/lib/domain";
import { findOwn, own } from "./helpers";
import type { MockContext } from "./store";

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

function reorder<T extends { id: string; order: number }>(items: T[], orderedIds: string[]): T[] {
  orderedIds.forEach((id, order) => {
    const item = items.find((i) => i.id === id);
    if (item) item.order = order;
  });
  return items.sort(byOrder);
}

export function createMeasurementTypePort(ctx: MockContext): MeasurementTypePort {
  const mine = (trainerId: string) => own(ctx.state.measurementTypes, trainerId).sort(byOrder);
  // Mismo criterio que I15: cualquier revisión con una medida de ese tipo, borradores incluidos.
  const hasMeasurements = (trainerId: string, typeId: string) =>
    own(ctx.state.reviews, trainerId).some((r) =>
      r.measurements.some((m) => m.measurementTypeId === typeId),
    );
  return {
    listMeasurementTypes: async (trainerId) => ctx.reply(mine(trainerId)),
    createMeasurementType: async (trainerId, input) => {
      const created = measurementTypeSchema.parse({
        ...input,
        id: ctx.newId(),
        trainerId,
        order: mine(trainerId).length,
        status: "activa",
        createdAt: ctx.now(),
      });
      ctx.state.measurementTypes.push(created);
      return ctx.reply(created);
    },
    updateMeasurementType: async (trainerId, typeId, changes) => {
      const type = findOwn(ctx.state.measurementTypes, trainerId, typeId, "Tipo de medida");
      const next = { label: changes.label ?? type.label, unit: changes.unit ?? type.unit };
      // I26: la unidad es inmutable desde la primera medida registrada; la etiqueta, editable siempre.
      if (!canUpdateMeasurementType(type, next, hasMeasurements(trainerId, typeId))) {
        throw new DomainError(
          "measurement_type.unit_locked",
          "El tipo ya tiene medidas registradas: su unidad no se puede cambiar",
        );
      }
      Object.assign(type, measurementTypeSchema.parse({ ...type, ...next }));
      return ctx.reply(type);
    },
    reorderMeasurementTypes: async (trainerId, orderedIds) =>
      ctx.reply(reorder(mine(trainerId), orderedIds)),
    archiveMeasurementType: async (trainerId, typeId) => {
      // I13: se archiva, nunca se borra. Las revisiones pasadas conservan su copia congelada (I12).
      findOwn(ctx.state.measurementTypes, trainerId, typeId, "Tipo de medida").status = "archivada";
      return ctx.reply(undefined);
    },
    unarchiveMeasurementType: async (trainerId, typeId) => {
      // Vuelve con su id y su orden: el histórico de esa medida sigue siendo una sola serie.
      findOwn(ctx.state.measurementTypes, trainerId, typeId, "Tipo de medida").status = "activa";
      return ctx.reply(undefined);
    },
    measurementTypeHasMeasurements: async (trainerId, typeId) =>
      ctx.reply(hasMeasurements(trainerId, typeId)),
  };
}

export function createQuestionnairePort(ctx: MockContext): QuestionnairePort {
  const mine = (trainerId: string) => own(ctx.state.questions, trainerId).sort(byOrder);
  const hasResponses = (trainerId: string, questionId: string) =>
    own(ctx.state.reviews, trainerId).some((r) =>
      r.responses.some((res) => res.questionId === questionId),
    );
  return {
    listQuestions: async (trainerId) => ctx.reply(mine(trainerId)),
    createQuestion: async (trainerId, input) => {
      const created = questionnaireQuestionSchema.parse({
        ...input,
        id: ctx.newId(),
        trainerId,
        order: mine(trainerId).length,
        status: "activa",
        createdAt: ctx.now(),
      });
      ctx.state.questions.push(created);
      return ctx.reply(created);
    },
    updateQuestion: async (trainerId, questionId, changes) => {
      const question = findOwn(ctx.state.questions, trainerId, questionId, "Pregunta");
      const next = {
        prompt: changes.prompt ?? question.prompt,
        format: changes.format ?? question.format,
      };
      // I15: el formato es inmutable desde la primera respuesta; el enunciado, editable siempre.
      if (!canUpdateQuestion(question, next, hasResponses(trainerId, questionId))) {
        throw new DomainError(
          "question.format_locked",
          "La pregunta ya tiene respuestas: su formato no se puede cambiar",
        );
      }
      Object.assign(question, questionnaireQuestionSchema.parse({ ...question, ...next }));
      return ctx.reply(question);
    },
    reorderQuestions: async (trainerId, orderedIds) =>
      ctx.reply(reorder(mine(trainerId), orderedIds)),
    archiveQuestion: async (trainerId, questionId) => {
      findOwn(ctx.state.questions, trainerId, questionId, "Pregunta").status = "archivada";
      return ctx.reply(undefined);
    },
    unarchiveQuestion: async (trainerId, questionId) => {
      findOwn(ctx.state.questions, trainerId, questionId, "Pregunta").status = "activa";
      return ctx.reply(undefined);
    },
    questionHasResponses: async (trainerId, questionId) =>
      ctx.reply(hasResponses(trainerId, questionId)),
  };
}
