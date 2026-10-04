/** Quién es la cuenta: decide qué área se carga (panel del entrenador o área de cliente). */
export type SessionRole = "trainer" | "client";

/**
 * Sesión actual. Los ids son del dominio; nada de tokens ni de proveedores aquí. Sin cuenta
 * abierta, `role` es nulo y `trainerId` va vacío.
 */
export interface Session {
  trainerId: string;
  /** Cliente con el que se navega el área de cliente. Nulo si la sesión es solo de entrenador. */
  clientId: string | null;
  role: SessionRole | null;
}

export interface SessionPort {
  getSession(): Promise<Session>;
  login(email: string, password: string): Promise<Session>;
  logout(): Promise<void>;
}
