import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      // Lógica pura de las Edge Functions (el webhook de Stripe): sin red y sin claves.
      "supabase/functions/_shared/**/*.test.ts",
    ],
    environment: "node",
  },
});
