/** Ids legibles y únicos dentro del proceso. El backend real pondrá los suyos. */
export function createIdFactory(prefix = "id"): () => string {
  let counter = 0;
  return () => `${prefix}-${(++counter).toString(36)}-${Date.now().toString(36)}`;
}
