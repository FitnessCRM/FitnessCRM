import { es } from "@/lib/i18n/es";

export const metadata = { title: es.pages.login.title };

export default function LoginPage() {
  return (
    <section className="bg-surface border-border-subtle w-full max-w-[420px] rounded-xl border p-9">
      <h1 className="font-display text-display-md font-bold uppercase">{es.pages.login.title}</h1>
      <p className="text-text-muted mt-1 text-sm">{es.pages.login.subtitle}</p>
    </section>
  );
}
