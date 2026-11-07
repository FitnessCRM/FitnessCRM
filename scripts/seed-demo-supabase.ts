/**
 * Siembra de demo en Supabase (tarjeta 135): una cuenta de entrenador con su biblioteca y dos clientes
 * con historial —Lucas Navarro e Irene Soto—, para enseñar la app. Los mismos datos que la siembra de
 * Firebase (`pnpm seed:demo`), con los correos por argumento.
 *
 * USO
 *
 *   Contra la instancia local (`supabase start`). La URL y la clave las da `supabase status -o env`:
 *     SUPABASE_SERVICE_ROLE_KEY=… pnpm seed:demo:supabase --trainer-email <correo> \
 *       --trainer-name "<nombre>" --client-email <correo de Lucas> \
 *       --client-email <correo de Irene> [--apply]
 *
 *   Contra el proyecto remoto (solo `vrddwsnybtketbbmiuvy`). El `--apply` lo ejecuta una persona en su
 *   terminal, no un agente: imprime contraseñas.
 *     SUPABASE_URL=https://vrddwsnybtketbbmiuvy.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
 *       pnpm seed:demo:supabase --remote --trainer-email <correo> --trainer-name "<nombre>" \
 *       --client-email <correo de Lucas> --client-email <correo de Irene> [--apply]
 *
 * ARGUMENTOS
 *
 *   --trainer-email <correo>  Obligatorio. Su cuenta y todos los ids salen de él.
 *   --trainer-name <txt>      Nombre del entrenador. Obligatorio solo si falta su fila de `trainers`.
 *   --time-zone <IANA>        Zona del entrenador si falta su fila (por defecto Europe/Madrid). Si ya
 *                             existe, manda la que tiene.
 *   --client-email <correo>   Obligatorio una vez por cliente sembrado, dos en total y en este orden:
 *                             el primero es Lucas, el segundo Irene. Cada uno es un cliente `activo`
 *                             con cuenta, porque un `activo` siempre la tiene (docs/dominio.md §7). Si
 *                             faltan o sobran, aborta antes de leer nada.
 *   --remote                  Contra el proyecto remoto. Sin él, solo la instancia local.
 *   --apply                   Escribe. Sin él solo se informa de lo que se crearía.
 *
 * VARIABLES (del entorno; nunca de un archivo del repo)
 *
 *   SUPABASE_URL               Local: por defecto http://127.0.0.1:54321. Con --remote, obligatoria.
 *   SUPABASE_SERVICE_ROLE_KEY  Obligatoria, también en dry-run. No se imprime.
 *
 * QUÉ GARANTIZA
 *
 *   - Se niega a ejecutarse contra una URL que no sea la local sin --remote, y con --remote contra
 *     cualquier proyecto que no sea `vrddwsnybtketbbmiuvy` o con una clave de otro proyecto.
 *   - Solo crea: lo que ya existe se cuenta y se salta, nunca se sobrescribe. Una cuenta de Auth que ya
 *     creó la siembra se reutiliza sin tocar su contraseña.
 *   - Repetirla no duplica: los ids son uuid deterministas que salen del correo del entrenador, y las
 *     fechas, del día de la primera siembra (se deduce de los clientes ya escritos). Si falla a medias,
 *     se vuelve a ejecutar y completa lo que falte.
 *   - `--apply` no escribe nada si un correo ya es de una cuenta o de un cliente que no creó la
 *     siembra, si el correo tiene una invitación de entrenador, si el entrenador tiene datos propios
 *     que no son de la siembra o si un id de la siembra es de otro entrenador. Así no toca a ningún
 *     entrenador real.
 *   - Todo se valida con los esquemas de `lib/domain` antes de escribirse (la clave de servicio salta
 *     RLS) y al final se relee con los conversores del adaptador, como lo lee la app.
 *   - Las cuentas se crean con el correo confirmado y sin enviar ningún correo.
 *   - Las contraseñas temporales de las cuentas que crea se imprimen una sola vez, al final de
 *     `--apply`, también si falla a medias. No van a ningún archivo.
 */

// Import dinámico, como en `seed-demo-trainer.ts`: la lógica vive con el adaptador de Supabase (CLAUDE.md,
// regla 1), y este archivo solo es la entrada.
void import("@/lib/data/adapters/supabase/seed/cli")
  .then(({ runCli }) => runCli({ argv: process.argv.slice(2), env: process.env }))
  .then((code) => process.exit(code));
