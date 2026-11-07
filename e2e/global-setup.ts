import fs from "node:fs";
import path from "node:path";
import { seedE2e } from "@/lib/data/adapters/supabase/seed/e2e";

/** Ruta donde la semilla deja sus ids para los recorridos. Fuera de git (`.gitignore`). */
export const SEED_FILE = path.join(__dirname, ".seed.json");

export default async function globalSetup(): Promise<void> {
  const url = process.env.SUPABASE_TEST_URL;
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
  const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      "Faltan SUPABASE_TEST_URL, SUPABASE_TEST_ANON_KEY o SUPABASE_TEST_SERVICE_ROLE_KEY: arranca " +
        "Supabase local (`supabase start`) y cópialas de `supabase status -o env`.",
    );
  }
  const seed = await seedE2e({ url, anonKey, serviceKey });
  fs.writeFileSync(SEED_FILE, JSON.stringify(seed));
}
