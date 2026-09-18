import type { MeasurementType, QuestionnaireQuestion, ResponseFormat } from "@/lib/domain";

/** Catálogos del entrenador. Nunca se borran: se archivan (I13). */
export interface MeasurementTypePort {
  /** Activos y archivados, ordenados por `order`. */
  listMeasurementTypes(trainerId: string): Promise<MeasurementType[]>;
  createMeasurementType(
    trainerId: string,
    input: Pick<MeasurementType, "label" | "unit">,
  ): Promise<MeasurementType>;
  updateMeasurementType(
    trainerId: string,
    typeId: string,
    changes: Partial<Pick<MeasurementType, "label" | "unit">>,
  ): Promise<MeasurementType>;
  reorderMeasurementTypes(trainerId: string, orderedIds: string[]): Promise<MeasurementType[]>;
  archiveMeasurementType(trainerId: string, typeId: string): Promise<void>;
}

export interface QuestionnairePort {
  listQuestions(trainerId: string): Promise<QuestionnaireQuestion[]>;
  createQuestion(
    trainerId: string,
    input: { prompt: string; format: ResponseFormat },
  ): Promise<QuestionnaireQuestion>;
  /** Rechaza cambiar el formato si ya hay respuestas (I15). */
  updateQuestion(
    trainerId: string,
    questionId: string,
    changes: Partial<{ prompt: string; format: ResponseFormat }>,
  ): Promise<QuestionnaireQuestion>;
  reorderQuestions(trainerId: string, orderedIds: string[]): Promise<QuestionnaireQuestion[]>;
  archiveQuestion(trainerId: string, questionId: string): Promise<void>;
  /** Si existe alguna respuesta a la pregunta, su formato es inmutable. */
  questionHasResponses(trainerId: string, questionId: string): Promise<boolean>;
}
