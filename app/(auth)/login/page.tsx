import { es } from "@/lib/i18n/es";
import { LoginHero } from "@/components/login-hero";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: es.pages.login.title };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <div className="border-border-subtle flex flex-col lg:w-[640px] lg:shrink-0 lg:border-r">
        <LoginHero />
      </div>

      <div className="bg-surface/40 flex flex-1 flex-col items-center justify-center px-6 py-12 lg:py-0">
        <LoginForm />
      </div>
    </div>
  );
}
