/**
 * Siembra del entrenador de demo (tarjeta 104): la cuenta h.damaso@gmail.com con su biblioteca y
 * dos clientes con historial —Lucas Navarro e Irene Soto—, para ver la app con datos de muestra.
 *
 * USO
 *
 *   Dry-run contra el proyecto real (solo lee; es lo que hace si no se dice otra cosa):
 *     pnpm seed:demo --project fitnesscrm-fb1ef --key "D:\Dani\secrets\<clave>.json"
 *
 *   Escribir de verdad (lo ejecuta una persona en su terminal, no un agente: imprime contraseñas):
 *     pnpm seed:demo --project fitnesscrm-fb1ef --key "D:\Dani\secrets\<clave>.json" --apply
 *
 *   Contra los emuladores, que tienen que estar arrancados (necesitan Java 21):
 *     pnpm dlx firebase-tools emulators:start --only firestore,auth --project demo-hector
 *     FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
 *       pnpm seed:demo --project demo-hector --trainer-name "Nombre de prueba" --apply
 *
 * ARGUMENTOS
 *
 *   --project <id>        Obligatorio. `fitnesscrm-fb1ef` o, con los emuladores, un `demo-…`.
 *   --key <ruta>          Clave de cuenta de servicio, fuera del repo. También vale
 *                         GOOGLE_APPLICATION_CREDENTIALS. Con los emuladores no se pasa.
 *   --apply               Escribe. Sin él solo se informa de lo que se crearía.
 *   --trainer-name <txt>  Nombre del entrenador. Obligatorio solo si falta su `trainers/{id}`.
 *   --time-zone <IANA>    Zona del entrenador si falta su `trainers/{id}` (por defecto Europe/Madrid).
 *                         Si ya existe, manda la que tiene.
 *
 * QUÉ GARANTIZA
 *
 *   - Se niega a ejecutarse si el proyecto, o el `project_id` de la clave, no es `fitnesscrm-fb1ef`;
 *     si la clave está dentro del repo; o si solo está definida una de las dos variables de emulador.
 *   - Solo crea, con `create()`: lo que ya existe se cuenta y se salta, nunca se sobrescribe. Una
 *     cuenta de Auth que ya existe se reutiliza sin tocar su contraseña ni su verificación.
 *   - Repetirla no duplica: los ids son deterministas (`seed-…`) y las fechas salen del día de la
 *     primera siembra, que se deduce de los clientes ya escritos. Si falla a medias, se vuelve a
 *     ejecutar y completa lo que falte. Los datos son una foto de aquel día: no se refrescan.
 *   - `--apply` aborta sin escribir nada si el entrenador ya tiene documentos propios que no son de
 *     la siembra, si un id de la siembra es de otro entrenador o si falta `--trainer-name`.
 *   - Todo se valida con los esquemas de `lib/domain` antes de escribirse (el SDK de administración
 *     salta las reglas de seguridad) y se relee y se vuelve a validar al final.
 *   - Las contraseñas temporales de las cuentas que crea se imprimen una sola vez, al final de
 *     `--apply`, también si falla a medias. No van a ningún archivo. Cópialas antes de cerrar la
 *     terminal: una cuenta ya creada no se puede volver a crear, solo recuperar su contraseña.
 *
 * Cuando ya no haga falta, borra la clave de cuenta de servicio en la consola de Google Cloud.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Import dinámico, como el de `app/providers.tsx`: la lógica vive con el adaptador de Firebase, que
// es el único sitio donde entra su SDK (CLAUDE.md, regla 1), y este archivo solo es la entrada.
void import("@/lib/data/adapters/firebase/seed/cli")
  .then(({ runCli }) => runCli({ argv: process.argv.slice(2), env: process.env, repoRoot }))
  .then((code) => process.exit(code));
