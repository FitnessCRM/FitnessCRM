# Plan de migración de Firebase a Supabase

Estado: borrador para aprobación. Refleja las decisiones tomadas hasta la fecha. Pendiente de
trasladar a `docs/dominio.md` (§9 y §12) y `docs/estado.md`.

## Decisiones cerradas

| Tema | Decisión |
|---|---|
| Fotos de revisiones | Supabase Storage (acordado con Dani). Sustituye al Drive del entrenador. |
| 2FA | Fuera del MVP; post-MVP. |
| Entrenadores | Se migran. Restablecen contraseña si el hash de Firebase no es importable. |
| Ejercicios | Se migran, con archivados. |
| Alimentos propios | Se migran, con macros y fuente. |
| Plantillas de rutina | Se migran. |
| Plantillas de menú | Se migran, con sus comidas y alimentos, y la copia congelada de cada alimento. |
| Menús de clientes | No se migran. `menus.client_id` queda vacío para los datos migrados. |
| Clientes, revisiones, fotos, pesajes, registros de entreno | No se migran. Quedan en Firebase. |

## Fase 0. Decisiones y documentación

1. Confirmar con Dani el texto de consentimiento y el responsable del tratamiento de las fotos en Storage.
2. Actualizar `docs/dominio.md` (§9 y §12) y `docs/estado.md`: fotos en Storage, no en Drive.
3. Inventario de Firebase: número de documentos en `trainers`, `exercises`, `foods`, `routineTemplates` y `menuTemplates`.

## Fase 1. Proyecto Supabase y entorno

1. Crear proyectos de producción y staging en región de la UE.
2. Levantar Supabase en local (`supabase init`, `supabase start`) para desarrollo y tests.
3. Configurar Auth: email y contraseña, registro público desactivado (solo por invitación), plantillas de correo en español, SMTP propio y URLs de redirección.
4. Custom Access Token Hook que añada `role` y `trainer_id` al JWT.
5. Variables de entorno en `.env.example`, Vercel y staging. La service role key solo en servidor.

## Fase 2. Esquema y migraciones

1. Migración inicial en `supabase/migrations/`: enums, claves compuestas `(trainer_id, id)`, índices y triggers de `updated_at`.
2. Cada invariante de `docs/dominio.md` §6 pasa a CHECK, UNIQUE parcial o FK. Lo que no se exprese en SQL pasa a una función RPC.
3. Plantillas como `body jsonb`: se clonan al asignarse y no se consultan por contenido.
4. `supabase/seed.sql` con datos de demo, sustituyendo `lib/data/adapters/firebase/seed/*.ts` y `scripts/seed-demo-trainer.ts`.

## Fase 3. Seguridad (RLS)

1. RLS activo en todas las tablas.
2. Funciones auxiliares: `current_role()`, `current_trainer_id()`, `is_client_of(trainer)`.
3. Políticas por rol: entrenador (su cartera), cliente (su ficha y sus registros; `macros_visible` solo desde su perfil), admin (solo `trainers` e invitaciones).
4. Sustituir las reglas de `firestore.rules` y probar cada política con pgTAP.

## Fase 4. Storage de fotos

1. Bucket `review-photos` privado, con límite de tamaño y MIME permitidos (`jpeg`, `png`, `webp`).
2. Políticas de `storage.objects`: la primera carpeta debe coincidir con el `trainer_id` del JWT.
3. Ruta: `{trainer_id}/{client_id}/{review_id}/{uuid}.jpg`.
4. Compresión en cliente antes de subir.
5. Borrado: una función SQL devuelve las rutas y una Edge Function borra los objetos. Un job periódico limpia huérfanos.
6. Lectura con URLs firmadas. Si la foto no existe, la app muestra "foto no disponible", como pide §9.

## Fase 5. Funciones RPC

Para operaciones multi-fila, porque Supabase no tiene transacciones desde el cliente:
- Publicar plan.
- Asignar plantilla (clonar, no referenciar).
- Renovar membresía.
- Enviar revisión (completitud, I5).
- Cambiar `macros_visible`.
- Archivar catálogos.

## Fase 6. Capa de datos

1. Instalar `@supabase/supabase-js` y `@supabase/ssr`.
2. Crear `lib/data/adapters/supabase/` con los 18 puertos. `lib/data/ports/` no cambia.
3. `NEXT_PUBLIC_DATA_BACKEND=supabase` y `createSupabasePorts` en la selección de backend.
4. Auth: `session.ts` con `onAuthStateChange`; invitaciones y recuperación de contraseña.
5. Fotos: adaptador de subida con reintentos y lectura con URLs firmadas.
6. ESLint: la regla que restringe el SDK pasa a apuntar a `@supabase/*`.

## Fase 7. Tests

1. Reescribir los tests de adaptador de Firebase contra Supabase local.
2. pgTAP para RLS y constraints.
3. Tests de Storage: subida permitida solo a la carpeta propia.
4. Smoke e2e: alta de cliente, rutina, revisión con fotos.
5. CI: `supabase db reset`, pgTAP y tests de adaptador.

## Fase 8. Migración de datos

Alcance: `trainers`, `exercises`, `foods`, `routineTemplates`, `menuTemplates`.

1. Backup completo de Firestore y del Auth de Firebase, fuera del proyecto.
2. Exportar solo esas colecciones, en modo solo lectura.
3. Transformar: preservar los `id` si son UUID válidos; si no, tabla de equivalencias. Las plantillas de menú llevan sus comidas y alimentos con la copia congelada tal cual.
4. Cargar en orden: `profiles` y `trainers` → `exercises` → `foods` → plantillas. Cada entidad en su transacción; el script es repetible sin duplicar.
5. Verificar:
   - Conteos por tabla, origen y destino.
   - Ejercicios archivados y con vídeo válido (http/https).
   - Alimentos con `trainer_id`, macros y fuente, sin duplicar por `id`.
   - Plantillas de menú con sus copias congeladas intactas.
   - Muestra de 20 registros por entidad comparada campo a campo.
6. Ensayo en staging con una copia real.
7. Corte en producción, con Firebase intacto hasta confirmar la migración.
8. Cuentas: los entrenadores restablecen contraseña si el hash no se puede importar.

## Fase 9. Limpieza y despliegue

1. Quitar `firebase`, `firebase.json`, `firebase.open.json`, `firestore.rules`, `firestore.indexes.json` y los scripts de emulador.
2. Actualizar `CLAUDE.md`, `README.md`, `docs/estado.md` y `docs/dominio.md`.
3. Backups diarios y PITR en producción.
4. Despliegue en Vercel con las variables de Supabase; migraciones aplicadas desde CI.
5. Borrar los datos de clientes en Firebase es irreversible: no se hace hasta que Dani lo valide y se decida por separado.

## Tiempo

| Bloque | Estimación |
|---|---|
| Fases 0–5 (base de datos) | ~2 semanas |
| Fase 6 (capa de datos) | ~2 semanas |
| Fase 7 (tests) | ~1 semana |
| Fase 8 (migración) | 1–2 semanas |
| Fase 9 (limpieza y despliegue) | ~3 días |
| **Total** | **5–6 semanas** |

## Pendiente

1. Actualizar `dominio.md` y `estado.md` con las fotos en Storage (Fase 0).
2. Inventario de Firebase, para dimensionar la Fase 8.
