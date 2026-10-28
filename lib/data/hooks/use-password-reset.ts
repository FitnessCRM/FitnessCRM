"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { usePorts } from "./ports-provider";
import { queryKeys } from "./query-keys";

/** Pide el enlace de recuperación. Resuelve igual exista o no una cuenta con ese correo. */
export function useSendPasswordReset() {
  const ports = usePorts();
  return useMutation({
    mutationFn: (email: string) => ports.passwordReset.sendPasswordReset(email),
  });
}

/**
 * Comprueba el código del enlace de recuperación. Sin `code` no consulta nada. Un código caducado o
 * ya usado no se arregla reintentando, así que no reintenta. No se guarda (`gcTime: 0`): cada visita
 * lo pregunta. `staleTime` infinito evita que StrictMode, al volver a suscribirse, gaste otra vez el
 * código de Supabase, que es de un solo uso.
 */
export function useCheckPasswordResetCode(code: string | null) {
  const ports = usePorts();
  return useQuery({
    queryKey: queryKeys.passwordResetCode(code ?? ""),
    queryFn: () => ports.passwordReset.checkPasswordResetCode(code ?? ""),
    enabled: code !== null && code !== "",
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** Fija la contraseña nueva. No abre sesión: se vuelve a entrar con ella. */
export function useConfirmPasswordReset() {
  const ports = usePorts();
  return useMutation({
    mutationFn: (input: { code: string; password: string }) =>
      ports.passwordReset.confirmPasswordReset(input),
  });
}
