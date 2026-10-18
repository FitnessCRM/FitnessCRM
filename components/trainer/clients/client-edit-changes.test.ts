import { createFormControl } from "react-hook-form";
import { describe, expect, it } from "vitest";
import { clientEditChanges } from "./client-edit-changes";
import type { EditValues } from "./client-edit-form";

const LOADED: EditValues = {
  firstName: "Marta",
  lastName: "Gil",
  email: "marta@email.com",
  phone: "+34 600 000 000",
  goal: "Fuerza",
  level: "Intermedio",
  initialNotes: "",
  startDate: "2026-08-01",
  macrosVisible: true,
  reviewEveryDays: "7",
};

/**
 * El formulario de edición sin React: el mismo control de react-hook-form, cargado con la ficha, y
 * los cambios entrando por el `onChange` de `register`, que es también el del `Controller` de la
 * casilla. Devuelve lo que la pantalla mandaría al puerto.
 */
function editForm(loaded: EditValues = LOADED) {
  const form = createFormControl<EditValues>({ defaultValues: loaded });
  const change = async (name: keyof EditValues, value: unknown) =>
    form.register(name).onChange({ target: { name, value }, type: "change" });
  const changes = () =>
    clientEditChanges(form.getValues(), {
      macrosVisible: form.control._formState.dirtyFields.macrosVisible,
    });
  return { change, changes };
}

describe("the trainer's edit does not overwrite the client's flag (I11)", () => {
  it("editing the phone does not send macrosVisible", async () => {
    const form = editForm();
    await form.change("phone", "+34 611 111 111");
    const changes = form.changes();
    expect(changes.phone).toBe("+34 611 111 111");
    expect(changes).not.toHaveProperty("macrosVisible");
  });

  it("unticking or ticking the box sends the new value", async () => {
    const unticked = editForm();
    await unticked.change("macrosVisible", false);
    expect(unticked.changes()).toMatchObject({ macrosVisible: false });

    const ticked = editForm({ ...LOADED, macrosVisible: false });
    await ticked.change("macrosVisible", true);
    expect(ticked.changes()).toMatchObject({ macrosVisible: true });
  });

  it("ticking it and leaving it as it was does not send it", async () => {
    const form = editForm();
    await form.change("macrosVisible", false);
    await form.change("macrosVisible", true);
    expect(form.changes()).not.toHaveProperty("macrosVisible");
  });

  it("without the dirty mark the value never travels, whatever it is", () => {
    expect(clientEditChanges({ ...LOADED, macrosVisible: false }, {})).not.toHaveProperty(
      "macrosVisible",
    );
    expect(clientEditChanges(LOADED, { macrosVisible: true })).toMatchObject({
      macrosVisible: true,
      reviewCadence: { everyDays: 7 },
    });
  });
});
