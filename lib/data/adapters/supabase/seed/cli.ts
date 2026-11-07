import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { createRestSeedBackend } from "./rest-backend";
import { runSeed, type SeedCredential } from "./run";
import { REMOTE_PROJECT_REF, SeedAbort, resolveTarget } from "./target";

export interface CliInput {
  /** Los argumentos, sin el ejecutable ni el script. */
  argv: string[];
  env: NodeJS.ProcessEnv;
}

function readArgs(argv: string[]) {
  try {
    return parseArgs({
      args: argv,
      options: {
        "trainer-email": { type: "string" },
        "trainer-name": { type: "string" },
        "time-zone": { type: "string" },
        "client-email": { type: "string", multiple: true },
        remote: { type: "boolean", default: false },
        apply: { type: "boolean", default: false },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (error) {
    // Un argumento que no existe: mejor decirlo que sembrar sin él.
    throw new SeedAbort(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Una contraseña temporal que pase cualquier política de Auth: minúscula, mayúscula, dígito y símbolo
 * (`-` o `_` de base64url), con 24 caracteres.
 */
export function temporaryPassword(): string {
  for (;;) {
    const candidate = randomBytes(18).toString("base64url");
    if (
      /[a-z]/.test(candidate) &&
      /[A-Z]/.test(candidate) &&
      /\d/.test(candidate) &&
      /[-_]/.test(candidate)
    ) {
      return candidate;
    }
  }
}

async function seed({ argv, env }: CliInput): Promise<number> {
  const values = readArgs(argv);
  if (!values["trainer-email"]) throw new SeedAbort("Falta --trainer-email.");

  const target = resolveTarget({ remote: values.remote, env });
  console.log(
    `Siembra de demo en Supabase · ${target.remote ? `proyecto REMOTO ${REMOTE_PROJECT_REF}` : `instancia local ${target.url}`} · ` +
      (values.apply ? "--apply: ESCRIBE" : "dry-run: solo lee"),
  );

  const credentials: SeedCredential[] = [];
  try {
    const result = await runSeed(createRestSeedBackend(target), {
      apply: values.apply,
      trainerEmail: values["trainer-email"],
      trainerName: values["trainer-name"],
      timeZone: values["time-zone"],
      clientEmails: values["client-email"] ?? [],
      now: () => new Date(),
      newPassword: temporaryPassword,
      credentials,
      log: (line) => console.log(line),
    });
    if (values.apply && result.blockers.length > 0) return 1;
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
    else console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}
