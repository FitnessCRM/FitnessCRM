import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type QueryConstraint,
  type Transaction,
} from "firebase/firestore";
import type { z } from "zod";
import { DomainError } from "@/lib/domain";
import type { FirebaseContext } from "./context";

/** Una colección de primer nivel por agregado del dominio (`docs/dominio.md` §4). */
export const COLLECTIONS = {
  trainers: "trainers",
  clients: "clients",
  memberships: "memberships",
  exercises: "exercises",
  /** La copia propia de los alimentos. El catálogo común no vive en Firestore (§12). */
  foods: "foods",
  routines: "routines",
  macroTargets: "macroTargets",
  menus: "menus",
  routineTemplates: "routineTemplates",
  menuTemplates: "menuTemplates",
  measurementTypes: "measurementTypes",
  questions: "questions",
  reviews: "reviews",
  weightLogs: "weightLogs",
  workoutLogs: "workoutLogs",
} as const;

/**
 * Banderas de inmutabilidad (I15, I26). No son campos del dominio: viven en el documento del tipo de
 * medida o de la pregunta para no recorrer el histórico de revisiones cada vez que se pregunta si
 * se puede cambiar la unidad o el formato. Las pone `true` la misma transacción que guarda la
 * primera medida o respuesta (adaptador de revisiones). Los esquemas zod las descartan al leer.
 */
export const FLAGS = {
  hasMeasurements: "hasMeasurements",
  hasResponses: "hasResponses",
} as const;

export const notFound = (what: string, id: string) =>
  new DomainError("not_found", `${what} ${id} no existe`);

export const ref = (ctx: FirebaseContext, name: string, id: string) => doc(ctx.db, name, id);

/** El documento tal como lo guarda el dominio: fechas y marcas de tiempo ya son texto ISO. */
export function parseDoc<S extends z.ZodType>(schema: S, snap: DocumentSnapshot): z.output<S> {
  return schema.parse({ ...snap.data(), id: snap.id });
}

/**
 * I1: un documento de otro entrenador es, para quien pregunta, un documento que no existe. Las
 * reglas de seguridad lo repiten en el servidor; esto es la comprobación de la aplicación.
 */
function isOwn(snap: DocumentSnapshot, trainerId: string): boolean {
  return snap.exists() && (snap.data() as DocumentData).trainerId === trainerId;
}

export async function readOwn<S extends z.ZodType>(
  ctx: FirebaseContext,
  name: string,
  schema: S,
  trainerId: string,
  id: string,
): Promise<z.output<S> | null> {
  const snap = await getDoc(ref(ctx, name, id));
  return isOwn(snap, trainerId) ? parseDoc(schema, snap) : null;
}

export async function requireOwn<S extends z.ZodType>(
  ctx: FirebaseContext,
  name: string,
  schema: S,
  trainerId: string,
  id: string,
  what: string,
): Promise<z.output<S>> {
  const found = await readOwn(ctx, name, schema, trainerId, id);
  if (!found) throw notFound(what, id);
  return found;
}

/**
 * Lectura dentro de una transacción. Devuelve también el documento sin parsear: las banderas y
 * cualquier campo ajeno al dominio solo se ven ahí.
 */
export async function txRequireOwn<S extends z.ZodType>(
  tx: Transaction,
  docRef: DocumentReference,
  schema: S,
  trainerId: string,
  what: string,
): Promise<{ value: z.output<S>; raw: DocumentData }> {
  const snap = await tx.get(docRef);
  if (!isOwn(snap, trainerId)) throw notFound(what, docRef.id);
  return { value: parseDoc(schema, snap), raw: snap.data() as DocumentData };
}

/**
 * Lista de un entrenador. Solo igualdades: Firestore las resuelve con sus índices simples, sin
 * índices compuestos. El orden se aplica en memoria, sobre colecciones pequeñas por cartera.
 */
export async function listOwn<S extends z.ZodType>(
  ctx: FirebaseContext,
  name: string,
  schema: S,
  trainerId: string,
  ...constraints: QueryConstraint[]
): Promise<z.output<S>[]> {
  const snaps = await getDocs(
    query(collection(ctx.db, name), where("trainerId", "==", trainerId), ...constraints),
  );
  return snaps.docs.map((d) => parseDoc(schema, d));
}
