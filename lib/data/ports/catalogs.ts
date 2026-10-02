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
  /**
   * Deshace un archivado. Sin esto, archivar por error obliga a crear otra entrada: otro id, y
   * por tanto la serie de esa medida se parte en dos en las gráficas.
   */
  unarchiveMeasurementType(trainerId: string, typeId: string): Promise<void>;
  /**
   * Si el tipo tiene alguna medida registrada, en cualquier revisión, borradores incluidos. Desde
   * entonces su unidad no se puede cambiar (I26): `updateMeasurementType` lanza
   * `measurement_type.unit_locked`.
   */
  measurementTypeHasMeasurements(trainerId: string, typeId: string): Promise<boolean>;
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
  /** Deshace un archivado: la pregunta vuelve a pedirse en las revisiones siguientes. */
  unarchiveQuestion(trainerId: string, questionId: string): Promise<void>;
  /** Si existe alguna respuesta a la pregunta, su formato es inmutable. */
  questionHasResponses(trainerId: string, questionId: string): Promise<boolean>;
}
