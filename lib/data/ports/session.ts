/**
 * Sesión actual. No hay auth real todavía: el adaptador decide quién está "dentro".
 * Los ids son del dominio; nada de tokens ni de proveedores aquí.
 */
export interface Session {
  trainerId: string;
  /** Cliente con el que se navega el área de cliente. Nulo si la sesión es solo de entrenador. */
  clientId: string | null;
}

export interface SessionPort {
  getSession(): Promise<Session>;
  login(email: string, password: string): Promise<Session>;
  logout(): Promise<void>;
}
