import { es } from "@/lib/i18n/es";
import { Brand } from "@/components/ui/brand";

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="font-display text-[28px] font-semibold">{number}</div>
      <div className="text-text-tertiary text-xs tracking-[1px] uppercase">{label}</div>
    </div>
  );
}

export function LoginHero() {
  const { hero, stats } = es.pages.login;

  return (
    <section className="flex h-full flex-col justify-between gap-12 p-8 lg:p-14">
      <Brand className="[&>span:first-child]:size-[34px] [&>span:last-child]:text-[22px] [&>span:last-child]:tracking-[2px]" />

      <div className="flex flex-col gap-5">
        <h2 className="font-display text-5xl leading-[0.98] font-bold tracking-[0.5px] uppercase lg:text-[76px]">
          {hero.headline.lead.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
          <span className="text-accent block">{hero.headline.accent}</span>
        </h2>
        <p className="text-text-secondary max-w-[400px] text-[17px] leading-normal">
          {hero.description}
        </p>
      </div>

      <div className="flex gap-9">
        <Stat number={stats.weeks.number} label={stats.weeks.label} />
        <Stat number={stats.reviews.number} label={stats.reviews.label} />
        <Stat number={stats.ratio.number} label={stats.ratio.label} />
      </div>
    </section>
  );
}
