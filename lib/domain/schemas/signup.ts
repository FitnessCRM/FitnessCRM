import { z } from "zod";
import { clientDataSchema } from "./client";
import { membershipEditSchema } from "./membership";

/**
 * Alta de un cliente: sus datos y la membresía con la que empieza. Junta dos conceptos que ya
 * tienen esquema y no repite ninguna de sus reglas: la membresía inicial valida con el mismo
 * esquema que una membresía editada en Membresías, «fin no anterior al inicio» incluido.
 */
export const clientSignupSchema = clientDataSchema.extend({
  membership: membershipEditSchema,
});
export type ClientSignup = z.infer<typeof clientSignupSchema>;
