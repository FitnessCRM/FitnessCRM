import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import prettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const firebasePatterns = {
  group: ["firebase", "firebase/*", "@firebase/*", "firebase-admin", "firebase-admin/*"],
  message:
    "El SDK de Firebase solo entra por lib/data/adapters/firebase/ (CLAUDE.md, regla 1): detrás de los puertos",
};

const stripePatterns = {
  group: ["stripe", "stripe/*"],
  message:
    "Stripe solo entra por las Edge Functions de supabase/functions/ (CLAUDE.md, regla 1): la app habla de «pago en línea» por su puerto",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettier,
  {
    /* Regla dura 1: ningún componente ni hook importa el SDK de backend. */
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["lib/data/adapters/firebase/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [firebasePatterns, stripePatterns] }] },
  },
  {
    /* Regla dura 1, Firebase: dentro de su adaptador sí, pero Stripe tampoco. */
    files: ["lib/data/adapters/firebase/**/*.{ts,tsx}"],
    rules: { "no-restricted-imports": ["error", { patterns: [stripePatterns] }] },
  },
  {
    /* Regla dura 2: el dominio es puro. Nada de React, Next, DOM ni capas superiores. */
    files: ["lib/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            firebasePatterns,
            { group: ["react", "react-*", "react/*"], message: "lib/domain no importa React" },
            { group: ["next", "next/*"], message: "lib/domain no importa Next" },
            {
              group: [
                "@/app/*",
                "@/components/*",
                "@/lib/data/*",
                "@/lib/i18n/*",
                "@/lib/design/*",
              ],
              message: "lib/domain no depende de capas superiores",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        "window",
        "document",
        "fetch",
        "localStorage",
        "navigator",
      ],
    },
  },
  {
    /*
     * La siembra de la demo (tarjeta 135) la usan los adaptadores de Firebase y de Supabase, así que
     * no depende de ninguno: ni de su código ni de su SDK.
     */
    files: ["lib/data/seed/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            firebasePatterns,
            stripePatterns,
            {
              group: ["@supabase/*", "@/lib/data/adapters/*", "**/adapters/*"],
              message:
                "lib/data/seed no depende de ningún adaptador ni SDK: cada backend traduce el plan a su forma",
            },
            {
              group: ["react", "react-*", "react/*", "next", "next/*"],
              message: "lib/data/seed no importa React ni Next",
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-e2e/**",
      "test-results/**",
      "playwright-report/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/sw.js",
      "public/swe-worker-*.js",
      "supabase/functions/**",
    ],
  },
];

export default eslintConfig;
