"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { QueryBoundary } from "@/components/ui/query-boundary";
import { LoadingState } from "@/components/ui/states";
import type { QuestionnaireQuestion, ResponseFormat } from "@/lib/domain";
import { useQuestions, useQuestionsWithResponses, useSaveQuestion } from "@/lib/data/hooks";
import { es } from "@/lib/i18n/es";
import { cn } from "@/lib/utils";
import { CatalogList } from "./catalog-list";

const t = es.screensQuestionnaire;

interface Draft {
  prompt: string;
  format: ResponseFormat;
}

const draftOf = (question: QuestionnaireQuestion): Draft => ({
  prompt: question.prompt,
  format: question.format,
});

const newDraft = (): Draft => ({ prompt: "", format: { kind: "escala", min: 1, max: 5 } });

const sameDraft = (a: Draft, b: Draft) =>
  a.prompt === b.prompt && JSON.stringify(a.format) === JSON.stringify(b.format);

/** Pantalla 15 · Cuestionario de revisión. Catálogo ordenable del entrenador. */
export function QuestionnaireScreen() {
  const questions = useQuestions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={es.pages.trainer.cuestionario} />
      <QueryBoundary query={questions} isEmpty={() => false} empty={null}>
        {(data) => <Questionnaire questions={data} />}
      </QueryBoundary>
    </div>
  );
}

function Questionnaire({ questions }: { questions: QuestionnaireQuestion[] }) {
  const save = useSaveQuestion();
  const active = questions.filter((q) => q.status === "activa");
  const archived = questions.filter((q) => q.status === "archivada");
  const locked = useQuestionsWithResponses(active.map((q) => q.id));

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [added, setAdded] = useState<{ tempId: string; draft: Draft }[]>([]);

  const draftFor = (question: QuestionnaireQuestion) => drafts[question.id] ?? draftOf(question);
  const isDirty =
    added.length > 0 ||
    active.some((q) => {
      const draft = drafts[q.id];
      return draft !== undefined && !sameDraft(draft, draftOf(q));
    });

  const edit = (id: string, changes: Partial<Draft>) =>
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? draftOf(active.find((q) => q.id === id)!)), ...changes },
    }));

  const onSave = async () => {
    for (const question of active) {
      const draft = drafts[question.id];
      if (!draft || sameDraft(draft, draftOf(question)) || draft.prompt.trim() === "") continue;
      // I15: el formato solo viaja si esta pregunta todavía puede cambiarlo.
      const changes = locked.data?.has(question.id)
        ? { prompt: draft.prompt.trim() }
        : { prompt: draft.prompt.trim(), format: draft.format };
      await save.mutateAsync({ questionId: question.id, changes });
    }
    for (const row of added) {
      if (row.draft.prompt.trim() === "") continue;
      await save.mutateAsync({
        create: { prompt: row.draft.prompt.trim(), format: row.draft.format },
      });
    }
    setDrafts({});
    setAdded([]);
  };

  const move = async (id: string, direction: -1 | 1) => {
    const ids = active.map((q) => q.id);
    const from = ids.indexOf(id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    await save.mutateAsync({ reorder: ids });
  };

  return (
    <CatalogList
      hint={t.hint}
      active={active}
      archived={archived}
      addLabel={t.add}
      emptyTitle={t.empty.title}
      emptyHint={t.empty.hint}
      isSaving={save.isPending}
      hasError={save.isError}
      isDirty={isDirty}
      pending={added.map((row, index) => (
        <div key={row.tempId} className="border-accent-outline rounded-lg border px-4 py-3">
          <QuestionRow
            draft={row.draft}
            locked={false}
            isLoadingLock={false}
            onChange={(changes) =>
              setAdded((prev) =>
                prev.map((r, i) => (i === index ? { ...r, draft: { ...r.draft, ...changes } } : r)),
              )
            }
          />
        </div>
      ))}
      labelOf={(q) => q.prompt}
      onMove={move}
      onArchive={(id) => void save.mutateAsync({ archive: id })}
      onUnarchive={(id) => void save.mutateAsync({ unarchive: id })}
      onAdd={() =>
        setAdded((prev) => [...prev, { tempId: `nueva-${prev.length + 1}`, draft: newDraft() }])
      }
      onSave={() => void onSave()}
      renderRow={(question) => (
        <QuestionRow
          draft={draftFor(question)}
          locked={locked.data?.has(question.id) ?? false}
          isLoadingLock={locked.isPending}
          onChange={(changes) => edit(question.id, changes)}
        />
      )}
      renderArchivedRow={(question) => (
        <span>
          {question.prompt}
          <span className="text-text-subtle ml-2 text-xs">{formatLabel(question.format)}</span>
        </span>
      )}
    />
  );
}

function formatLabel(format: ResponseFormat): string {
  return format.kind === "escala" ? `${t.scale} ${format.min}–${format.max}` : t.text;
}

function QuestionRow({
  draft,
  locked,
  isLoadingLock,
  onChange,
}: {
  draft: Draft;
  locked: boolean;
  isLoadingLock: boolean;
  onChange: (changes: Partial<Draft>) => void;
}) {
  const scale = draft.format.kind === "escala" ? draft.format : null;
  const rangeInvalid = scale !== null && scale.max <= scale.min;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          aria-label={t.prompt}
          placeholder={t.promptPlaceholder}
          value={draft.prompt}
          onChange={(event) => onChange({ prompt: event.target.value })}
          aria-invalid={draft.prompt.trim() === "" || undefined}
          className="h-10 min-w-[220px] flex-1 text-[14px]"
        />

        {isLoadingLock ? <LoadingState className="py-0" /> : null}

        {/* I15: con respuestas, el formato se ve bloqueado. El enunciado sigue editándose. */}
        <div
          role="group"
          aria-label={t.format}
          className={cn("flex items-center gap-1", locked && "opacity-60")}
        >
          {(["escala", "texto"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={locked}
              aria-pressed={draft.format.kind === kind}
              onClick={() =>
                onChange({
                  format: kind === "escala" ? { kind, min: 1, max: 5 } : { kind: "texto" },
                })
              }
              className={cn(
                "focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-[13px] transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed",
                draft.format.kind === kind
                  ? "border-border-strong bg-surface-overlay text-text-primary"
                  : "border-border-emphasis text-text-muted",
              )}
            >
              {kind === "escala" ? t.scale : t.text}
            </button>
          ))}

          {scale ? (
            <span className="text-text-muted ml-1.5 flex items-center gap-1.5 text-[13px]">
              {t.from}
              <Input
                aria-label={`${t.scale} · ${t.from}`}
                inputMode="numeric"
                disabled={locked}
                value={String(scale.min)}
                onChange={(event) =>
                  onChange({
                    format: {
                      kind: "escala",
                      min: Number(event.target.value) || 0,
                      max: scale.max,
                    },
                  })
                }
                className="h-9 w-14 px-2 text-center text-[13px]"
              />
              {t.to}
              <Input
                aria-label={`${t.scale} · ${t.to}`}
                inputMode="numeric"
                disabled={locked}
                value={String(scale.max)}
                onChange={(event) =>
                  onChange({
                    format: {
                      kind: "escala",
                      min: scale.min,
                      max: Number(event.target.value) || 0,
                    },
                  })
                }
                aria-invalid={rangeInvalid || undefined}
                className="h-9 w-14 px-2 text-center text-[13px]"
              />
            </span>
          ) : null}
        </div>
      </div>

      {locked ? <p className="text-text-subtle text-xs">{t.locked}</p> : null}
      {rangeInvalid ? <p className="text-danger text-xs">{t.rangeInvalid}</p> : null}
      {draft.prompt.trim() === "" ? (
        <p className="text-danger text-xs">{t.promptRequired}</p>
      ) : null}
    </div>
  );
}
