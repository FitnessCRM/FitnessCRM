import Link from "next/link";
import { workoutDates, type CivilDate, type WorkoutLog } from "@/lib/domain";
import { formatCivilDate, formatShortDate } from "@/lib/format";
import { es } from "@/lib/i18n/es";

const t = es.screensProgress.workouts;

/** Últimos entrenos registrados, cada uno con enlace para corregirlo, y la entrada a otro día. */
export function WorkoutsCard({ logs, today }: { logs: WorkoutLog[]; today: CivilDate }) {
  const recent = workoutDates(logs, 5);
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="section-title">{t.title}</h2>
      <p className="text-text-muted text-[13px]">{t.hint}</p>
      {recent.length === 0 ? (
        <p className="text-text-subtle text-[13px]">{t.empty}</p>
      ) : (
        recent.map(({ date, sets }) => (
          <Link
            key={date}
            href={`/progress/workouts?date=${date}`}
            className="border-border-subtle bg-surface hover:border-border-emphasis flex min-h-11 items-center gap-3.5 rounded-xl border px-5 py-3 transition-colors"
          >
            <time
              dateTime={date}
              title={formatCivilDate(date)}
              className="flex-1 text-[15px] font-semibold"
            >
              {date === today ? es.screensProgress.reviews.today : formatShortDate(date, today)}
            </time>
            <span className="text-text-muted text-xs">
              {sets} {sets === 1 ? t.set : t.sets}
            </span>
          </Link>
        ))
      )}
      <Link
        href="/progress/workouts"
        className="border-border-emphasis text-text-muted hover:border-accent hover:text-text-primary tracking-label inline-flex min-h-8 items-center justify-center rounded-full border px-3.5 py-1.5 text-xs uppercase"
      >
        {t.other}
      </Link>
    </section>
  );
}
