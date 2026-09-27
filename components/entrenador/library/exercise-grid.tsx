import { PlayIcon } from "lucide-react";
import type { Exercise } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Subtítulo de la tarjeta: "Pierna · barra". Grupo y material son texto libre del entrenador. */
function subtitle(exercise: Exercise): string {
  return [exercise.muscleGroup, exercise.equipment].filter(Boolean).join(" · ");
}

/** Rejilla de la biblioteca. Al pulsar una tarjeta se edita a la derecha. */
export function ExerciseGrid({
  exercises,
  selectedId,
  onSelect,
}: {
  exercises: Exercise[];
  selectedId: string | undefined;
  onSelect: (exerciseId: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 max-xl:grid-cols-2 max-sm:grid-cols-1">
      {exercises.map((exercise) => {
        const selected = exercise.id === selectedId;
        return (
          <article
            key={exercise.id}
            className={cn(
              "bg-surface overflow-hidden rounded-xl border transition-colors",
              selected ? "border-accent" : "border-border-subtle hover:border-border-emphasis",
            )}
          >
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(exercise.id)}
              className="focus-visible:ring-ring/50 block w-full text-left outline-none focus-visible:ring-[3px]"
            >
              <span
                aria-hidden
                className="flex h-[108px] items-center justify-center bg-[repeating-linear-gradient(45deg,var(--color-surface-raised),var(--color-surface-raised)_8px,var(--color-surface-overlay)_8px,var(--color-surface-overlay)_16px)]"
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full pl-0.5",
                    selected ? "bg-accent text-on-accent" : "bg-border-strong text-text-primary",
                  )}
                >
                  <PlayIcon className="size-3.5 fill-current" />
                </span>
              </span>
              <span className="border-border-subtle block border-t px-4 py-3.5">
                <span className="font-display block text-[15px] font-bold uppercase">
                  {exercise.name}
                </span>
                <span className="text-text-muted mt-0.5 block text-xs">{subtitle(exercise)}</span>
              </span>
            </button>
          </article>
        );
      })}
    </div>
  );
}
