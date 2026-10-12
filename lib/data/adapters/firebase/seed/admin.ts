import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { SeedBackend } from "./run";
import type { SeedTarget, ServiceAccountKey } from "./target";

/** gRPC `ALREADY_EXISTS`: lo que devuelve `create()` sobre un documento que ya está. */
const ALREADY_EXISTS = 6;
/** `getAll` admite muchas referencias, pero la petición tiene tamaño máximo. */
const READ_CHUNK = 100;

const codeOf = (error: unknown): unknown =>
  typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;

/**
 * El único archivo que importa el SDK de administración. Es de desarrollo y no entra en la app:
 * nada de `app/`, `components/` ni `lib/data/hooks/` lo importa, y no se exporta desde el `index.ts`
 * del adaptador. Salta las reglas de seguridad, así que quien lo usa valida antes con los esquemas
 * del dominio (`run.ts`).
 *
 * Con los emuladores no se pasa credencial: el SDK habla con ellos porque las dos variables de
 * entorno están definidas, que es lo que `resolveTarget` ya ha exigido.
 */
export function createAdminBackend(target: SeedTarget, key?: ServiceAccountKey): SeedBackend {
  if (target.mode === "real" && !key) throw new Error("El proyecto real exige la clave");
  const app = initializeApp(
    target.mode === "real"
      ? { projectId: target.projectId, credential: cert(key!) }
      : { projectId: target.projectId },
    `seed-${target.mode}`,
  );
  const auth = getAuth(app);
  const db = getFirestore(app);
  const ref = (collection: string, id: string) => db.collection(collection).doc(id);

  return {
    findAccount: async (email) => {
      try {
        const user = await auth.getUserByEmail(email);
        return { uid: user.uid, email: user.email ?? email, emailVerified: user.emailVerified };
      } catch (error) {
        if (codeOf(error) === "auth/user-not-found") return null;
        throw error;
      }
    },
    createAccount: async (email, password) => {
      const user = await auth.createUser({ email, password, emailVerified: true });
      return { uid: user.uid, email, emailVerified: user.emailVerified };
    },
    readDocs: async (paths) => {
      const found: (Record<string, unknown> | null)[] = [];
      for (let i = 0; i < paths.length; i += READ_CHUNK) {
        const refs = paths.slice(i, i + READ_CHUNK).map((p) => ref(p.collection, p.id));
        const snaps = await db.getAll(...refs);
        found.push(...snaps.map((snap) => (snap.exists ? (snap.data() ?? null) : null)));
      }
      return found;
    },
    createDoc: async (path, data) => {
      try {
        await ref(path.collection, path.id).create(data);
        return true;
      } catch (error) {
        if (codeOf(error) === ALREADY_EXISTS) return false;
        throw error;
      }
    },
    listIdsByTrainer: async (collection, trainerId) => {
      const snaps = await db
        .collection(collection)
        .where("trainerId", "==", trainerId)
        .select()
        .get();
      return snaps.docs.map((doc) => doc.id);
    },
    findTrainerIdsByEmail: async (email) => {
      const snaps = await db.collection("trainers").where("email", "==", email).select().get();
      return snaps.docs.map((doc) => doc.id);
    },
  };
}
