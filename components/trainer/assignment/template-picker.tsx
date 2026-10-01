"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface PickerOption {
  id: string;
  name: string;
  details: string;
}

interface Labels {
  title: string;
  status: string;
  fromTemplate: string;
  fromScratch: string;
  selected: string;
  scratchLink: string;
  scratchHint: string;
  scratchButton: string;
  assign: string;
  assigning: string;
  empty: string;
  note: ReactNode;
}

/**
 * Tarjeta «Desde plantilla / Desde cero», común a Entreno y Menú. Desde plantilla copia la
 * seleccionada al cliente y sigue en el editor; desde cero va directa al editor.
 */
export function TemplatePicker({
  options,
  labels,
  editorHref,
  isAssigning,
  error,
  onAssign,
}: {
  options: PickerOption[];
  labels: Labels;
  editorHref: string;
  isAssigning: boolean;
  error: string | null;
  onAssign: (templateId: string) => void;
}) {
  const [mode, setMode] = useState<"template" | "scratch">("template");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <Card className="gap-4 p-5 sm:p-[26px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="section-title">{labels.title}</h2>
        <p className="text-text-subtle text-[13px]">{labels.status}</p>
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as "template" | "scratch")}>
        <TabsList variant="segmented">
          <TabsTrigger value="template" className="min-h-8">
            {labels.fromTemplate}
          </TabsTrigger>
          <TabsTrigger value="scratch" className="min-h-8">
            {labels.fromScratch}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "template" ? (
        <>
          {options.length === 0 ? (
            <p className="text-text-subtle text-sm">{labels.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2.5" role="radiogroup" aria-label={labels.title}>
              {options.map((option) => {
                const isSelected = option.id === selectedId;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setSelectedId(option.id)}
                      className={cn(
                        "focus-visible:ring-ring/50 flex min-h-14 w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors outline-none focus-visible:ring-[3px]",
                        isSelected
                          ? "border-accent/50 bg-surface-raised"
                          : "bg-surface-raised/60 hover:bg-surface-raised border-transparent",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-[15px] font-semibold">{option.name}</span>
                        <span className="text-text-muted block text-xs">{option.details}</span>
                      </span>
                      {isSelected ? (
                        <span className="font-display tracking-label text-accent shrink-0 text-[11px] uppercase">
                          {labels.selected}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href={editorHref}
            className="border-border-emphasis text-text-muted hover:text-text-primary focus-visible:ring-ring/50 flex min-h-11 items-center justify-center rounded-md border border-dashed px-4 text-center text-[13px] transition-colors outline-none focus-visible:ring-[3px]"
          >
            {labels.scratchLink}
          </Link>
          <p className="text-text-subtle text-xs">{labels.note}</p>
          {error ? (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          ) : null}
          <Button
            size="lg"
            className="w-full"
            disabled={selectedId === null || isAssigning}
            onClick={() => selectedId !== null && onAssign(selectedId)}
          >
            {isAssigning ? labels.assigning : labels.assign}
          </Button>
        </>
      ) : (
        <>
          <p className="text-text-muted text-sm">{labels.scratchHint}</p>
          <Button size="lg" className="w-full" asChild>
            <Link href={editorHref}>{labels.scratchButton}</Link>
          </Button>
        </>
      )}
    </Card>
  );
}
