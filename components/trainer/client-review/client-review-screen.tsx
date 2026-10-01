"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { EmptyState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CivilDate, Client, Review, WeightLog } from "@/lib/domain";
import {
  useClient,
  useClientReviews,
  useReviewMutation,
  useTrainer,
  useWeightLogs,
} from "@/lib/data/hooks";
import { formatDecimal, formatShortDate, todayCivil } from "@/lib/format";
import { es } from "@/lib/i18n/es";
import { NativeSelect } from "@/components/ui/native-select";
import { FeedbackDialog } from "./feedback-dialog";
import { PhotosTab } from "./photos-tab";
import { QuestionnaireTab } from "./questionnaire-tab";
import { SentFeedback } from "./sent-feedback";
import { WeightTab } from "./weight-tab";

const t = es.screensTrainerReview;

/** Cuándo se envió la revisión (si no, cuándo se abrió): es la fecha con la que se la identifica. */
export const reviewDate = (review: Review): CivilDate =>
  (review.submittedAt ?? review.createdAt).slice(0, 10);

/**
 * Vuelta a la pantalla de origen: el dashboard si se llegó de ahí (`?from=dashboard`) y, si no,
 * el detalle del cliente, donde está el histórico de sus revisiones.
 */
function BackLink({ clientId }: { clientId: string }) {
  const from = useSearchParams().get("from");
  const href =
    from === "dashboard" ? "/dashboard" : from === "reviews" ? "/reviews" : `/clients/${clientId}`;
  return (
    <Link
      href={href}
      className="text-text-muted hover:text-text-primary focus-visible:ring-ring/50 -mb-3 inline-flex min-h-8 w-fit items-center gap-1.5 rounded-md text-[13px] outline-none focus-visible:ring-[3px]"
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      {from === "dashboard" ? t.backToDashboard : from === "reviews" ? t.backToReviews : t.back}
    </Link>
  );
}

const fullName = (c: Pick<Client, "firstName" | "lastName">) => `${c.firstName} ${c.lastName}`;

export const weightOf = (review: Review | undefined, logs: readonly WeightLog[]) =>
  logs.find((l) => l.id === review?.weightLogId)?.weightKg;

/**
 * Pantalla 14 · Revisión de cliente. Solo lee lo que el cliente envió: fotos (la comparación es
 * una acción explícita, I10), cuestionario congelado (I12) y el peso del mes. Abrir una revisión
 * `enviada` la pasa a `vista` y cierra la edición del cliente (I17).
 */
export function ClientReviewScreen({ clientId }: { clientId: string }) {
  const client = useClient(clientId);
  const reviews = useClientReviews(clientId);
  const logs = useWeightLogs(clientId);
  const trainer = useTrainer();
  const today = todayCivil(trainer.data?.timeZone);

  return (
    <div className="flex flex-col gap-6">
      <QueryBoundary
        query={client}
        empty={<EmptyState title={es.screensClientDetail.notFoundTitle} />}
      >
        {(c) => (
          <QueryBoundary
            query={reviews}
            isEmpty={(data) => (data ?? []).every((r) => r.status === "borrador")}
            empty={
              <>
                <BackLink clientId={c.id} />
                <PageHeader eyebrow={`${t.breadcrumb} / ${fullName(c)}`} title={t.title} />
                <EmptyState title={t.empty.title} description={t.empty.hint} />
              </>
            }
          >
            {(data) => (
              <ClientReview client={c} reviews={data} logs={logs.data ?? []} today={today} />
            )}
          </QueryBoundary>
        )}
      </QueryBoundary>
    </div>
  );
}

function ClientReview({
  client,
  reviews,
  logs,
  today,
}: {
  client: Client;
  reviews: Review[];
  logs: WeightLog[];
  today: CivilDate;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get("review");
  const from = searchParams.get("from");
  const mutation = useReviewMutation();

  // Los borradores los rellena el cliente: el entrenador solo ve lo enviado.
  const sent = reviews
    .filter((r) => r.status !== "borrador")
    .sort((a, b) => b.weekNumber - a.weekNumber);
  const found = sent.find((r) => r.id === requested);
  const review = found ?? sent[0]!;

  // Abrir una revisión enviada la marca como vista. Una sola vez por revisión, aunque React
  // monte el efecto dos veces en desarrollo.
  const marked = useRef(new Set<string>());
  const { mutate } = mutation;
  useEffect(() => {
    if (review.status !== "enviada" || marked.current.has(review.id)) return;
    marked.current.add(review.id);
    mutate({ reviewId: review.id, markViewed: true });
  }, [review.id, review.status, mutate]);

  const others = sent.filter((r) => r.id !== review.id);

  return (
    <>
      <BackLink clientId={client.id} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          eyebrow={`${t.breadcrumb} / ${fullName(client)}`}
          title={`${t.title} — ${es.screensReview.week} ${review.weekNumber}`}
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-text-subtle tracking-label text-[11px] uppercase">
              {t.pickerLabel}
            </span>
            <NativeSelect
              value={review.id}
              onChange={(event) =>
                router.replace(
                  `/clients/${client.id}/review?review=${event.target.value}${from ? `&from=${from}` : ""}`,
                )
              }
              className="border-accent-outline bg-surface h-11 text-[14px]"
            >
              {sent.map((r) => {
                const date = reviewDate(r);
                const kg = weightOf(r, logs);
                return (
                  <option key={r.id} value={r.id}>
                    {es.screensReview.week} {r.weekNumber} ·{" "}
                    {date === today ? t.today : formatShortDate(date, today)}
                    {kg !== undefined ? ` · ${formatDecimal(kg)} kg` : ""}
                  </option>
                );
              })}
            </NativeSelect>
          </label>
          {review.status === "revisada" ? null : <FeedbackDialog review={review} />}
        </div>
      </div>

      {review.status === "revisada" ? <SentFeedback review={review} today={today} /> : null}

      <Tabs defaultValue="evolution" className="gap-5">
        <TabsList aria-label={t.tabs.label} className="max-w-full">
          <TabsTrigger value="evolution">{t.tabs.evolution}</TabsTrigger>
          <TabsTrigger value="questionnaire">{t.tabs.questionnaire}</TabsTrigger>
        </TabsList>
        {/* Fotos y peso juntos: es lo que el entrenador cruza al analizar una revisión. En ancho
            (xl) el peso va a la derecha de las fotos; por debajo, debajo. */}
        <TabsContent value="evolution" className="flex flex-col gap-4">
          <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
            <div className="flex min-w-0 flex-col gap-4">
              <PhotosTab
                key={review.id}
                review={review}
                others={others}
                logs={logs}
                today={today}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <h2 className="section-title">{t.tabs.weight}</h2>
              <WeightTab key={review.id} review={review} logs={logs} today={today} stacked />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="questionnaire">
          <QuestionnaireTab review={review} />
        </TabsContent>
      </Tabs>
    </>
  );
}
