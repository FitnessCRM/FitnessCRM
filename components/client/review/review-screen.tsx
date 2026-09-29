"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { ErrorState, LoadingState } from "@/components/ui/states";
import {
  applyReviewDraft,
  canClientEditReview,
  isReviewComplete,
  openReview,
  weightForReview,
  type Client,
  type MeasurementType,
  type Pose,
  type QuestionnaireQuestion,
  type Review,
  type ReviewDraft,
  type Trainer,
  type WeightLog,
} from "@/lib/domain";
import {
  useClient,
  useCurrentReview,
  useMeasurementTypes,
  useQuestions,
  useReviewMutation,
  useSessionClientId,
  useTrainer,
  useWeightLogs,
} from "@/lib/data/hooks";
import { parseDecimalInput, todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { CompletenessStrip } from "./completeness-strip";
import { MeasurementsBlock, type MeasurementField } from "./measurements-block";
import { PhotosBlock } from "./photos-block";
import { QuestionnaireBlock, type QuestionField } from "./questionnaire-block";
import { SubmitBar } from "./submit-bar";
import { WeightBlock } from "./weight-block";

const t = es.screensReview;

interface EditorProps {
  /** Persistida, o borrador en memoria (`persisted: false`) que aún no ha tocado el cliente. */
  review: Review;
  persisted: boolean;
  clientId: string;
  types: MeasurementType[];
  questions: QuestionnaireQuestion[];
  logs: WeightLog[];
}

/** Estado local del borrador. Se monta con `key` por cliente y semana para inicializarse una vez. */
function ReviewEditor({ review, persisted, clientId, types, questions, logs }: EditorProps) {
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

  // La revisión se abre (persiste y congela requisitos) en la primera edición real, una sola vez.
  const opening = useRef<Promise<Review> | null>(null);
  const ensureOpened = (): Promise<Review> => {
    if (persisted) return Promise.resolve(review);
    opening.current ??= mutation.mutateAsync({ open: { clientId } }) as Promise<Review>;
    return opening.current;
  };

  // Las fotos son object URL del navegador: se revocan al desmontar.
  const objectUrls = useRef<string[]>([]);
  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

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

  const save = async (): Promise<Review> => {
    const opened = await ensureOpened();
    return (await mutation.mutateAsync({ reviewId: opened.id, draft })) as Review;
  };
  const submit = async () => {
    const saved = await save();
    await mutation.mutateAsync({ reviewId: saved.id, submit: true });
  };
  const pickPhoto = async (pose: Pose, file: File) => {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const opened = await ensureOpened();
    await mutation.mutateAsync({ reviewId: opened.id, media: { pose, url } });
  };

  return (
    <>
      {/* En móvil la tira va debajo del título: al lado no cabe (medía 688 px a 390). */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <PageHeader eyebrow={`${t.week} ${review.weekNumber}`} title={es.pages.client.revision} />
        <CompletenessStrip completeness={completeness} />
      </div>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <PhotosBlock
            media={review.media}
            editable={editable}
            onPick={(pose, file) => void pickPhoto(pose, file)}
          />
          <WeightBlock log={weightLog} />
          <MeasurementsBlock
            fields={measurementFields}
            editable={editable}
            onChange={(id, value) => {
              setMeasurements((m) => ({ ...m, [id]: value }));
              void ensureOpened();
            }}
          />
        </div>
        <div className="flex flex-col gap-5">
          <QuestionnaireBlock
            fields={questionFields}
            editable={editable}
            onChange={(id, value) => {
              setResponses((r) => ({ ...r, [id]: value }));
              void ensureOpened();
            }}
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

/** Borrador en memoria para la semana actual: el mismo cálculo que hará el puerto al abrirla. */
function draftFor(
  client: Client,
  trainer: Trainer,
  types: MeasurementType[],
  questions: QuestionnaireQuestion[],
): Review {
  return openReview({
    client,
    timeZone: trainer.timeZone,
    at: todayCivil(trainer.timeZone),
    measurementTypes: types,
    questions,
    newId: () => "draft",
    now: new Date().toISOString(),
  });
}

/** Pantalla 05 · Revisión semanal: la revisión de la semana actual o un borrador en memoria. */
export function ReviewScreen() {
  const clientId = useSessionClientId();
  const trainer = useTrainer();
  const client = useClient(clientId);
  const review = useCurrentReview(clientId);
  const types = useMeasurementTypes();
  const questions = useQuestions();
  const logs = useWeightLogs(clientId);
  const queries = [trainer, client, review, types, questions, logs];

  if (queries.some((q) => q.isError)) {
    return <ErrorState onRetry={() => queries.forEach((q) => void q.refetch())} />;
  }
  if (
    !clientId ||
    !trainer.data ||
    !client.data ||
    review.data === undefined ||
    !types.data ||
    !questions.data ||
    !logs.data
  ) {
    return <LoadingState />;
  }

  const current = review.data ?? draftFor(client.data, trainer.data, types.data, questions.data);

  return (
    <ReviewEditor
      key={`${clientId}-${current.weekNumber}`}
      review={current}
      persisted={review.data !== null}
      clientId={clientId}
      types={types.data}
      questions={questions.data}
      logs={logs.data}
    />
  );
}
