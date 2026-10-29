/**
 * Exportación de Firebase para la migración a Supabase (tarjeta 119, Fase 8 del plan). Solo lee.
 *
 * USO
 *
 *   pnpm migrate:firebase:export --project fitnesscrm-fb1ef --key "C:\<fuera-del-repo>\<clave>.json" --out "C:\<fuera-del-repo>\export"
 *
 * ARGUMENTOS
 *
 *   --project <id>   Obligatorio. Solo `fitnesscrm-fb1ef`.
 *   --key <ruta>     Clave de cuenta de servicio, fuera del repo. También vale GOOGLE_APPLICATION_CREDENTIALS.
 *   --out <carpeta>  Obligatoria. Vacía o nueva, y fuera del repo.
 *
 * QUÉ ESCRIBE
 *
 *   Un JSON por colección (`<colección>.json`), `auth-accounts.json` sin hashes ni salts y
 *   `manifest.json` con los conteos. Todo contiene datos personales.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Import dinámico, como en `scripts/seed-demo-trainer.ts`: el SDK de administración solo entra por
// `lib/data/adapters/firebase/seed/` (CLAUDE.md, regla 1).
void import("@/lib/data/adapters/firebase/seed/export-cli")
  .then(({ runExportCli }) =>
    runExportCli({ argv: process.argv.slice(2), env: process.env, repoRoot }),
  )
  .then((code) => process.exit(code));
