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

/**
 * El catálogo común de alimentos no responde (§12). No es un fallo de la copia propia: el
 * entrenador sigue viendo y usando sus alimentos, y lo pendiente se publica cuando vuelve.
 */
export class FoodCatalogUnavailableError extends DomainError {
  static readonly code = "food_catalog.unavailable";

  constructor(message = "El catálogo común de alimentos no responde") {
    super(FoodCatalogUnavailableError.code, message);
    this.name = "FoodCatalogUnavailableError";
  }
}
