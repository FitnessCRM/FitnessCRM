/** Error de regla de negocio. El mensaje es técnico; la UI traduce por `code`. */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
