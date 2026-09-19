"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  applyReviewDraft,
  canClientEditReview,
  isReviewComplete,
  weightForReview,
  type MeasurementType,
  type Pose,
  type QuestionnaireQuestion,
  type Review,
  type ReviewDraft,
  type WeightLog,
} from "@/lib/domain";
import {
  useCurrentReview,
  useMeasurementTypes,
  useQuestions,
  useReviewMutation,
  useSessionClientId,
  useWeightLogs,
} from "@/lib/data/hooks";
import { parseDecimalInput } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { CompletenessStrip } from "./completeness-strip";
import { MeasurementsBlock, type MeasurementField } from "./measurements-block";
import { PhotosBlock } from "./photos-block";
import { QuestionnaireBlock, type QuestionField } from "./questionnaire-block";
import { SubmitBar } from "./submit-bar";
import { WeightBlock } from "./weight-block";

const t = es.screensReview;

interface EditorProps {
  review: Review;
  types: MeasurementType[];
  questions: QuestionnaireQuestion[];
  logs: WeightLog[];
}

/** Estado local del borrador. Se monta con `key={review.id}` para inicializarse una vez. */
function ReviewEditor({ review, types, questions, logs }: EditorProps) {
  const mutation = useReviewMutation();
  const editable = canClientEditReview(review); // I17
  const weightLog = weightForReview(logs, review.window); // I9

  const [measurements, setMeasurements] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      review.measurements.map((m) => [m.measurementTypeId, String(m.value).replace(".", ",")]),
    ),
  );
  const [responses, setResponses] = useState<Record<string, number | string>>(() =>
    Object.fromEntries(review.responses.map((r) => [r.questionId, r.value])),
  );

  // Requisitos congelados al abrirla (I5), no el catálogo actual. Etiqueta y formato: primero
  // la copia congelada de la respuesta o medida existente, después el catálogo.
  const measurementFields: MeasurementField[] = review.requirements.measurementTypeIds.map((id) => {
    const existing = review.measurements.find((m) => m.measurementTypeId === id);
    const type = types.find((x) => x.id === id);
    const value = measurements[id] ?? "";
    return {
      typeId: id,
      label: existing?.label ?? type?.label ?? id,
      unit: existing?.unit ?? type?.unit ?? "",
      value,
      invalid: value.trim() !== "" && !Number.isFinite(parseDecimalInput(value)),
    };
  });
  const questionFields: QuestionField[] = review.requirements.questionIds.map((id) => {
    const existing = review.responses.find((r) => r.questionId === id);
    const question = questions.find((q) => q.id === id);
    return {
      questionId: id,
      prompt: existing?.prompt ?? question?.prompt ?? id,
      format: existing?.format ?? question?.format ?? { kind: "texto" },
      value: responses[id] ?? null,
    };
  });

  const draft: ReviewDraft = {
    weightLogId: weightLog?.id ?? null,
    measurements: measurementFields
      .filter((f) => f.value.trim() !== "" && !f.invalid)
      .map((f) => ({ measurementTypeId: f.typeId, value: parseDecimalInput(f.value) })),
    responses: questionFields
      .filter((f) => f.value !== null)
      .map((f) => ({ questionId: f.questionId, value: f.value as number | string })),
  };
  const preview = applyReviewDraft(review, draft, { measurementTypes: types, questions });
  const completeness = isReviewComplete(preview);
  const missing = {
    poses: completeness.missing.poses.map((p: Pose) => es.status.pose[p]),
    weight: completeness.missing.weight,
    measurements: completeness.missing.measurementTypeIds.map(
      (id) => measurementFields.find((f) => f.typeId === id)?.label ?? id,
    ),
    questions: completeness.missing.questionIds.map(
      (id) => questionFields.find((f) => f.questionId === id)?.prompt ?? id,
    ),
  };

  const save = () => mutation.mutateAsync({ reviewId: review.id, draft });
  const submit = async () => {
    await save();
    await mutation.mutateAsync({ reviewId: review.id, submit: true });
  };
  const pickPhoto = (pose: Pose, file: File) =>
    mutation.mutateAsync({ reviewId: review.id, media: { pose, url: URL.createObjectURL(file) } });

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <PageHeader eyebrow={`${t.week} ${review.weekNumber}`} title={es.pages.client.revision} />
        <CompletenessStrip completeness={completeness} />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <PhotosBlock media={review.media} editable={editable} onPick={pickPhoto} />
          <WeightBlock log={weightLog} />
          <MeasurementsBlock
            fields={measurementFields}
            editable={editable}
            onChange={(id, value) => setMeasurements((m) => ({ ...m, [id]: value }))}
          />
        </div>
        <div className="flex flex-col gap-5">
          <QuestionnaireBlock
            fields={questionFields}
            editable={editable}
            onChange={(id, value) => setResponses((r) => ({ ...r, [id]: value }))}
          />
          <SubmitBar
            status={review.status}
            completeness={completeness}
            missing={missing}
            isSaving={mutation.isPending}
            saveError={mutation.isError}
            onSave={() => void save()}
            onSubmit={() => void submit()}
          />
        </div>
      </div>
    </>
  );
}

/** Pantalla 05 · Revisión semanal. Abre (o recupera) la revisión de la semana actual. */
export function ReviewScreen() {
  const clientId = useSessionClientId();
  const review = useCurrentReview(clientId);
  const types = useMeasurementTypes();
  const questions = useQuestions();
  const logs = useWeightLogs(clientId);
  const queries = [review, types, questions, logs];

  if (queries.some((q) => q.isError)) {
    return <ErrorState onRetry={() => queries.forEach((q) => void q.refetch())} />;
  }
  if (!review.data || !types.data || !questions.data || !logs.data) return <LoadingState />;

  return (
    <ReviewEditor
      key={review.data.id}
      review={review.data}
      types={types.data}
      questions={questions.data}
      logs={logs.data}
    />
  );
}
