import { APP_NAME } from "@/lib/i18n/es";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-2xl font-bold tracking-wide">{APP_NAME}</h1>
    </main>
  );
}
