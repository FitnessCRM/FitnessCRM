import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de humo de punta a punta (tarjeta 130, Fase 7.4 del plan de migración), contra Supabase
 * local y con `NEXT_PUBLIC_DATA_BACKEND=supabase`. No van en la CI. Antes de `pnpm test:e2e`:
 *
 *   supabase start
 *   supabase db reset
 *
 * y las mismas tres variables que el contrato del adaptador (las da `supabase status -o env`):
 * SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY y SUPABASE_TEST_SERVICE_ROLE_KEY. La semilla
 * (`e2e/global-setup.ts`) solo escribe en la instancia local.
 *
 * La app de las pruebas corre con `next dev` en el puerto 3200 y construye en `.next-e2e`, así que no
 * pisa el `.next` de quien tenga `pnpm dev` abierto.
 */
const PORT = 3200;
const supabaseUrl = process.env.SUPABASE_TEST_URL ?? "";
const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";

export default defineConfig({
  testDir: "e2e",
  // Los tres recorridos comparten la semilla: uno detrás de otro.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Con el Chromium del entorno si no se ha descargado el de Playwright.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_DATA_BACKEND: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
