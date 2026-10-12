import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createAdminBackend } from "./admin";
import { runSeed, type SeedCredential } from "./run";
import { SeedAbort, assertServiceAccountKey, resolveTarget } from "./target";

export interface CliInput {
  /** Los argumentos, sin el ejecutable ni el script. */
  argv: string[];
  env: NodeJS.ProcessEnv;
  /** Raíz del repo, para rechazar una clave que esté dentro. */
  repoRoot: string;
}

function readArgs(argv: string[]) {
  try {
    return parseArgs({
      args: argv,
      options: {
        project: { type: "string" },
        key: { type: "string" },
        apply: { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false },
        "trainer-name": { type: "string" },
        "time-zone": { type: "string" },
      },
      strict: true,
    }).values;
  } catch (error) {
    // Un argumento que no existe: mejor decirlo que sembrar sin él.
    throw new SeedAbort(error instanceof Error ? error.message : String(error));
  }
}

async function seed({ argv, env, repoRoot }: CliInput): Promise<number> {
  const values = readArgs(argv);
  if (values.apply && values["dry-run"]) {
    throw new SeedAbort("--apply y --dry-run a la vez: elige uno.");
  }

  const target = resolveTarget({ project: values.project, key: values.key, env, repoRoot });
  // Con los emuladores no hay clave que cargar, ni siquiera la que apunte el entorno.
  if (target.mode === "emulator") delete env.GOOGLE_APPLICATION_CREDENTIALS;
  const key =
    target.mode === "real"
      ? assertServiceAccountKey(JSON.parse(readFileSync(target.keyPath, "utf8")))
      : undefined;

  console.log(
    `Siembra de demo · proyecto ${target.projectId} (${target.mode === "real" ? "REAL" : "emuladores"}) · ` +
      (values.apply ? "--apply: ESCRIBE" : "dry-run: solo lee"),
  );

  const credentials: SeedCredential[] = [];
  try {
    const result = await runSeed(createAdminBackend(target, key), {
      apply: values.apply,
      trainerName: values["trainer-name"],
      timeZone: values["time-zone"],
      now: () => new Date(),
      newPassword: () => randomBytes(18).toString("base64url"),
      credentials,
      log: (line) => console.log(line),
    });
    return result.invalid.length === 0 ? 0 : 1;
  } finally {
    // Aquí y solo aquí: ni archivo ni log. También si la siembra falla a medias, porque una cuenta
    // ya creada no se puede volver a crear y su contraseña se perdería.
    if (credentials.length > 0) {
      console.log("\nContraseñas temporales (solo se enseñan aquí y ahora):");
      for (const { email, password } of credentials) console.log(`  ${email}  ${password}`);
    }
  }
}

/** La siembra desde la línea de comandos. Devuelve el código de salida. */
export async function runCli(input: CliInput): Promise<number> {
  try {
    return await seed(input);
  } catch (error) {
    if (error instanceof SeedAbort) console.error(`\nAbortado: ${error.message}`);
    else console.error(error);
    return 1;
  }
}
