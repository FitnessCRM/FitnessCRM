/** Latencia simulada para que los estados de carga existan de verdad en la UI. */
export function createLatency(ms: number): <T>(value: T) => Promise<T> {
  return (value) =>
    ms <= 0
      ? Promise.resolve(value)
      : new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
