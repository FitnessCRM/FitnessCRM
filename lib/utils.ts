import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "Marta Ruiz" → "MR". Para los avatares de la demo. */
export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** "Marta Ruiz" → "Marta R.". Bloque de usuario de la nav del cliente. */
export function shortNameOf(firstName: string, lastName: string): string {
  const initial = lastName.charAt(0);
  return initial ? `${firstName} ${initial}.` : firstName;
}
