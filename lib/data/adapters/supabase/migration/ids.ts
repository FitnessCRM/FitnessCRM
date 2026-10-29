import { createHash } from "node:crypto";

/**
 * Ids de Supabase derivados de los ids de Firebase (tarjeta 119, Fase 8). Son uuid v5 con un espacio
 * de nombres fijo: el mismo origen da siempre el mismo uuid, así que volver a cargar no duplica nada
 * y no hace falta guardar una tabla de equivalencias.
 *
 * Cada tipo lleva su prefijo: un id de cliente y un id de ejercicio con el mismo texto no chocan.
 */
const NAMESPACE = "6f1c2a4e-8d3b-4f5a-9c2e-7b1d0a3e5f10";

export function supabaseIdFor(sourceKey: string): string {
  const bytes = createHash("sha1")
    .update(Buffer.from(NAMESPACE.replaceAll("-", ""), "hex"))
    .update(sourceKey, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type EntityKind =
  | "client"
  | "exercise"
  | "food"
  | "measurement-type"
  | "question"
  | "routine-template"
  | "menu-template"
  | "routine"
  | "menu"
  | "macro-targets"
  | "membership";

/** El id de un agregado o de una ficha, por su tipo y su id de Firebase. */
export const entityIdFor = (kind: EntityKind, sourceId: string): string =>
  supabaseIdFor(`${kind}:${sourceId}`);

/**
 * El id de una parte de un agregado (día, línea, comida, alimento del menú). Va ligado al id ya
 * convertido de su padre: la clave de esas tablas es (padre, id), y así un mismo id local en dos
 * rutinas da dos uuid distintos.
 */
export const childIdFor = (
  parentId: string,
  kind: "day" | "line" | "meal" | "item",
  sourceId: string,
): string => supabaseIdFor(`${parentId}/${kind}:${sourceId}`);

/** El uid de Auth de un entrenador o de un cliente. Vale igual para la cuenta y para su entrenador. */
export const accountIdFor = (uid: string): string => supabaseIdFor(uid);

/** La ficha de un cliente. Su id no es un uid de Auth: lleva prefijo para no chocar con uno. */
export const clientIdFor = (documentId: string): string => entityIdFor("client", documentId);
