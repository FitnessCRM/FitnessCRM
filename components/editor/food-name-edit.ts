import {
  createFoodItem,
  renameFoodItem,
  type CatalogFood,
  type Food,
  type FoodItem,
} from "@/lib/domain";

/**
 * Lo que recuerda el campo del nombre de un alimento del menú mientras tiene el foco: el alimento
 * tal como estaba al entrar (`original`) y el texto que se ve, con sus espacios.
 *
 * Cada tecla vuelve a calcular la fila desde el original, nunca desde lo que dejó la tecla anterior:
 * «Avena» → «Avenas» → «Avena» recupera el vínculo con la biblioteca, porque el nombre vuelve a ser
 * el del original (§5, `renameFoodItem`). Los espacios de los extremos no cuentan: «Avena » tampoco
 * desvincula. El borrador se actualiza en cada tecla para que la pantalla sepa que hay cambios.
 */
export interface FoodNameEdit {
  original: FoodItem;
  text: string;
}

/** Lo que pasa al tocar el campo: el estado nuevo y la fila que va al borrador. */
export interface FoodNameEditStep {
  edit: FoodNameEdit;
  item: FoodItem;
}

/** Al entrar en el campo: la fila de ahora es el original. */
export function startFoodNameEdit(item: FoodItem): FoodNameEdit {
  return { original: item, text: item.name };
}

/** Una tecla: la fila es el original renombrado con el texto sin espacios en los extremos. */
export function typeFoodName(edit: FoodNameEdit, text: string): FoodNameEditStep {
  return { edit: { ...edit, text }, item: renameFoodItem(edit.original, text.trim()) };
}

/**
 * Escape: la fila y el texto vuelven al original. `null` si no hay nada que deshacer, para que
 * quien lo llama no toque el borrador.
 */
export function escapeFoodNameEdit(edit: FoodNameEdit): FoodNameEditStep | null {
  if (edit.text === edit.original.name) return null;
  return { edit: { ...edit, text: edit.original.name }, item: edit.original };
}

/**
 * Elegir una sugerencia: la fila pasa a salir de la biblioteca, con copia congelada del alimento
 * elegido (I29), el mismo id y los mismos gramos. Ese alimento es el nuevo original mientras el foco
 * siga en el campo: volver a escribir su nombre lo conserva.
 */
export function pickFoodForName(
  edit: FoodNameEdit,
  food: Pick<Food | CatalogFood, "id" | "name" | "composition">,
): FoodNameEditStep {
  const item = createFoodItem(food, edit.original.grams, () => edit.original.id);
  return { edit: startFoodNameEdit(item), item };
}
