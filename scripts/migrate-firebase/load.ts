/**
 * Carga de la exportación de Firebase en Supabase (tarjeta 119, Fase 8 del plan). Por defecto no
 * escribe nada: valida cada colección con su esquema y cuenta. Con `--apply` escribe, y solo en la
 * instancia local.
 *
 * USO
 *
 *   pnpm migrate:firebase:load --export "C:\<fuera-del-repo>\export" [--apply]
 *
 * VARIABLES
 *
 *   SUPABASE_URL                 Por defecto http://127.0.0.1:54321. Solo localhost, por ahora.
 *   SUPABASE_SERVICE_ROLE_KEY    Obligatoria con --apply. Nunca se imprime ni se escribe en el repo.
 *
 * QUÉ CARGA HOY
 *
 *   Cuentas de Auth (sin contraseña: restablecen por correo), entrenadores, clientes y perfiles;
 *   catálogos (ejercicios, alimentos, tipos de medida, preguntas); plantillas, rutinas, menús,
 *   objetivos de macros y membresías; pesajes, revisiones (con sus medidas y respuestas) y registros
 *   de entrenamiento. Las fotos de las revisiones no se cargan (Fase 0.1).
 */
import fs from "node:fs";
import path from "node:path";
import {
  parsePlanData,
  PLAN_COLLECTIONS,
  findPlanViolations,
  loadCatalogAndPlans,
  type PlanCollection,
} from "@/lib/data/adapters/supabase/migration/load-catalog-plans";
import {
  findLogViolations,
  LOG_COLLECTIONS,
  loadReviewsAndLogs,
  parseLogData,
  reviewPhotosLeftOut,
  type LogCollection,
} from "@/lib/data/adapters/supabase/migration/load-logs";
import { loadPeople } from "@/lib/data/adapters/supabase/migration/load-people";
import {
  planPeople,
  type ExportedAccount,
  type ExportedDocument,
} from "@/lib/data/adapters/supabase/migration/people";
import { remapPeople } from "@/lib/data/adapters/supabase/migration/remap";
import { assertLocalUrl } from "@/lib/data/adapters/supabase/migration/rest";

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

  // Personas: se planifican primero, porque el resto referencia a sus ids.
  const trainers = readJson<ExportedDocument[]>(exportDir, "trainers.json");
  const clients = readJson<ExportedDocument[]>(exportDir, "clients.json");
  const accounts = readJson<ExportedAccount[]>(exportDir, "auth-accounts.json");
  const remapped = remapPeople({ trainers, clients, accounts });
  const people = planPeople(remapped);
  const linked = new Set(people.profiles.map((profile) => profile.user_id));
  const linkedAccounts = remapped.accounts.filter((account) => linked.has(account.uid));

  // Planes y catálogos: cada colección se valida antes de escribir nada.
  const documents = Object.fromEntries(
    PLAN_COLLECTIONS.map((name: PlanCollection) => [
      name,
      readJson<ExportedDocument[]>(exportDir, `${name}.json`),
    ]),
  ) as Record<PlanCollection, ExportedDocument[]>;
  const plan = parsePlanData(documents);

  // Registros: pesajes, revisiones y entrenamientos, después de los planes a los que referencian.
  const logDocuments = Object.fromEntries(
    LOG_COLLECTIONS.map((name: LogCollection) => [
      name,
      readJson<ExportedDocument[]>(exportDir, `${name}.json`),
    ]),
  ) as Record<LogCollection, ExportedDocument[]>;
  const logs = parseLogData(logDocuments);
  const problems = [...findPlanViolations(plan), ...findLogViolations(logs)];

  console.log(`Entrenadores: ${people.trainers.length}`);
  console.log(`Clientes: ${people.clients.length}`);
  console.log(`Cuentas enlazadas: ${linkedAccounts.length}`);
  console.log(`Cuentas sin ficha: ${people.unlinkedAccountUids.length} (no se cargan)`);
  console.log(`Clientes sin cuenta: ${people.clientsWithoutAccount.length} (se cargan sin perfil)`);
  console.log(
    `Ejercicios ${plan.exercises.length}, alimentos ${plan.foods.length}, ` +
      `rutinas ${plan.routines.length}, menús ${plan.menus.length}, ` +
      `objetivos ${plan.macroTargets.length}, membresías ${plan.memberships.length}`,
  );
  console.log(
    `Pesajes ${logs.weightLogs.length}, revisiones ${logs.reviews.length}, ` +
      `registros ${logs.workoutLogs.length}. Fotos fuera de la carga: ${reviewPhotosLeftOut(logs)}`,
  );
  if (problems.length > 0) {
    console.error(`Invariantes incumplidos: ${problems.join("; ")}`);
    return 1;
  }

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
  const target = { url, serviceKey };
  const report = await loadPeople(people, linkedAccounts, target);
  console.log(
    `Cuentas creadas: ${report.authUsersCreated}, ya existían: ${report.authUsersSkipped}. ` +
      `Entrenadores ${report.trainers}, clientes ${report.clients}, perfiles ${report.profiles}.`,
  );
  const counts = await loadCatalogAndPlans(plan, target);
  console.log(
    Object.entries(counts)
      .map(([table, rows]) => `${table} ${rows}`)
      .join(", "),
  );
  const logCounts = await loadReviewsAndLogs(logs, target);
  console.log(
    Object.entries(logCounts)
      .map(([table, rows]) => `${table} ${rows}`)
      .join(", "),
  );
  return 0;
}

void main(process.argv.slice(2), process.env)
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    // Los mensajes de la carga no llevan datos personales (solo ids, tablas y códigos).
    console.error(error instanceof Error ? error.message : "Error desconocido.");
    process.exit(1);
  });
