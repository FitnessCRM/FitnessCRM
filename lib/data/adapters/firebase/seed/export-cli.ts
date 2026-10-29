import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { exportFirebase } from "./export";
import { SeedAbort, assertServiceAccountKey, resolveTarget } from "./target";

export interface ExportCliInput {
  /** Los argumentos, sin el ejecutable ni el script. */
  argv: string[];
  env: NodeJS.ProcessEnv;
  /** Raíz del repo: la clave y la salida no pueden estar dentro. */
  repoRoot: string;
}

function readArgs(argv: string[]) {
  try {
    return parseArgs({
      args: argv,
      options: {
        project: { type: "string" },
        key: { type: "string" },
        out: { type: "string" },
      },
      strict: true,
    }).values;
  } catch (error) {
    throw new SeedAbort(error instanceof Error ? error.message : String(error));
  }
}

async function exportCommand({ argv, env, repoRoot }: ExportCliInput): Promise<number> {
  const values = readArgs(argv);
  if (!values.out) throw new SeedAbort("Falta --out: la carpeta donde se escribe la exportación.");

  const target = resolveTarget({ project: values.project, key: values.key, env, repoRoot });
  // La exportación solo lee el proyecto real: con emuladores no hay nada que exportar.
  if (target.mode !== "real") {
    throw new SeedAbort(
      "La exportación solo lee el proyecto real: quita las variables de emulador.",
    );
  }
  const key = assertServiceAccountKey(JSON.parse(readFileSync(target.keyPath, "utf8")));

  console.log(`Exportación de ${target.projectId} · solo lectura`);
  await exportFirebase({ key, outDir: values.out, repoRoot, log: (line) => console.log(line) });
  return 0;
}

/** La exportación desde la línea de comandos. Devuelve el código de salida. */
export async function runExportCli(input: ExportCliInput): Promise<number> {
  try {
    return await exportCommand(input);
  } catch (error) {
    if (error instanceof SeedAbort) console.error(`\nAbortado: ${error.message}`);
    else console.error(error);
    return 1;
  }
}
