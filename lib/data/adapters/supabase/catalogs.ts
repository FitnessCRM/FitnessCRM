import type { MeasurementTypePort, QuestionnairePort } from "@/lib/data/ports";
import {
  canUpdateMeasurementType,
  canUpdateQuestion,
  DomainError,
  measurementTypeSchema,
  questionnaireQuestionSchema,
  responseFormatSchema,
  type MeasurementType,
  type QuestionnaireQuestion,
  type ResponseFormat,
} from "@/lib/domain";
import type { SupabaseClient } from "./client";
import { notFoundError, raise } from "./errors";
import { rowsOf } from "./queries";
import {
  MEASUREMENT_TYPE_COLUMNS,
  measurementTypeFromRow,
  QUESTION_COLUMNS,
  questionFromRow,
  type MeasurementTypeRow,
  type QuestionRow,
} from "./catalog-rows";

/** Columnas de formato de una pregunta: `texto` no tiene límites. */
function formatColumns(format: ResponseFormat) {
  return format.kind === "escala"
    ? { format_kind: "escala", scale_min: format.min, scale_max: format.max }
    : { format_kind: "texto", scale_min: null, scale_max: null };
}

/**
 * Catálogos del entrenador: nunca se borran, se archivan (I13). Las funciones de archivado y de
 * reordenar están en la migración `catalog_writes`; la unidad (I26) y el formato (I15) se comprueban
 * aquí contra el dominio y, por debajo, con los triggers de la base.
 */
export function createMeasurementTypePort(client: SupabaseClient): MeasurementTypePort {
  /** Un tipo que no es del entrenador no existe para él: `not_found`. */
  async function readRow(trainerId: string, typeId: string): Promise<MeasurementTypeRow> {
    const { data, error } = await client
      .from("measurement_types")
      .select(MEASUREMENT_TYPE_COLUMNS)
      .eq("trainer_id", trainerId)
      .eq("id", typeId)
      .maybeSingle();
    raise(error);
    if (!data) throw notFoundError("Tipo de medida");
    return data as MeasurementTypeRow;
  }

  const mine = (trainerId: string): Promise<MeasurementType[]> =>
    rowsOf(
      client
        .from("measurement_types")
        .select(MEASUREMENT_TYPE_COLUMNS)
        .eq("trainer_id", trainerId)
        .order("sort_order"),
      measurementTypeFromRow,
    );

  const setStatus = async (trainerId: string, typeId: string, status: "activa") => {
    await readRow(trainerId, typeId);
    const { error } = await client
      .from("measurement_types")
      .update({ status })
      .eq("trainer_id", trainerId)
      .eq("id", typeId);
    raise(error);
  };

  return {
    listMeasurementTypes: mine,

    createMeasurementType: async (trainerId, input) => {
      const data = measurementTypeSchema.pick({ label: true, unit: true }).parse(input);
      const { data: row, error } = await client
        .from("measurement_types")
        .insert({
          trainer_id: trainerId,
          label: data.label,
          unit: data.unit,
          sort_order: (await mine(trainerId)).length,
          status: "activa",
        })
        .select(MEASUREMENT_TYPE_COLUMNS)
        .single();
      raise(error);
      return measurementTypeFromRow(row as MeasurementTypeRow);
    },

    updateMeasurementType: async (trainerId, typeId, changes) => {
      const row = await readRow(trainerId, typeId);
      const type = measurementTypeFromRow(row);
      const next = { label: changes.label ?? type.label, unit: changes.unit ?? type.unit };
      // I26: la unidad no cambia desde la primera medida registrada; la etiqueta, siempre.
      if (!canUpdateMeasurementType(type, next, row.has_measurements)) {
        throw new DomainError(
          "measurement_type.unit_locked",
          "El tipo ya tiene medidas registradas: su unidad no se puede cambiar",
        );
      }
      measurementTypeSchema.parse({ ...type, ...next });

      const { data, error } = await client
        .from("measurement_types")
        .update(next)
        .eq("trainer_id", trainerId)
        .eq("id", typeId)
        .select(MEASUREMENT_TYPE_COLUMNS)
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Tipo de medida");
      return measurementTypeFromRow(data as MeasurementTypeRow);
    },

    reorderMeasurementTypes: async (trainerId, orderedIds) => {
      const { error } = await client.rpc("reorder_measurement_types", {
        p_ordered_ids: orderedIds,
      });
      raise(error);
      return mine(trainerId);
    },

    // I13: se archiva, nunca se borra. Las revisiones pasadas conservan su copia congelada (I12).
    archiveMeasurementType: async (trainerId, typeId) => {
      const { error } = await client.rpc("archive_measurement_type", {
        p_measurement_type_id: typeId,
      });
      raise(error);
      await readRow(trainerId, typeId);
    },

    // Vuelve con su id y su orden: el histórico de esa medida sigue siendo una sola serie.
    unarchiveMeasurementType: (trainerId, typeId) => setStatus(trainerId, typeId, "activa"),

    measurementTypeHasMeasurements: async (trainerId, typeId) =>
      (await readRow(trainerId, typeId)).has_measurements,
  };
}

export function createQuestionnairePort(client: SupabaseClient): QuestionnairePort {
  /** Una pregunta que no es del entrenador no existe para él: `not_found`. */
  async function readRow(trainerId: string, questionId: string): Promise<QuestionRow> {
    const { data, error } = await client
      .from("questionnaire_questions")
      .select(QUESTION_COLUMNS)
      .eq("trainer_id", trainerId)
      .eq("id", questionId)
      .maybeSingle();
    raise(error);
    if (!data) throw notFoundError("Pregunta");
    return data as QuestionRow;
  }

  const mine = (trainerId: string): Promise<QuestionnaireQuestion[]> =>
    rowsOf(
      client
        .from("questionnaire_questions")
        .select(QUESTION_COLUMNS)
        .eq("trainer_id", trainerId)
        .order("sort_order"),
      questionFromRow,
    );

  const setStatus = async (trainerId: string, questionId: string, status: "activa") => {
    await readRow(trainerId, questionId);
    const { error } = await client
      .from("questionnaire_questions")
      .update({ status })
      .eq("trainer_id", trainerId)
      .eq("id", questionId);
    raise(error);
  };

  return {
    listQuestions: mine,

    createQuestion: async (trainerId, input) => {
      const prompt = questionnaireQuestionSchema.shape.prompt.parse(input.prompt);
      const format = responseFormatSchema.parse(input.format);
      const { data: row, error } = await client
        .from("questionnaire_questions")
        .insert({
          trainer_id: trainerId,
          prompt,
          ...formatColumns(format),
          sort_order: (await mine(trainerId)).length,
          status: "activa",
        })
        .select(QUESTION_COLUMNS)
        .single();
      raise(error);
      return questionFromRow(row as QuestionRow);
    },

    updateQuestion: async (trainerId, questionId, changes) => {
      const row = await readRow(trainerId, questionId);
      const question = questionFromRow(row);
      const next = {
        prompt: changes.prompt ?? question.prompt,
        format: changes.format ?? question.format,
      };
      // I15: el formato no cambia desde la primera respuesta; el enunciado, siempre.
      if (!canUpdateQuestion(question, next, row.has_responses)) {
        throw new DomainError(
          "question.format_locked",
          "La pregunta ya tiene respuestas: su formato no se puede cambiar",
        );
      }
      questionnaireQuestionSchema.parse({ ...question, ...next });

      const { data, error } = await client
        .from("questionnaire_questions")
        .update({ prompt: next.prompt, ...formatColumns(next.format) })
        .eq("trainer_id", trainerId)
        .eq("id", questionId)
        .select(QUESTION_COLUMNS)
        .maybeSingle();
      raise(error);
      if (!data) throw notFoundError("Pregunta");
      return questionFromRow(data as QuestionRow);
    },

    reorderQuestions: async (trainerId, orderedIds) => {
      const { error } = await client.rpc("reorder_questions", { p_ordered_ids: orderedIds });
      raise(error);
      return mine(trainerId);
    },

    archiveQuestion: async (trainerId, questionId) => {
      const { error } = await client.rpc("archive_question", { p_question_id: questionId });
      raise(error);
      await readRow(trainerId, questionId);
    },

    // Deshace un archivado: la pregunta vuelve a pedirse en las revisiones siguientes.
    unarchiveQuestion: (trainerId, questionId) => setStatus(trainerId, questionId, "activa"),

    questionHasResponses: async (trainerId, questionId) =>
      (await readRow(trainerId, questionId)).has_responses,
  };
}
