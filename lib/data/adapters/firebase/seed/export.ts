import fs from "node:fs";
import path from "node:path";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  EXPORT_COLLECTIONS,
  serializeValue,
  toAuthAccountRecord,
  type AuthAccountRecord,
} from "./export-data";
import { SeedAbort, isInside, type ServiceAccountKey } from "./target";

export interface ExportOptions {
  key: ServiceAccountKey;
  /** Carpeta de salida. Tiene que estar vacía (o no existir) y fuera del repo. */
  outDir: string;
  /** Raíz del repo: una exportación dentro acabaría commiteada algún día. */
  repoRoot: string;
  log: (line: string) => void;
}

/** Lo que queda escrito al terminar, sin datos personales: para comprobar la carga después. */
export interface ExportManifest {
  exportedAt: string;
  projectId: string;
  collections: Record<string, number>;
  authAccounts: number;
}

/** Una fila por documento: el id aparte, para no chocar con un campo llamado `id`. */
interface ExportedDocument {
  id: string;
  data: unknown;
}

function prepareOutDir(outDir: string, repoRoot: string): void {
  if (isInside(repoRoot, outDir)) {
    throw new SeedAbort("La carpeta de salida está dentro del repo. Elige una fuera de él.");
  }
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) {
    throw new SeedAbort(`La carpeta «${outDir}» ya tiene ficheros. Usa una vacía o nueva.`);
  }
  fs.mkdirSync(outDir, { recursive: true });
}

function writeJson(outDir: string, name: string, value: unknown): void {
  fs.writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2), "utf8");
}

/**
 * Lee de Firebase, en solo lectura, las colecciones del plan y las cuentas de Auth, y lo escribe en
 * `outDir`. No escribe nunca en Firebase: solo `get()` y `listUsers()`. Las contraseñas no se leen
 * del todo: el hash y el salt se descartan en `toAuthAccountRecord`.
 *
 * Es el único lugar que lee el proyecto con el SDK de administración, como `admin.ts` para la
 * siembra: salta las reglas de seguridad y por eso no se usa desde la app.
 */
export async function exportFirebase({
  key,
  outDir,
  repoRoot,
  log,
}: ExportOptions): Promise<ExportManifest> {
  prepareOutDir(outDir, repoRoot);

  const app = initializeApp(
    {
      projectId: key.projectId,
      credential: cert({
        projectId: key.projectId,
        clientEmail: key.clientEmail,
        privateKey: key.privateKey,
      }),
    },
    "migrate-export",
  );
  const db = getFirestore(app);
  const auth = getAuth(app);

  const collections: Record<string, number> = {};
  for (const name of EXPORT_COLLECTIONS) {
    const snap = await db.collection(name).get();
    const rows: ExportedDocument[] = snap.docs.map((doc) => ({
      id: doc.id,
      data: serializeValue(doc.data()),
    }));
    writeJson(outDir, `${name}.json`, rows);
    collections[name] = rows.length;
    log(`${name}: ${rows.length}`);
  }

  const accounts: AuthAccountRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) accounts.push(toAuthAccountRecord(user));
    pageToken = page.pageToken;
  } while (pageToken);
  writeJson(outDir, "auth-accounts.json", accounts);
  log(`cuentas de Auth: ${accounts.length}`);

  const manifest: ExportManifest = {
    exportedAt: new Date().toISOString(),
    projectId: key.projectId,
    collections,
    authAccounts: accounts.length,
  };
  writeJson(outDir, "manifest.json", manifest);
  log(`Escrito en ${outDir}. Contiene datos personales: no lo subas a ningún sitio.`);
  return manifest;
}
