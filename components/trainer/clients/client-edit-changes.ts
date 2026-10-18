import type { ClientChanges } from "@/lib/data/ports";
import type { EditValues } from "./client-edit-form";

/** Lo que el formulario sabe de qué ha tocado el entrenador (`dirtyFields` de react-hook-form). */
export interface EditDirtyFields {
  macrosVisible?: boolean;
}

/**
 * Los cambios que la edición manda al puerto. `macrosVisible` solo viaja si el entrenador lo ha
 * cambiado respecto al valor con el que se cargó el formulario: el cliente también lo cambia desde
 * su perfil (I11), y mandarlo siempre pisaría en silencio lo que hiciera mientras la ficha estaba
 * abierta. Marcarlo y dejarlo como estaba no cuenta como cambio.
 */
export function clientEditChanges(values: EditValues, dirty: EditDirtyFields): ClientChanges {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone,
    goal: values.goal,
    level: values.level,
    initialNotes: values.initialNotes,
    reviewCadence: { everyDays: Number(values.reviewEveryDays) },
    ...(dirty.macrosVisible ? { macrosVisible: values.macrosVisible } : {}),
  };
}
