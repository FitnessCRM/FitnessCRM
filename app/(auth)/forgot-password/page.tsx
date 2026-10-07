import { es } from "@/lib/i18n/es";
import { LoginHero } from "@/components/login-hero";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata = { title: es.pages.forgotPassword.title };

/** Mismo armazón que el acceso (01): panel de marca a la izquierda y la tarjeta a la derecha. */
export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <div className="border-border-subtle flex flex-col lg:w-[56%] lg:shrink-0 lg:border-r">
        <LoginHero />
      </div>

      <div className="bg-surface/40 flex flex-1 flex-col items-center justify-center px-6 py-12 lg:py-0">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
