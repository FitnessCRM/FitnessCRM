# Revisión exhaustiva de errores — 30-09-2026

Tarjeta 30. Informe de búsqueda: documenta, no arregla. Ningún archivo del repo se ha modificado
salvo este. Las sondas y mutaciones que se usaron para verificar se ejecutaron en local y se
retiraron antes del commit (`git status` limpio tras cada una).

## Foto revisada y resultado de los comandos

- **Commit revisado:** `88fba36daf7da536fa141b5d0d0f2c061f936d43` (`main` tras el PR #26).
- **Entorno:** Windows 11, Node 24.18 (el repo pide 22; `engines` admite ≥ 22), pnpm.

| Comando | Resultado |
|---|---|
| `pnpm lint` | Verde: 0 errores, 1 aviso (`total` sin usar en `lib/data/adapters/mock/people.ts:61`, ya anotado en la tarjeta 6). |
| `pnpm typecheck` | **Primera ejecución en rojo**: 55 errores TS2307, todos en `.next/types/`, generados por un build del 29-09 con las rutas antiguas en español (`app/(cliente)/…`, `app/(entrenador)/…`). Tras `pnpm build`, que regenera `.next/types`, **verde con 0 errores**. No es un error del código: `tsconfig.json` incluye `.next/types/**/*.ts`, así que quien tenga un `.next` anterior a los PR #15/#16 verá el typecheck en rojo hasta reconstruir. |
| `pnpm test` | Verde: 14 archivos, **145 tests**, todos pasan. |
| `pnpm build` | Verde: Next 15.5.25, 24 páginas generadas, mismo aviso de lint. |

Cómo se comprobó lo que depende del navegador: todo en producción (`pnpm build` + entrada `prod`
de `.claude/launch.json`, puerto 3100); `pnpm dev` no llegó a arrancarse. Los anchos se midieron
en un iframe del ancho exacto, y el instrumento se validó antes contra dos fallos conocidos de la
tarjeta 49: `/memberships` a 390 px mide 607 px (lo detecta) y los enlaces «Editar» del detalle
miden 15 px de alto (los detecta).

## Resumen

26 hallazgos: **7 de invariante, 11 de corrección, 3 de arquitectura y 5 de interfaz**. Los tres
más graves son E01, E04 y E05.

| ID | Título | Categoría | Estado | Terreno común |
|---|---|---|---|---|
| E01 | Un entrenador puede archivar la rutina activa del cliente de otro | Invariante (I1) | Verificado | Adaptador |
| E02 | Las escrituras no comprueban que el cliente referenciado sea del entrenador | Invariante (I1, I2) | Verificado | Adaptador, puertos |
| E03 | I3 no se comprueba en ninguna escritura de rutina ni de plantilla | Invariante (I3) | Verificado | Dominio, adaptador |
| E04 | Desde Peso, el cliente cambia el peso de una revisión ya vista o revisada | Invariante (I17, I5) | Verificado | Dominio |
| E05 | Cambiar la unidad de un tipo de medida reescribe el histórico | Invariante (I12) | Verificado | Dominio, adaptador |
| E06 | El feedback acepta un vídeo que no es un enlace http(s) | Invariante (I20) | Verificado | Dominio, adaptador |
| E07 | Fallos de cinco invariantes que los tests no cazan | Invariante (I5, I12, I17, I22, I23) | Verificado | Dominio, adaptador |
| E08 | Peso admite fechas futuras | Corrección | Verificado | No |
| E09 | Revisión enseña como peso uno distinto del que guarda la revisión | Corrección | Verificado | No |
| E10 | Las fechas de envío y de feedback se sacan en UTC | Corrección | Verificado | No |
| E11 | El «hoy» del formulario de Peso: fecha del build y zona del navegador | Corrección | Sospechado | No |
| E12 | El adaptador fija «hoy» al arrancar y en una zona constante | Corrección | Sospechado | Adaptador |
| E13 | El panel cuenta como inactivos a los clientes con invitación pendiente | Corrección | Verificado | Adaptador, puertos |
| E14 | Un alta con fecha futura se pinta como «Semana 1» | Corrección | Verificado | No |
| E15 | El panel de control no tiene estado de error ni de carga | Corrección | Verificado (lectura) | No |
| E16 | El aviso de archivado de ejercicio cuenta rutinas archivadas y no maneja su error | Corrección | Verificado | Adaptador |
| E17 | Revisiones y asignación no invalidan el seguimiento de clientes | Corrección | Verificado (lectura), latente | Hooks |
| E18 | Membresías puede quedarse en una página vacía tras editar | Corrección | Sospechado | No |
| E19 | Login: literal suelto, error decidido por el texto del adaptador, sin RHF + zod | Arquitectura | Verificado | No |
| E20 | Literales sueltos que no estaban anotados | Arquitectura | Verificado | `es.ts`, `components/ui/` |
| E21 | Alta valida con un esquema propio que duplica los del dominio | Arquitectura | Verificado | No |
| E22 | Login no sigue la captura 01: ocho clases de color que no existen | Interfaz | Verificado | No |
| E23 | Vocabulario prohibido no anotado: «bloques» y «periodos» | Interfaz | Verificado | `es.ts` |
| E24 | Etiquetas con género en el panel: «Activos», «Inactivos» | Interfaz | Verificado | `es.ts` |
| E25 | Detalle de un cliente dado de baja con acciones y vacíos sin enlace a Asignación | Interfaz | Verificado | No |
| E26 | Botón de cierre de los diálogos: 15 × 15 px y nombre en inglés | Interfaz | Verificado | `components/ui/` |

«Adaptador» no está en la lista literal de terreno común de `CLAUDE.md`, pero el adaptador en
memoria es la referencia que copiará el de Firebase (lo dice la propia tarjeta 30): lo señalo para
que lo aprueben los dos.

---

## Hallazgos en detalle

### Invariantes

#### E01 · Un entrenador puede archivar la rutina activa del cliente de otro

- **Categoría:** invariante (I1).
- **Dónde:** `lib/data/adapters/mock/plans.ts:20-34` (`createRoutine`) y `:40-56`
  (`activateRoutine`, bucle de la línea 47).
- **Qué incumple:** I1, «Todo registro pertenece a un único entrenador y solo él lo lee o
  escribe». `createRoutine(trainerId, clientId, …)` no comprueba que `clientId` sea de
  `trainerId`, y `activateRoutine` archiva **cualquier** rutina activa con ese `clientId` sin
  filtrar por `trainerId`.
- **Cómo reproducirlo:**
  1. Con el adaptador de demo, `routines.createRoutine("t-otro", "c-marta", <cuerpo válido>)`.
  2. `routines.activateRoutine("t-otro", <id devuelto>)`.
  3. `routines.getActiveRoutine("t-adrian", "c-marta")` devuelve `null` y
     `listRoutines("t-adrian", "c-marta")` enseña `rt-marta-hipertrofia` como `archivado`.
- **Estado:** verificado con una sonda de Vitest local (retirada): antes `rt-marta-hipertrofia
  activo`, después `archivado`. Hoy no se llega desde la interfaz (el editor es esqueleto), pero
  es exactamente el patrón que el adaptador de Firebase heredaría.
- **Terreno común:** adaptador (referencia del de Firebase).
- **Qué decidir:** si toda escritura que recibe un `clientId` valida su pertenencia en el puerto
  (y cómo se expresa eso en las reglas de Firestore de la tarjeta 34).

#### E02 · Las escrituras no comprueban que el cliente referenciado sea del entrenador

- **Categoría:** invariante (I1, I2).
- **Dónde:** `lib/data/adapters/mock/people.ts:182-190` (`createMembership`),
  `lib/data/adapters/mock/logs.ts:14-27` (`saveWeightLog`) y `:47-62` (`saveWorkoutLog`),
  `lib/data/adapters/mock/plans.ts:68-95` (`setMacroTargets`) y `:106-120` (`createMenu`).
- **Qué incumple:** I1 e I2, «Un cliente pertenece a exactamente un entrenador». Estos métodos
  aceptan un `trainerId` y un `clientId` que no casan (o un `clientId` que no existe) y guardan
  el registro. Después, el otro entrenador lo lee con sus propias consultas.
- **Cómo reproducirlo:**
  1. `memberships.createMembership({ trainerId: "t-otro", clientId: "c-marta", … })`: se crea.
  2. `memberships.listClientMemberships("t-otro", "c-marta")` devuelve 1 fila.
  3. `weightLogs.saveWeightLog({ trainerId: "t-otro", clientId: "c-marta", … })` y
     `listWeightLogs("t-otro", "c-marta")`: 1 pesaje.
  4. `createMembership({ trainerId: "t-adrian", clientId: "c-no-existe", … })`: también se crea.
- **Estado:** verificado con sonda local para membresías y pesajes; los otros tres métodos, por
  lectura (no llaman a `findOwn` sobre el cliente). Desde la interfaz no se llega: los hooks
  ponen el `trainerId` de la sesión y el `clientId` sale de pantallas del mismo entrenador. El
  test de tenancy (`mock.test.ts:187-206`) solo cubre lecturas y un archivado.
- **Terreno común:** adaptador; si la comprobación se sube al contrato, puertos.
- **Qué decidir:** lo mismo que E01; conviene resolverlos juntos y con un test de escritura
  cruzada por método.

#### E03 · I3 no se comprueba en ninguna escritura de rutina ni de plantilla

- **Categoría:** invariante (I3).
- **Dónde:** `lib/data/adapters/mock/plans.ts:20-39` (`createRoutine`, `updateRoutine`),
  `lib/data/adapters/mock/templates.ts:25-37` (`saveRoutineTemplate`). No hay función de dominio
  para I3.
- **Qué incumple:** I3, «Una rutina solo usa ejercicios de la biblioteca de su mismo
  entrenador», que `docs/dominio.md` §6 da por garantizada con «Validación de dominio +
  backend». Solo se comprueba sobre los datos de demo (`mock.test.ts:50`), no al escribir.
- **Cómo reproducirlo:** `routines.createRoutine("t-adrian", "c-marta", …)` con un ejercicio
  cuyo `exerciseId` es `"ex-que-no-existe"`: se guarda y se puede activar.
- **Estado:** verificado con sonda local. Hoy no hay pantalla que escriba rutinas (editor,
  plantillas y asignación son esqueleto); la pantalla que llegue lo heredará.
- **Terreno común:** dominio y adaptador.
- **Qué decidir:** dónde vive la comprobación (función de dominio que reciba la biblioteca, o
  solo en el puerto) antes de que entren Editor, Plantillas y Asignación.

#### E04 · Desde Peso, el cliente cambia el peso de una revisión ya vista o revisada

- **Categoría:** invariante (I17; y I5 por un segundo camino).
- **Dónde:** `components/client/weight/weight-form.tsx:78-88` (fecha libre hasta hoy),
  `lib/data/adapters/mock/logs.ts:14-27` (`saveWeightLog`, upsert de I23),
  `lib/data/adapters/mock/logs.ts:28-35` (`deleteWeightLog`).
- **Qué incumple:** I17, «El cliente puede editar su revisión hasta que el entrenador la marca
  como `vista`». La revisión no copia el peso, lo referencia (I9), y el upsert de I23 conserva el
  `id`: el cliente cambia el valor de un pesaje ya usado por una revisión cerrada y la revisión
  cambia con él. Por el puerto hay un segundo camino: `deleteWeightLog` pone `weightLogId: null`
  en la revisión, que pasa de «Completa» a «Parcial», contra I5 («Es una foto del momento del
  envío: … ni se reabre ni pasa a incompleta»).
- **Cómo reproducirlo (interfaz):**
  1. `/weight` como Marta. En el historial, la fila «23 sep · Día de revisión · 63,9 kg» es el
     peso de la revisión de la semana 4, que está `revisada`.
  2. Registrar 80 kg con fecha 23-09-2026 y guardar.
  3. Ir por la barra a Progreso → «Revisión · Semana 4»: la cabecera dice «Peso 80,0 kg» y
     «vs. semana 3 +15,7 kg».
- **Estado:** verificado en producción siguiendo esos pasos. El camino del borrado, verificado
  con sonda local (`rv-marta-s4`: completa → `weightLogId null`, incompleta); no hay botón de
  borrar pesaje en la interfaz.
- **Terreno común:** dominio (I17 frente a I9/I23).
- **Qué decidir:** si un pesaje referenciado por una revisión `vista` o `revisada` queda
  bloqueado, o si la revisión congela el valor al marcarse vista. Ver «Huecos del dominio», H1.

#### E05 · Cambiar la unidad de un tipo de medida reescribe el histórico

- **Categoría:** invariante (I12).
- **Dónde:** `lib/domain/progress.ts:52-54` (`measurementSeries` toma etiqueta y unidad del
  catálogo si el tipo existe) y `lib/data/adapters/mock/reviews.ts:111-121`
  (`updateReviewDraft` vuelve a congelar todas las medidas con el catálogo actual).
- **Qué incumple:** I12, «Toda respuesta y toda medida conservan … unidad vigentes en su
  creación. Editar el catálogo no altera el histórico», y `CLAUDE.md`, «Unidades»: «el valor se
  guarda en ella, sin conversiones silenciosas».
  1. Gráficas de Progreso (cliente) y Detalle (entrenador): al cambiar «cm» por «mm» en Medidas,
     toda la serie histórica pasa a leerse en mm con los mismos números.
  2. Si el cliente vuelve a guardar una revisión aún editable (`enviada`), cada medida se
     recongela con la unidad nueva y el valor viejo: 32 cm pasa a guardarse como 32 mm.
- **Cómo reproducirlo:**
  1. `/measurements`: cambiar la unidad de «Cuello» de «cm» a «mm» y guardar.
  2. `/progress` por la barra del cliente (misma sesión de navegador): la serie de cuello sale
     en mm con los valores de siempre.
  3. `/review`: «Guardar cambios» sobre la revisión S5 (`enviada`). La copia congelada queda
     «32 mm».
- **Estado:** verificado con sonda local sobre dominio y adaptador (`mt-cuello`: unidad
  congelada `cm`, serie `mm`, valores `[32, 32, 32, 32, 32]`; `rv-marta-s5`: `32 cm → 32 mm`).
  Los pasos 1–2 no se repitieron en el navegador.
- **Terreno común:** dominio y adaptador.
- **Qué decidir:** si la unidad de un tipo con medidas registradas se bloquea como el formato de
  I15, o si la serie usa la unidad congelada. Ver H4 y H8.

#### E06 · El feedback acepta un vídeo que no es un enlace http(s)

- **Categoría:** invariante (I20).
- **Dónde:** `lib/domain/review.ts:224-233` (`sendReviewFeedback`) y
  `lib/data/adapters/mock/reviews.ts:146-151`.
- **Qué incumple:** I20, «El vídeo … es siempre un enlace externo», garantizado por «Validación
  de URL». El esquema lo exige (`externalUrlSchema` en `reviewSchema`), pero el camino de
  escritura del feedback no pasa por él.
- **Cómo reproducirlo:** marcar vista `rv-marta-s5` y llamar a `sendReviewFeedback` con
  `videoUrl: "ftp://host/video.mp4"`: se guarda.
- **Estado:** verificado con sonda local. Sin interfaz todavía (tarjeta 15); la pantalla que
  llegue lo heredará.
- **Terreno común:** dominio y adaptador.
- **Qué decidir:** nada de dominio; que el puerto valide con el esquema al escribir.

#### E07 · Fallos de cinco invariantes que los tests no cazan

- **Categoría:** invariante (I5, I12, I17, I22, I23).
- **Dónde:** `lib/domain/review.test.ts`, `lib/data/adapters/mock/mock.test.ts`.
- **Qué incumple:** `CLAUDE.md`, «Tests»: «I5, I9, I12, I15, I17, I22 e I23 tienen test».
  Existen, pero no todos cazan el fallo que protegen.
- **Cómo se comprobó:** 16 mutaciones aplicadas de una en una, `pnpm test` y
  `git checkout -- <archivo>` tras cada una. Cazadas: 10. Sobreviven 6:

  | Mutación | Invariante | Resultado |
  |---|---|---|
  | `isReviewComplete` da por buenas las fotos con una sola subida | I5 | Sobrevive: ningún test tiene una revisión con 1 o 2 fotos |
  | `updateMeasurementType` reescribe etiqueta y unidad de las medidas ya registradas | I12 | Sobrevive: I12 solo se prueba en funciones puras, no al escribir el catálogo |
  | `updateQuestion` reescribe el enunciado de las respuestas ya dadas | I12 | Sobrevive: ídem |
  | `attachReviewMedia` sin el bloqueo de edición | I17 | Sobrevive: el test de I17 del adaptador solo prueba `updateReviewDraft` (el adaptador sí bloquea hoy; comprobado aparte) |
  | `updateClient` renumera las semanas de las revisiones del cliente | I22 | Sobrevive: el test de `review.test.ts:158-181` compara un objeto que nada puede cambiar |
  | `saveWeightLog` pone un `createdAt` nuevo al actualizar | I23 | Sobrevive: `mock.test.ts:27` fija el reloj, así que el `createdAt` viejo y el nuevo son iguales |

  Cazadas: requisitos con archivadas y completitud contra el catálogo (I5), borde de la ventana
  y comprobación de ventana en el adaptador (I9), formato en dominio y adaptador (I15), edición
  tras `vista` (I17), semana de apertura (I22), id nuevo y nota vacía (I23).
- **Estado:** verificado.
- **Terreno común:** tests del dominio y del adaptador.
- **Qué decidir:** nada de dominio; qué casos se añaden.

### Corrección

#### E08 · Peso admite fechas futuras

- **Categoría:** corrección.
- **Dónde:** `components/client/weight/weight-form.tsx:30` (el esquema solo exige fecha válida)
  y `:83` (`max` en un formulario con `noValidate`).
- **Qué incumple:** la definición de las cifras de `lib/domain/weight.ts` («media 7 días …
  anclada al último pesaje»): un pesaje futuro pasa a ser «Último», arrastra la media y entra en
  la ventana de la revisión en curso (ver E09).
- **Cómo reproducirlo:** `/weight`, escribir 70 y la fecha 05-10-2026 a mano, guardar. El
  historial lo acepta arriba del todo; las cifras pasan a «Último 70,0 · Media 7 días 66,7 ·
  Desde inicio +4,5».
- **Estado:** verificado en producción.
- **Terreno común:** no (si se lleva al dominio, sí).
- **Qué decidir:** si una fecha futura (y anterior al alta) es inválida en el dominio. H3.

#### E09 · Revisión enseña como peso uno distinto del que guarda la revisión

- **Categoría:** corrección.
- **Dónde:** `components/client/review/review-screen.tsx:56` y `:108`.
- **Qué incumple:** la pantalla calcula el peso con `weightForReview` sobre los pesajes de hoy,
  no lee `review.weightLogId`. En una revisión `enviada` que no se vuelve a guardar, y en
  cualquier `vista` o `revisada` (no editables), el cliente ve un peso que no es el que ve el
  entrenador ni el que sale en Ver revisión.
- **Cómo reproducirlo:** tras el paso de E08 (pesaje en 05-10-2026, dentro de la ventana de S5),
  `/review` dice «Tomado de tu registro del 05-10-2026 · 70,0 kg»; Progreso → Semana 5 dice
  «Peso 63,4 kg».
- **Estado:** verificado en producción. Sin fechas futuras también ocurre con un pesaje posterior
  dentro de la misma semana; eso no se reprodujo porque exige esperar un día.
- **Terreno común:** no.
- **Qué decidir:** si el peso de una revisión enviada se fija al enviar o sigue al último pesaje
  de la ventana hasta que se marca vista. H10.

#### E10 · Las fechas de envío y de feedback se sacan en UTC

- **Categoría:** corrección (fechas civiles frente a UTC).
- **Dónde:** `components/client/progress/reviews-list.tsx:17`,
  `components/client/view-review/view-review-screen.tsx:21`,
  `components/trainer/client-detail/reviews-history.tsx:23` y `:28`.
- **Qué incumple:** `CLAUDE.md`, «Fechas»: «timestamps UTC ISO para lo técnico» y «La zona
  horaria es configuración del entrenador». Las cuatro cortan `submittedAt`/`reviewedAt` con
  `.slice(0, 10)`, que es la fecha en UTC, y la comparan con «hoy» en la zona del entrenador.
- **Cómo reproducirlo:** una revisión enviada a las 00:30 de Madrid (`…T22:30:00Z` del día
  anterior) sale con el día anterior y no como «Hoy».
- **Estado:** verificado por lectura y con el cálculo en local: `2026-09-29T22:30:00Z` da
  «2026-09-29» con `slice` y «2026-09-30» con `civilDateInTimeZone(…, "Europe/Madrid")`. Con los
  datos de demo no se ve: todos sus timestamps son las 08:00Z.
- **Terreno común:** no.
- **Qué decidir:** nada; `civilDateInTimeZone` ya existe.

#### E11 · El «hoy» del formulario de Peso: fecha del build y zona del navegador

- **Categoría:** corrección (fechas).
- **Dónde:** `components/client/weight/weight-screen.tsx:65` y
  `components/client/weight/weight-form.tsx:48-51` y `:83`.
- **Qué incumple:** «La zona horaria es configuración del entrenador».
  1. `/weight` se prerenderiza en el build y el HTML lleva `max="2026-09-30"` (comprobado en
     `.next/server/app/weight.html`). React 19 no corrige atributos distintos al hidratar, así
     que al día siguiente el selector de fecha seguiría topado en el día del build.
  2. `todayCivil(trainer.data?.timeZone)` usa la zona del navegador mientras el entrenador no ha
     cargado, y `useForm` solo lee `defaultValues` en el primer render: un cliente en otra zona
     puede ver por defecto una fecha que no es la del entrenador.
- **Cómo reproducirlo:** (1) construir un día y abrir `/weight` al siguiente; (2) navegador en
  una zona con fecha distinta de Madrid.
- **Estado:** sospechado. Verificado solo que el HTML servido trae la fecha del build; la falta de
  corrección al hidratar es comportamiento documentado de React y no se ha reproducido.
- **Terreno común:** no.
- **Qué decidir:** nada de dominio.

#### E12 · El adaptador fija «hoy» al arrancar y en una zona constante

- **Categoría:** corrección (fechas).
- **Dónde:** `lib/data/adapters/mock/store.ts:52-54` y `:60`,
  `lib/data/adapters/mock/reviews.ts:73` y `:81`.
- **Qué incumple:** «La zona horaria es configuración del entrenador, nunca una constante en el
  código». `getCurrentReview` y `openCurrentReview` calculan la semana con `ctx.state.today`, que
  se fija una vez al crear el estado y con `DEMO_TZ`. La pantalla de Revisión calcula el borrador
  con el «hoy» real del entrenador (`review-screen.tsx:202`).
- **Cómo reproducirlo:** dejar la app abierta de un día a otro cuando cambia la semana de Marta:
  la pantalla prepara la semana nueva y el puerto devuelve o abre la anterior.
- **Estado:** sospechado, por lectura. Es del adaptador de demo, pero es la referencia del de
  Firebase.
- **Terreno común:** adaptador.
- **Qué decidir:** nada de dominio; si «hoy» lo calcula el puerto en cada llamada o lo recibe.

#### E13 · El panel cuenta como inactivos a los clientes con invitación pendiente

- **Categoría:** corrección.
- **Dónde:** `lib/data/adapters/mock/people.ts:55-58` y `:65-69`,
  `components/trainer/dashboard/dashboard-content.tsx:53-54`.
- **Qué incumple:** §7, ciclo `invitado → activo → dado_de_baja`: «inactivo» no existe en el
  dominio y la pantalla lo define como «todo lo que no es activo». Un cliente recién dado de alta
  sube la cifra «Clientes inactivos» y aparece en la pestaña «Inactivos» junto a las bajas.
- **Cómo reproducirlo:** `/dashboard` (1 inactivo) → Clientes → «+ Nuevo cliente» → crear →
  Dashboard: «2 Clientes inactivos», y la pestaña lista a Lucía (Baja) y al nuevo (Invitación
  pendiente).
- **Estado:** verificado en producción.
- **Terreno común:** adaptador y puerto (`ClientStatusFilter` define `"inactivo"`).
- **Qué decidir:** qué es «inactivo» (H2).

#### E14 · Un alta con fecha futura se pinta como «Semana 1»

- **Categoría:** corrección.
- **Dónde:** `components/trainer/client-detail/client-detail-screen.tsx:82-87`; el mismo
  recurso en `components/client/progress/progress-screen.tsx:61-66`.
- **Qué incumple:** §8, la semana es `floor((date - startDate) / 7) + 1`; antes del alta no hay
  semana (`week.before_start`). Las dos pantallas capturan el error y ponen 1, mientras Clientes
  pinta «—» para el mismo cliente (`components/trainer/clients/client-row.tsx:25-32`).
- **Cómo reproducirlo:** Alta con fecha de alta 15-10-2026 → el detalle dice «Semana 1»; en
  `/clients` la misma fila dice «—».
- **Estado:** verificado en producción (detalle y Clientes). Progreso, por lectura.
- **Terreno común:** no.
- **Qué decidir:** qué se enseña antes de la fecha de alta; el alta futura la permite la tarjeta 6.

#### E15 · El panel de control no tiene estado de error ni de carga

- **Categoría:** corrección (tres estados).
- **Dónde:** `components/trainer/dashboard/dashboard-content.tsx:39-46`.
- **Qué incumple:** criterio de terminado, «los tres estados implementados». Mientras carga solo
  pinta el título; si falla cualquiera de las cuatro consultas, no hay rama de error: se pintan
  ceros y «Sin revisiones aún.» como si la cartera estuviera vacía.
- **Cómo reproducirlo:** forzar un rechazo en `getReviewStats` o `listClientsWithPagination`.
- **Estado:** verificado por lectura; no se puede provocar sin tocar código (y la latencia se
  quitó en el PR #13).
- **Terreno común:** no.
- **Qué decidir:** nada.

#### E16 · El aviso de archivado de ejercicio cuenta rutinas archivadas y no maneja su error

- **Categoría:** corrección.
- **Dónde:** `lib/data/adapters/mock/exercises.ts:33-43`;
  `components/trainer/library/library-screen.tsx:63` y `:156-172`;
  `components/trainer/library/archive-dialog.tsx:48`.
- **Qué incumple:** el puerto dice «Qué rutinas de cliente prescriben un ejercicio» y el
  diálogo, «Lo tienen prescrito ahora». `getExerciseUsage` también cuenta rutinas `archivado`, así
  que nombra a clientes que ya no lo tienen. Y si la consulta de uso falla, el diálogo no enseña
  nada (ni clientes ni «ningún cliente…») y deja confirmar.
- **Cómo reproducirlo:** activar una rutina nueva de Marta sin «Press banca»; su rutina anterior
  queda archivada; `getExerciseUsage("ex-press-banca")` sigue devolviendo a Marta.
- **Estado:** el conteo, verificado con sonda local; hoy no se llega desde la interfaz porque no
  hay forma de archivar rutinas. El error, por lectura.
- **Terreno común:** adaptador.
- **Qué decidir:** nada.

#### E17 · Revisiones y asignación no invalidan el seguimiento de clientes

- **Categoría:** corrección (invalidaciones).
- **Dónde:** `lib/data/hooks/use-reviews.ts:102` y `lib/data/hooks/use-plans.ts:84-90`.
- **Qué incumple:** el seguimiento (`queryKeys.clientsTracking`, bajo `["clients", …]`) enseña
  «Revisión nueva» y el nombre del plan. `useReviewMutation` solo invalida `["reviews", …]` y
  `useAssignTemplate` solo rutinas o menús: marcar vista una revisión o asignar un plan deja
  `/clients` con datos viejos hasta que la consulta caduca.
- **Cómo reproducirlo:** hoy no hay pantalla que marque vista ni que asigne (Revisión de cliente
  y Asignación son esqueleto).
- **Estado:** verificado por lectura; latente hasta que entren esas pantallas.
- **Terreno común:** hooks de `lib/data/hooks/`.
- **Qué decidir:** nada.

#### E18 · Membresías puede quedarse en una página vacía tras editar

- **Categoría:** corrección (paginación).
- **Dónde:** `components/trainer/memberships/memberships-screen.tsx:72-73`, `:121` y `:152-155`.
- **Qué incumple:** si en «No pagadas» se marca como pagada la única fila de la última página,
  la fila sale del corte, `page` no se reajusta y se pinta «Ninguna membresía coincide» sin
  navegación, aunque haya filas en las páginas anteriores.
- **Cómo reproducirlo:** más de 50 membresías no pagadas; ir a la última página con una sola
  fila; marcarla pagada.
- **Estado:** sospechado, por lectura; la demo tiene 10 membresías.
- **Terreno común:** no.
- **Qué decidir:** nada.

### Arquitectura

#### E19 · Login: literal suelto, error decidido por el texto del adaptador, sin RHF + zod

- **Categoría:** arquitectura.
- **Dónde:** `components/login-form.tsx:24`, `:38` y `:12-51`.
- **Qué incumple:**
  1. «Todo literal visible sale de `lib/i18n/es.ts`»: «Completa todos los campos» está en el
     componente.
  2. Regla 3, «Cambiar de backend debe ser escribir un adaptador nuevo y no tocar ni un
     componente»: el mensaje de error se elige comparando `error.message === "Email no
     encontrado"`, que es el texto que lanza el adaptador en memoria (`people.ts:25`). Con otro
     adaptador, todo error se leerá como «No se ha podido conectar».
  3. Stack, «Formularios: react-hook-form + zod» y «Validación: el formulario valida contra
     [el esquema]»: el login usa `useState` y una comprobación a mano.
  4. «Estructura»: `login-form.tsx` y `login-hero.tsx` viven en la raíz de `components/`.
- **Cómo reproducirlo:** `/login`, pulsar «Continuar» con los campos vacíos.
- **Estado:** verificado (el literal, en producción; lo demás, por lectura). La tarjeta 37 dice
  «Sin deuda»; la 39 solo recoge «dieta» y «bloque».
- **Terreno común:** no.
- **Qué decidir:** cómo nombra el puerto de sesión sus errores (un código, como `DomainError`).

#### E20 · Literales sueltos que no estaban anotados

- **Categoría:** arquitectura.
- **Dónde:**
  - «Semana» en `components/trainer/dashboard/recent-reviews.tsx:52` (la lista de la tarjeta 4
    y de la 52 no la incluye).
  - «kg» en `components/client/progress/reviews-list.tsx:22`,
    `components/client/view-review/summary-bar.tsx:37` y `:45`,
    `components/client/view-review/view-review-screen.tsx:161`,
    `components/client/routine/set-row.tsx:96`,
    `components/trainer/client-detail/reviews-history.tsx:32` y `:88`.
  - «kcal» en `components/trainer/client-detail/plan-cards.tsx:88`.
  - «S» de semana en `components/charts/weight-evolution-card.tsx:41` y
    `components/charts/measurements-card.tsx:40` (la gráfica de Peso sí usa
    `es.screens.weight.chart.weekPrefix`).
  - «Close» (en inglés) como nombre accesible del botón de cierre en
    `components/ui/dialog.tsx:68` (y `:103`).
- **Qué incumple:** «Todo literal visible sale de `lib/i18n/es.ts`; no hay strings sueltos en
  los componentes». Las unidades existen ya en `es.ts` (`es.charts.weight.unit`,
  `es.screensMenu.target.kcal`).
- **Cómo reproducirlo:** buscar esas cadenas en los archivos citados; «Close» se oye con lector
  de pantalla en cualquier diálogo (ver E26).
- **Estado:** verificado.
- **Terreno común:** `lib/i18n/es.ts` y `components/ui/dialog.tsx`.
- **Qué decidir:** nada.

#### E21 · Alta valida con un esquema propio que duplica los del dominio

- **Categoría:** arquitectura.
- **Dónde:** `components/trainer/clients/client-signup-form.tsx:36-62`.
- **Qué incumple:** `CLAUDE.md`, «Validación»: «Un esquema zod por concepto en
  `lib/domain/schemas`, y es la única fuente de verdad. El formulario valida contra él». El alta
  reescribe nombre, apellidos, email y el «fin no anterior al inicio» de `membershipSchema`; el
  adaptador vuelve a validar, así que hoy no se cuela nada, pero las reglas pueden separarse.
  Membresías sí lo hace bien (`membership-row.tsx:133-134` usa `membershipEditSchema`).
- **Cómo reproducirlo:** comparar el esquema del formulario con `clientSchema` y
  `membershipSchema`.
- **Estado:** verificado por lectura.
- **Terreno común:** no (salvo que haga falta un esquema de alta en el dominio).
- **Qué decidir:** si el dominio expone un esquema de alta (cliente + membresía inicial) con los
  mensajes traducibles.

### Interfaz

#### E22 · Login no sigue la captura 01: ocho clases de color que no existen

- **Categoría:** interfaz.
- **Dónde:** `components/login-form.tsx:55`, `:57`, `:84`, `:89`, `:96-97`;
  `components/login-hero.tsx:8` y `:29`.
- **Qué incumple:** la captura `01-login.png` y «Todos los valores van a tokens». Las clases
  `bg-surface-elevated`, `text-text-secondary`, `text-text-tertiary`, `bg-error/14`,
  `text-error`, `text-text-on-accent`, `text-accent-muted` y `hover:text-accent-focus` no son
  tokens de `app/globals.css` y, con la paleta desactivada, no generan CSS. Resultado medido:
  - la tarjeta del formulario no tiene fondo (`rgba(0,0,0,0)`); la captura la pinta elevada;
  - el subtítulo, las etiquetas de las cifras del héroe y «He olvidado mi contraseña» salen en
    el primario `#F2EFE9`; la captura los pinta secundarios y el enlace en acento;
  - el texto de «Continuar» sale en `#F2EFE9` en vez de `#16100D` sobre el acento;
  - el mensaje de error sale sin fondo ni rojo.
  Además, «He olvidado mi contraseña» enlaza a `#` y mide 19 px de alto a 390 y a 768 px
  (`CLAUDE.md`: «Los controles pequeños miden al menos 32 px de alto»).
- **Cómo reproducirlo:** `/login` en producción; enviar vacío para ver el error.
- **Estado:** verificado con `getComputedStyle` en producción y en iframe de 390 y 768 px.
- **Terreno común:** no.
- **Qué decidir:** a dónde lleva «He olvidado mi contraseña» con el acceso solo por Google de la
  tarjeta 35.

#### E23 · Vocabulario prohibido no anotado: «bloques» y «periodos»

- **Categoría:** interfaz.
- **Dónde:** `lib/i18n/es.ts:169` («x de 4 bloques completos», barra de envío de `/review`),
  `:422` («Tu entrenador registra aquí los periodos que contratas», vacío de `/membership`) y
  `:440` («Aquí verás cada periodo que contrates»).
- **Qué incumple:** `CLAUDE.md`, «Vocabulario»: **bloque** y **periodo** están prohibidos. La
  tarjeta 39 solo recoge los del login y la 52 la columna «Bloque».
- **Cómo reproducirlo:** `/review` (el contador sale siempre); `/membership` sin membresías.
- **Estado:** verificado en `es.ts`; el de `/review`, visto en pantalla.
- **Terreno común:** `lib/i18n/es.ts`.
- **Qué decidir:** nada.

#### E24 · Etiquetas con género en el panel: «Activos», «Inactivos»

- **Categoría:** interfaz.
- **Dónde:** `lib/i18n/es.ts:507`, `:510`, `:514` y `:515`, usadas en
  `components/trainer/dashboard/dashboard-stats.tsx` y `clients-table.tsx:43-46`.
- **Qué incumple:** `CLAUDE.md`, «Ninguna etiqueta sobre una persona lleva género … no como
  adjetivo concordado —«Activo», «Invitado»—». Las pestañas «Activos» / «Inactivos» y las cifras
  «Clientes activos» / «Clientes inactivos» califican a personas con adjetivo concordado. La
  tarjeta 52 solo cubre las columnas de la tabla.
- **Cómo reproducirlo:** `/dashboard`.
- **Estado:** verificado en producción.
- **Terreno común:** `lib/i18n/es.ts`.
- **Qué decidir:** depende de E13 (qué es «inactivo»).

#### E25 · Detalle de un cliente dado de baja con acciones y vacíos sin enlace a Asignación

- **Categoría:** interfaz.
- **Dónde:** `components/trainer/client-detail/client-detail-screen.tsx:117-126`,
  `components/trainer/client-detail/plan-cards.tsx:26-28`,
  `components/trainer/client-detail/reviews-history.tsx:54`.
- **Qué incumple:** dos de las ocho decisiones aprobadas en el reconocimiento de la tarjeta 5
  (comentario del 27-09-2026):
  - n.º 8, «Un cliente dado de baja conserva ficha: se enseña igual, en solo lectura y con el
    estado visible, sin botones de acción». La ficha de Lucía Torres (Baja) tiene «Editar plan»
    y dos «Editar», y su histórico vacío dice «La primera aparecerá cuando el cliente empiece su
    revisión semanal».
  - n.º 5, «hacen falta vacíos explicativos con enlace a Asignación en las dos tarjetas de
    arriba y en las dos gráficas». Las tarjetas dicen «Sin rutina asignada» / «Sin macros
    fijadas» y solo enlazan al editor; las gráficas dicen «Sin pesajes todavía.» sin enlace.
  El comentario final de la tarjeta 5 no las recoge como deuda.
- **Cómo reproducirlo:** `/clients/c-lucia` (acciones, vacíos de tarjetas y gráficas); `/clients/c-jorge` para los vacíos de las tarjetas de plan.
- **Estado:** verificado en producción (Lucía y un alta nueva).
- **Terreno común:** no.
- **Qué decidir:** nada; ya estaba decidido.

#### E26 · Botón de cierre de los diálogos: 15 × 15 px y nombre en inglés

- **Categoría:** interfaz.
- **Dónde:** `components/ui/dialog.tsx:62-69`.
- **Qué incumple:** «Los controles pequeños miden al menos 32 px de alto» y los literales en
  `es.ts`. El aspa de `DialogContent` mide 15 × 15 px y su nombre accesible es «Close». Aparece
  en todos los diálogos, también en el de «Falta información» de la Revisión del cliente, que se
  usa en el móvil.
- **Cómo reproducirlo:** Biblioteca → «Press banca» → «Eliminar»; medir el aspa.
- **Estado:** verificado en producción en el diálogo de Biblioteca (mismo componente que el de
  la Revisión, que no se pudo abrir: Marta no tiene revisión en borrador).
- **Terreno común:** `components/ui/`.
- **Qué decidir:** nada.

---

## Huecos del dominio

No son errores: son decisiones que `docs/dominio.md` no toma y que alguna pantalla ya está
tomando sola.

- **H1 · I17 frente a I9 e I23.** La revisión referencia el pesaje y el pesaje se corrige por
  upsert conservando su id. ¿Puede el cliente corregir el pesaje que usa una revisión ya `vista`
  o `revisada`? ¿Y borrarlo? (E04).
- **H2 · «Inactivo».** El panel usa «activos / inactivos» y el dominio tiene `invitado`,
  `activo` y `dado_de_baja`. ¿Dónde va un cliente con invitación pendiente? (E13, E24).
- **H3 · Fechas de un pesaje.** ¿Se admiten fechas futuras? ¿Anteriores a la fecha de alta?
  (E08).
- **H4 · Cambiar la unidad de un tipo de medida con histórico.** ¿Se bloquea como el formato de
  una pregunta (I15), o la serie mezcla unidades? (E05).
- **H5 · Límites de una escala.** El esquema solo exige `max > min` y enteros. Una escala 1–1000
  pinta mil botones en la Revisión del cliente; también se admiten mínimos negativos. ¿Hay tope?
- **H6 · Transiciones del cliente.** `ClientChanges` deja cambiar `status` a cualquier valor
  (`dado_de_baja → invitado`). §7 enumera el ciclo pero no dice cuáles son válidas; la tarjeta 44
  habla de «reactivar», que no está en §7.
- **H7 · Semana de un cliente dado de baja.** Sigue contando (Lucía sale en «S21» y «Semana
  21»). ¿Se congela en la baja?
- **H8 · Qué es «vigente en su creación» al reeditar.** Guardar de nuevo una revisión editable
  vuelve a congelar etiquetas, unidades y enunciados con el catálogo de ese momento, también los
  de respuestas que no cambiaron. ¿Es la creación de la respuesta o su primera escritura? (E05).
- **H9 · «Medidas» a secas.** `CLAUDE.md` lo prohíbe, pero §11.1 pide un ítem «Medidas» en la
  barra lateral, y así se llaman también el bloque de la Revisión y la gráfica de Progreso.
- **H10 · Peso de una revisión enviada.** ¿Se fija al enviar o sigue al último pesaje de la
  ventana mientras la revisión es editable? (E09).

---

## Comprobado sin hallazgos

**Reglas duras y «Lo que no cambia»**
- Ningún SDK de backend: ni `firebase`, ni `@supabase/*`, ni ORM en `package.json` ni en el
  código (solo aparece la palabra «Firebase» en un comentario del adaptador).
- `lib/domain/` solo importa `zod`, `date-fns` y `@date-fns/tz` (y `vitest` en los tests).
- El único archivo que importa un adaptador es `app/providers.tsx`. Ningún componente llama a
  `usePorts`; los que importan de `lib/data/ports` lo hacen con `import type`.
- `components/trainer/` y `components/client/` no se importan entre sí.
- Ningún color a pelo en componentes (hex, `rgb()`, `oklch()`); la paleta de Tailwind está
  desactivada. Solo el login usa clases que no existen (E22).
- «HECTOR» solo en `APP_NAME`; el `<title>` y el manifest salen de ahí.
- Ningún valor de enumeración se pinta sin traducir: todos pasan por `es.status.*`.
- `/kitchen-sink` devuelve 404 en producción.

**Invariantes**
- I1 en lecturas: todos los `list*` y `get*` del adaptador filtran por `trainerId` (`own` o
  `findOwn`); `getCurrentReview` y `openCurrentReview` validan el cliente antes de buscar.
  Todas las claves de TanStack Query llevan el `trainerId`.
- I4: `activateRoutine`, `setMacroTargets` y `activateMenus` archivan lo anterior (con el
  agujero de tenancy de E01).
- I9: la ventana se comprueba al escribir en el puerto; los tests cazan las dos mutaciones.
- I13: preguntas, tipos de medida y ejercicios se archivan; `unarchive` conserva id y orden.
- I15: se defiende en dominio, puerto e interfaz (formato deshabilitado con la razón); los tests
  cazan las mutaciones del dominio y del adaptador.
- I16: `openCurrentReview` es idempotente por cliente y semana.
- I17: el puerto rechaza editar borrador, medidas, respuestas y fotos tras `vista` (comprobado
  aparte para las fotos). El único camino abierto es el de E04.
- I10, I18, I21: sin comparación automática, peso siempre en kg, membresías sin importes.
- I20 para ejercicios: `exerciseSchema` exige `http(s)`.

**Cálculos**
- Semana (§8): `floor(días / 7) + 1` con aritmética de fechas civiles en días UTC (sin saltos de
  horario) y proyección a la zona del entrenador.
- Media 7 días (ventana de 7 días civiles que acaba en el último pesaje, mínimo 2), «desde
  inicio» (último − primero, mínimo 2), kcal 4/4/9 derivadas y nunca almacenadas.
- Agrupación por pares de semanas (1-2, 3-4, 5-6), orden descendente.
- Completitud contra requisitos congelados, con las preguntas de texto vacías como no
  respondidas.
- Fin de membresía por tipo, solapes con extremos incluidos, «caduca pronto» solo para la
  vigente, contadores de chips sobre el cliente elegido y no sobre la página.
- Contadores y paginación del panel y de Clientes: salen de la cartera entera, no de la página;
  cambiar filtro o búsqueda vuelve a la página 1.

**Interfaz**
- Delta de peso sin color en Peso, Progreso, Detalle y Ver revisión.
- Fechas en `DD-MM-YYYY` o forma corta del año en curso, con `dateTime`, en las listas
  revisadas.
- Etiquetas de estado de cliente invariables («En activo», «Invitación pendiente», «Baja»).
- Responsive medido en producción, en iframe de 390 y de 768 px: las siete pantallas del
  cliente, `/clients` y `/clients/new` no desbordan y no tienen controles por debajo de 32 px.
- Menú hamburguesa a 390 px en las dos áreas: disparador de 40 × 40 px, enlaces de 41 px, el
  activo marcado con `aria-current`, y Escape lo cierra (`aria-expanded="false"`).
- Tres estados en las pantallas del cliente, Clientes, Detalle, Alta, Biblioteca, Cuestionario,
  Medidas y Membresías (con las excepciones de E15 y E16).

**Invalidaciones**
- Alta, membresías, ejercicios, catálogos y pesajes invalidan lo que pintan. Crear un cliente
  refresca panel y Clientes (comprobado en el navegador).

---

## No comprobado

- **Estados de carga en pantalla.** La latencia simulada se quitó en el PR #13 y el adaptador
  responde en el mismo ciclo: los estados de carga solo se han revisado leyendo código.
- **Estados de error en pantalla.** Provocarlos exige tocar código; revisados por lectura.
- **Comparación visual con las capturas.** Solo el login (01) se comparó contra su captura. Las
  demás pantallas, por texto y por los comentarios de sus tarjetas. No hay capturas de pantalla
  del navegador: el panel estaba oculto y la captura agota el tiempo.
- **Hidratación del `max` de Peso (E11).** Hace falta un build de un día anterior.
- **Devolución del foco al cerrar el menú hamburguesa.** En un iframe fuera de pantalla la
  animación de salida no corre y el panel no se desmonta; no se pudo medir.
- **Diálogo «Falta información» de la Revisión del cliente.** Marta no tiene revisión en
  borrador; el tamaño del aspa se midió en el de Biblioteca (E26).
- **Membresías con más de 50 filas (E18).**
- **`pnpm dev`.** No se arrancó: todo lo del navegador es de producción.
- **Node 22.** Las comprobaciones corrieron con Node 24.18.

**Visto de pasada y no reportado por estar fuera de alcance:** en `/memberships` a 390 px la
página mide 607 px y el significado de «Caducan pronto» y de «Solapada» solo está en un `title`
(tarjeta 49); la tabla del panel (tarjeta 52); los literales del login (tarjeta 39); un
comentario con caracteres mal codificados en `app/(client)/view-review/page.tsx:9` (estilo);
`lib/data/adapters/mock/latency.ts` ya no se usa (estilo).
