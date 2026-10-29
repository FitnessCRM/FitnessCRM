import { createHash } from "node:crypto";

/**
 * Ids de Supabase derivados del id de Firebase (tarjeta 119, Fase 8). Son uuid v5 con un espacio de
 * nombres fijo: el mismo id de origen da siempre el mismo uuid, así que volver a cargar no duplica
 * nada y no hace falta guardar una tabla de equivalencias.
 *
 * Los uid de Firebase no son uuid, y los ids de los documentos de clientes pueden coincidir con
 * los de otra colección: por eso el prefijo `client:` en los clientes.
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

/** El uid de Auth de un entrenador o de un cliente. Vale igual para la cuenta y para su entrenador. */
export const accountIdFor = (uid: string): string => supabaseIdFor(uid);

/** La ficha de un cliente. Su id no es un uid de Auth: lleva prefijo para no chocar con uno. */
export const clientIdFor = (documentId: string): string => supabaseIdFor(`client:${documentId}`);
