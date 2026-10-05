import { collection, doc, type Firestore } from "firebase/firestore";

/** Lo que cada puerto del adaptador de Firebase necesita. */
export interface FirebaseContext {
  db: Firestore;
  /** Instante actual en UTC ISO. Inyectable para que los tests fijen el reloj. */
  now: () => string;
  /** Id nuevo de documento. Firestore lo genera en local, sin red. */
  newId: () => string;
}

export function createFirebaseContext(
  db: Firestore,
  overrides: Partial<Omit<FirebaseContext, "db">> = {},
): FirebaseContext {
  return {
    db,
    now: overrides.now ?? (() => new Date().toISOString()),
    newId: overrides.newId ?? (() => doc(collection(db, "_ids")).id),
  };
}
