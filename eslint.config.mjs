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

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prettier,
  {
    /* Regla dura 1: ningún componente ni hook importa el SDK de backend. */
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["lib/data/adapters/firebase/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [firebasePatterns] }] },
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
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "public/sw.js",
      "public/swe-worker-*.js",
    ],
  },
];

export default eslintConfig;
