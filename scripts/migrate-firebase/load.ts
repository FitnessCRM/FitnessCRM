/**
 * Carga de la exportación de Firebase en Supabase (tarjeta 119, Fase 8 del plan). Por defecto no
 * escribe nada: solo cuenta y valida. Con `--apply` escribe, y solo en la instancia local.
 *
 * USO
 *
 *   pnpm migrate:firebase:load --export "C:\<fuera-del-repo>\export" [--apply]
 *
 * VARIABLES
 *
 *   SUPABASE_URL                 Por defecto http://127.0.0.1:54321. Solo localhost, por ahora.
 *   SUPABASE_SERVICE_ROLE_KEY    Obligatoria. Nunca se imprime ni se escribe en el repo.
 *
 * QUÉ CARGA HOY
 *
 *   Cuentas de Auth (sin contraseña: restablecen por correo), entrenadores, clientes y perfiles.
 *   Lo demás (catálogos, planes, menús, membresías, revisiones, registros) llega en secciones
 *   siguientes, cada una con su aprobación.
 */
import fs from "node:fs";
import path from "node:path";
import {
  planPeople,
  type ExportedAccount,
  type ExportedDocument,
} from "@/lib/data/adapters/supabase/migration/people";
import { remapPeople } from "@/lib/data/adapters/supabase/migration/remap";
import { assertLocalUrl, loadPeople } from "@/lib/data/adapters/supabase/migration/load-people";

const DEFAULT_URL = "http://127.0.0.1:54321";

function readJson<T>(dir: string, name: string): T {
  return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) as T;
}

async function main(argv: string[], env: NodeJS.ProcessEnv): Promise<number> {
  const exportIndex = argv.indexOf("--export");
  const exportDir = exportIndex === -1 ? undefined : argv[exportIndex + 1];
  if (!exportDir) {
    console.error(
      "Falta --export <carpeta>: la exportación que sale de `migrate:firebase:export`.",
    );
    return 1;
  }
  const apply = argv.includes("--apply");
  const url = env.SUPABASE_URL || DEFAULT_URL;
  assertLocalUrl(url);

  const trainers = readJson<ExportedDocument[]>(exportDir, "trainers.json");
  const clients = readJson<ExportedDocument[]>(exportDir, "clients.json");
  const accounts = readJson<ExportedAccount[]>(exportDir, "auth-accounts.json");

  const remapped = remapPeople({ trainers, clients, accounts });
  const plan = planPeople(remapped);
  const linked = new Set(plan.profiles.map((profile) => profile.user_id));
  const linkedAccounts = remapped.accounts.filter((account) => linked.has(account.uid));

  console.log(`Entrenadores: ${plan.trainers.length}`);
  console.log(`Clientes: ${plan.clients.length}`);
  console.log(`Cuentas enlazadas: ${linkedAccounts.length}`);
  console.log(`Cuentas sin ficha: ${plan.unlinkedAccountUids.length} (no se cargan)`);
  console.log(`Clientes sin cuenta: ${plan.clientsWithoutAccount.length} (se cargan sin perfil)`);

  if (!apply) {
    console.log(
      "Simulación: no se ha escrito nada. Añade --apply para cargar en la instancia local.",
    );
    return 0;
  }

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("Falta SUPABASE_SERVICE_ROLE_KEY.");
    return 1;
  }
  const report = await loadPeople(plan, linkedAccounts, { url, serviceKey });
  console.log(
    `Cuentas creadas: ${report.authUsersCreated}, ya existían: ${report.authUsersSkipped}. ` +
      `Filas: entrenadores ${report.trainers}, clientes ${report.clients}, perfiles ${report.profiles}.`,
  );
  return 0;
}

void main(process.argv.slice(2), process.env)
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    // Los mensajes de la carga no llevan datos personales (solo ids y códigos HTTP).
    console.error(error instanceof Error ? error.message : "Error desconocido.");
    process.exit(1);
  });
