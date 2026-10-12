import path from "node:path";

/** El único proyecto real contra el que se permite sembrar. */
export const REAL_PROJECT_ID = "fitnesscrm-fb1ef";

/** Los proyectos `demo-…` solo existen en los emuladores: Firebase no los resuelve contra nada real. */
const EMULATOR_PROJECT = /^demo-[a-z0-9-]+$/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]):\d+$/;

/** La siembra se niega a seguir. El mensaje es para quien la ejecuta. */
export class SeedAbort extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedAbort";
  }
}

export type SeedTarget =
  | { mode: "emulator"; projectId: string }
  | { mode: "real"; projectId: typeof REAL_PROJECT_ID; keyPath: string };

export interface TargetInput {
  /** `--project`. Siempre explícito: no se deduce de la clave ni del entorno. */
  project?: string;
  /** `--key`. */
  key?: string;
  env: Record<string, string | undefined>;
  /** Raíz del repo: una clave dentro de él acabaría commiteada algún día. */
  repoRoot: string;
}

function isInside(directory: string, file: string): boolean {
  const relative = path.relative(path.resolve(directory), path.resolve(file));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/**
 * Contra qué se ejecuta la siembra, decidido antes de cargar nada.
 *
 * - **Emuladores**: las dos variables (`FIRESTORE_EMULATOR_HOST` y `FIREBASE_AUTH_EMULATOR_HOST`),
 *   apuntando a esta máquina, y un proyecto `demo-…`. No se carga ninguna clave. Con una sola
 *   variable se aborta: el SDK de administración mira cada una por separado, y la mitad sin
 *   emulador escribiría en el proyecto real.
 * - **Proyecto real**: ninguna de las dos variables, `--project` igual a `fitnesscrm-fb1ef` y una
 *   clave de cuenta de servicio fuera del repo (`--key` o `GOOGLE_APPLICATION_CREDENTIALS`).
 */
export function resolveTarget({ project, key, env, repoRoot }: TargetInput): SeedTarget {
  if (!project)
    throw new SeedAbort("Falta --project: se dice siempre contra qué proyecto se siembra.");
  const firestoreHost = env.FIRESTORE_EMULATOR_HOST || undefined;
  const authHost = env.FIREBASE_AUTH_EMULATOR_HOST || undefined;

  if (firestoreHost !== undefined || authHost !== undefined) {
    if (firestoreHost === undefined || authHost === undefined) {
      throw new SeedAbort(
        "Solo está definida una de las dos variables de emulador (FIRESTORE_EMULATOR_HOST y " +
          "FIREBASE_AUTH_EMULATOR_HOST): la otra mitad iría contra el proyecto real. Define las dos o ninguna.",
      );
    }
    for (const host of [firestoreHost, authHost]) {
      if (!LOCAL_HOST.test(host)) {
        throw new SeedAbort(`El emulador tiene que estar en esta máquina, y «${host}» no lo es.`);
      }
    }
    if (!EMULATOR_PROJECT.test(project)) {
      throw new SeedAbort(
        `Con los emuladores el proyecto tiene que ser «demo-…» (por ejemplo demo-hector), no «${project}».`,
      );
    }
    if (key) throw new SeedAbort("Con los emuladores no se carga ninguna clave: quita --key.");
    return { mode: "emulator", projectId: project };
  }

  if (project !== REAL_PROJECT_ID) {
    throw new SeedAbort(
      `El único proyecto real permitido es «${REAL_PROJECT_ID}», no «${project}». ` +
        "Para los emuladores, define las dos variables de emulador.",
    );
  }
  const keyPath = key || env.GOOGLE_APPLICATION_CREDENTIALS || undefined;
  if (!keyPath) {
    throw new SeedAbort(
      "Falta la clave de cuenta de servicio: --key o GOOGLE_APPLICATION_CREDENTIALS.",
    );
  }
  if (isInside(repoRoot, keyPath)) {
    throw new SeedAbort("La clave está dentro del repo. Sácala de ahí antes de usarla.");
  }
  return { mode: "real", projectId: REAL_PROJECT_ID, keyPath: path.resolve(keyPath) };
}

/** Lo que la siembra usa de una clave de cuenta de servicio. */
export interface ServiceAccountKey {
  projectId: typeof REAL_PROJECT_ID;
  clientEmail: string;
  privateKey: string;
}

/**
 * Comprueba que el JSON leído es una clave de cuenta de servicio del proyecto permitido. Los
 * mensajes no llevan nada de la clave salvo su `project_id`, que no es secreto.
 */
export function assertServiceAccountKey(json: unknown): ServiceAccountKey {
  const key = (typeof json === "object" && json !== null ? json : {}) as Record<string, unknown>;
  if (key.type !== "service_account") {
    throw new SeedAbort("El archivo de --key no es una clave de cuenta de servicio.");
  }
  if (key.project_id !== REAL_PROJECT_ID) {
    throw new SeedAbort(
      `La clave es del proyecto «${String(key.project_id)}» y el único permitido es «${REAL_PROJECT_ID}».`,
    );
  }
  if (typeof key.client_email !== "string" || typeof key.private_key !== "string") {
    throw new SeedAbort("A la clave le falta client_email o private_key.");
  }
  return {
    projectId: REAL_PROJECT_ID,
    clientEmail: key.client_email,
    privateKey: key.private_key,
  };
}
