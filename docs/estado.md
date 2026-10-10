# Estado del proyecto

Última actualización: 09-10-2026. Corresponde a `main` en `de2960c` (PR #95). Están en `main` los
cimientos, las siete pantallas del cliente, el panel del entrenador, la auth y las reglas de
seguridad, el adaptador de Firebase, el modo sin conexión del cliente, la capa de datos de los
alimentos y sus pantallas; el resto, en «Siguiente». Lee `CLAUDE.md` y `docs/dominio.md` antes de
continuar.

## Cómo se trabajó hasta aquí

Las fases 1–2 se hicieron desde Cowork en un VM Linux; las fases 3–5 desde el escritorio en
Windows. Consecuencias:

- Ejecuta `pnpm install` antes de nada (Node 22, pnpm 11+). Git convierte a CRLF al tocar
  archivos; `core.fileMode = false` en `.git/config` y no lo quites en Windows.
- Para más componentes shadcn: `pnpm dlx shadcn@latest add <componente>` y retematizar a mano
  (`bg-primary`, `text-muted-foreground`, `dark:*`, sombras → tokens de `app/globals.css`).
- `.claude/launch.json` arranca `pnpm dev` en el puerto 3000 desde el navegador integrado, y
  `prod` (`pnpm start`, puerto 3100) el build de producción, que es donde se confirma cualquier
  aviso que solo se vea en desarrollo.

## Hecho

### Fase 1 — Esqueleto
- Next.js **15.5** (App Router, React 19.1), TypeScript `strict` + `noUncheckedIndexedAccess`,
  alias `@/*`, Tailwind v4, ESLint (+ `eslint-config-prettier`), Prettier
  (+ `prettier-plugin-tailwindcss`), husky + lint-staged, `.nvmrc` 22.
- Scripts: `dev`, `build`, `start`, `test` (vitest run), `lint`, `typecheck`, `format`.
- Vitest: `lib/**/*.test.ts`, entorno Node, sin jsdom.
- PWA con Serwist 9 (`app/sw.ts`, desactivado en dev), `app/manifest.ts` con `APP_NAME`.
- Prettier ignora `CLAUDE.md` y `docs/**`.

### Fase 2 — Sistema de diseño
- `app/globals.css`: `@theme` con tokens semánticos y **paleta de Tailwind desactivada**
  (`bg-red-500` no compila). Tokens: `background`, `background-deep`, `surface`,
  `surface-raised`, `surface-overlay`, `border`, `border-strong`, `border-subtle`,
  `border-emphasis`, `overlay`, `text-primary`, `text-muted`, `text-subtle`, `text-disabled`,
  `accent`, `accent-hover`, `accent-bright`, `accent-emphasis`, `accent-soft`, `accent-outline`,
  `accent-strong`, `on-accent`, `success`, `success-soft`, `danger`, `danger-soft`, `ring`.
- Tipografía `font-display` (Oswald) / `font-ui` (Inter Tight). Escala `text-xs` 11 … `hero` 76.
  Utilidades `eyebrow`, `section-title`, `page-title`.
- `components/ui/`: 13 componentes shadcn retematizados, más `brand`, `initials-avatar` y
  `page-header` (fase 5). `/kitchen-sink` solo en desarrollo.

### Fase 3 — Dominio (`lib/domain/`)
- `schemas/`: un archivo zod por concepto; los tipos se infieren. Además de los 21 conceptos:
  `Prescription`, `Macros`, `ResponseFormat`, `ReviewWindow`, `ReviewRequirements`,
  `MenuTemplateEntry`, y los enums de estado.
- Funciones: `weekNumber`, `reviewWindowForWeek`, `daysUntilNextReview`, `civilDateInTimeZone`
  (`week.ts`); `isReviewComplete`, `canClientEditReview`, `weightForReview`, `openReview`,
  `recordMeasurement`, `answerQuestion`, `submitReview`, `markReviewViewed`,
  `sendReviewFeedback` (`review.ts`); `canChangeQuestionFormat`, `canUpdateQuestion`
  (`questionnaire.ts`); `derivedKcal` (`macros.ts`, retirada en la tarjeta 58: las kcal las
  escribe el entrenador); `cloneRoutineTemplate`,
  `cloneMenuTemplate` (`templates.ts`); `routinesUsingExercise`, `removeExerciseFromRoutine`
  (`routine.ts`). `DomainError` con `code` para que la UI traduzca.
- Tests de I5, I9, I12, I15, I17 y I22 con casos límite, más esquemas y plantillas. 57 tests.
- ESLint prohíbe en `lib/domain/**` importar React, Next, globales del DOM y capas superiores.

### Fase 4 — Capa de datos (`lib/data/`)
- `ports/`: una interfaz por agregado, agrupadas en `DataPorts` (`ports/index.ts`). Todos los
  métodos reciben `trainerId` explícito.
- `adapters/mock/`: en memoria, filtrado por `trainerId`, copia en cada respuesta. **Sin
  latencia desde el PR #13** (29-09-2026; antes, 150 ms por llamada): las consultas resuelven en
  el mismo instante, así que el estado de carga de una pantalla apenas llega a pintarse y mirar la
  pantalla no demuestra que exista. Para comprobarlo hay que forzarlo, por ejemplo con un retraso
  temporal en el adaptador que no se commitea. El mismo PR carga las gráficas de Peso y Progreso
  con `next/dynamic` sin SSR, con un hueco mientras llegan; el Detalle de cliente hace lo mismo.
  `lib/data/adapters/mock/latency.ts` quedó sin uso y se borró (tarjeta 66, PR #64): para ver un
  estado de carga hay que forzarlo a mano. Las invariantes se aplican con las funciones del dominio (I4, I9, I13, I15, I16,
  I17). `demo-data/` reproduce la demo: Adrián Vega, cinco clientes, 10 ejercicios, 3 plantillas
  de rutina, 2 de menú, rutina y menús de Marta, 10 membresías, 8 tipos de medida, 5 preguntas,
  13 pesajes del último mes, 5 revisiones de Marta y las enviadas de Jorge y Sara. Un test valida
  cada dato contra su esquema. 13 tests.
- `hooks/`: `PortsProvider` (contexto + `QueryClient`), `usePorts`, `queryKeys`, hooks de
  lectura para todos los puertos y mutaciones principales.
- `app/providers.tsx` es la raíz de composición y el único archivo que importa el adaptador.
- `app/kitchen-sink/clients-probe.tsx` lista clientes con carga, error y reintento sin nombrar
  el adaptador.

### Fase 5 — Armazón de navegación
- `components/trainer/trainer-shell.tsx`: barra lateral de 232 px con Dashboard, Clientes,
  Biblioteca, Plantillas, Cuestionario, **Medidas**, Membresías, Asignación; logo con etiqueta
  «Coach» y bloque de usuario leído por `useTrainer()`.
- `components/client/client-shell.tsx`: nav superior con Rutina, Menú, Peso, Revisión,
  Progreso, Membresía; «Ver revisión» marca Progreso; nombre corto y avatar por `useClient()`.
- `app/(auth)/layout.tsx` con la marca arriba y el contenido centrado. `/` redirige a `/login`.
- Todas las rutas renderizan su título con `PageHeader`; el `<title>` usa la plantilla
  `%s · APP_NAME`. Literales de navegación, títulos y estados en `lib/i18n/es.ts`.

## Decisiones tomadas que no estaban en las instrucciones

Fases 1–2:

1. **Next 15, no 16.** `create-next-app@latest` da 16.3; se fijó 15 por la tabla de `CLAUDE.md`.
2. Paleta de Tailwind desactivada para que "ningún color a pelo" lo aplique el compilador.
3. Token `background-deep` (#0C0B0A) para sidebar y nav superior; `#100F0D` (marco) se ignoró.
4. Inputs con borde `border-emphasis` (0.12); la demo usa 0.10.
5. `text-sm` = 13px y `text-base` = 15px (shadcn heredaba 14/16).
6. **Cerrado el 18-09-2026:** la demo tiene dos familias de botón secundario. `outline` sigue en
   Oswald mayúsculas («Editar plan», «Solo actual»); `secondary` (con borde) y `ghost` (sin
   borde) pasan a Inter 13px sin mayúsculas para «Editar», «Cancelar», «Eliminar», «Guardar
   macros». `destructive` queda para acciones irreversibles.

Fase 3 (dominio):

7. **Valores de enumeración en español** (`borrador`, `frente`, `pagada`, `entrenamiento`), tal
   como los escriben `dominio.md` y la especificación. Identificadores en inglés. Cambiarlo es
   mecánico si se prefiere inglés también en los valores.
8. **`Review` guarda `window` y `requirements`**: la ventana permite comprobar I9 sin recalcular
   desde `startDate`; los requisitos congelados son la única forma de cumplir "exigido al
   abrirla" (I5). `isReviewComplete` usa los congelados por defecto y admite otros por parámetro.
9. **`weightForReview` elige el pesaje más reciente de la ventana** (la demo dice "tomado del
   registro de esta mañana"). Empate en el día: gana el creado más tarde.
10. **Fecha anterior al alta lanza `DomainError`** en vez de devolver semana 0.
11. **`sourceTemplateName` congelado** en rutina y menú en lugar de un id a la plantilla: un id
    sería un enlace y §4 manda copiar.
12. **`Routine` y `Menu` llevan `note`** para la "Nota del entrenador" de las pantallas de cliente.
13. **`goal` y `level` del cliente son texto libre.** La pantalla de alta muestra selects pero el
    dominio no cierra la lista.
14. **`MenuTemplate` es un conjunto de menús** por tipo de día ("2 tipos de día · 2 menús por tipo").
15. **Decidido con el propietario (18-09-2026):** cada `Menu` lleva `macros` **declaradas por el
    entrenador**, informativas para el cliente: ni son su objetivo (`MacroTargets`) ni se
    calculan de los alimentos. Y los **ejercicios se borran**: el sistema avisa de qué clientes
    los tienen y, si se confirma, el ejercicio desaparece de sus rutinas
    (`removeExerciseFromRoutine`). **Ambas cosas cambian `dominio.md`** (§3/§5 y §7) y hay que
    sincronizar el documento maestro del proyecto Hector.

Fase 4 (datos):

16. **Sesión de demo con ambos ids.** Sin auth, `SessionPort.getSession()` devuelve
    `{ trainerId: Adrián, clientId: Marta }`. Los hooks toman el `trainerId` de ahí. Cuando haya
    auth, ese puerto es el que cambia.
17. **Todos los métodos de puerto reciben `trainerId` explícito**: hace visible I1 y permite el
    test de tenancy. Con Firestore lo garantizan además las reglas de seguridad (tarjeta 34).
18. **Los métodos del adaptador son `async`** para que un `DomainError` sea siempre un rechazo,
    nunca una excepción síncrona.
19. Los menús de demo declaran las macros de la maqueta. Las kcal se derivaban con 4/4/9: Menú A
    daba 2.348 kcal (la maqueta dice 2.410) y el de descanso 2.145 (2.100). **Desde la tarjeta 58
    (01-10-2026) las kcal las escribe el entrenador y se guardan**; los datos de demo conservan
    esas cifras como valor escrito.
20. **Lucía Torres está `dado_de_baja`**: la maqueta dice "Inactiva · pausado" y no hay estado
    pausado.
21. **Datos de demo relativos a hoy** (19-09-2026, `a0238b8`): antes eran fechas fijas de agosto
    y la gráfica de peso se vaciaba día a día. Ahora `createDemoState(today)` los genera a partir
    de `demoToday()` (zona `Europe/Madrid`): hoy Marta está en S5 (su primer día), Jorge en S8,
    Sara en S3 y David en S11, como muestra el panel. Los tests fijan un `today` y además prueban
    varias fechas.
22. La rutina de Marta sigue el editor (Día 1 Torso, Día 2 Pierna, Día 3 Torso) y no la pantalla
    de cliente, que pone pierna en el Día 1; se añadieron los días 4 y 5.
23. Contadores de plantillas y ejercicios ("Rutinas · 5", "24 ejercicios"): confirmado por el
    propietario que son contadores de lo que haya; los datos de demo tienen 3 rutinas, 2 menús y
    menos ejercicios por día.

Fase 5 (navegación):

24. **`(cliente)/revision` y `(entrenador)/revision` chocan**: los grupos de rutas no añaden
    segmento y ambas resolverían a `/revision`, que Next rechaza. Siguiendo la miga «Clientes /
    Marta Ruiz» de la demo, el editor y la revisión del entrenador viven en
    `/clientes/[clientId]/editor` y `/clientes/[clientId]/revision`; el detalle en
    `/clientes/[clientId]` y el alta en `/clientes/nuevo`. Desde los PR #15 y #16 (29-09-2026)
    rutas y carpetas están en inglés: `app/(client)/`, `app/(trainer)/`, `/clients/[clientId]/…`
    con `editor`, `review` y `edit`, y `/clients/new`. El choque sigue resuelto igual.
25. `/` redirige a `/login` mientras no haya auth. Para navegar: `/dashboard` (entrenador),
    `/routine` (cliente). El login lleva al panel del entrenador mientras se desarrolla.
26. `initialsOf` y `shortNameOf` en `lib/utils.ts` para "MR" y "Marta R.".

## Dudas / contradicciones detectadas

- `docs/design/demo-navegable.html` es una versión estática (18 pantallas apiladas) generada a
  partir de `Demo Navegable.dc.html`, que depende de un `support.js` ausente. La referencia son
  las capturas de `docs/design/screens/`; `CLAUDE.md` ya lo dice (19-09-2026).
- La demo tiene **18** pantallas, no 16: además están «Detalle cliente», «Alta de cliente» y
  «Ver revisión».
- Fuera del MVP según `dominio.md` pero presente en la demo: «Bloque 2 · Semana 5 de 12»,
  columna «Bloque», «Adherencia %», «2FA» en el login. Se omiten al maquetar.
- La pantalla de revisión del cliente dice «La revisión solo se envía completa»; I5 dice que la
  completitud avisa y no bloquea. Manda el dominio.
- La maqueta dice "viernes, 29 agosto" pero el 29-08-2026 es sábado. Con los datos relativos a
  hoy la fecha del panel será la real y el día de la semana se calcula.
- La demo muestra en el Día 1 del cliente ejercicios de pierna y en el editor Día 1 = Torso.
- El "Eliminar" de la biblioteca (archivar) y las macros por menú ya están resueltos (decisión 15).
- Sin cubrir por la demo: la pantalla «Medidas» (§11.1) y el envío de feedback (§11.2). Las dos
  están hechas con diseño propuesto (tarjetas 12 y 11).
- `app/favicon.ico` sigue siendo el de create-next-app (tarjeta 19).

### Pantallas del cliente

- **Peso** (`components/client/weight/`, 18-09-2026): formulario (react-hook-form + zod, coma
  decimal admitida), tres cifras, gráfica de las últimas 6 semanas con `TrendChart` e historial
  descendente con «Día de revisión». Las definiciones viven en `lib/domain/weight.ts` y tienen
  test: **media 7 días** = media de los pesajes de los 7 días civiles que terminan en el último
  pesaje (inclusive), `null` con menos de 2 pesajes en la ventana; **desde inicio** = último
  pesaje − primer pesaje registrado, `null` con menos de 2 pesajes; **día de revisión** = la
  revisión referencia ese pesaje como su peso (I9), no "cae en la ventana" porque la ventana es
  la semana entera y marcaría todos; **gráfica** = último pesaje de cada semana del cliente, hueco
  si no hubo. Fechas en `DD-MM-YYYY` por convención (la demo enseña "29 ago"). El delta solo se
  pinta en verde cuando baja, como en la demo; para un cliente de hipertrofia eso es discutible.

- **Revisión** (`components/client/review/`, 19-09-2026): abre o recupera la revisión de la semana
  actual (`useCurrentReview`, idempotente por I16). Los campos salen de los **requisitos
  congelados** al abrirla, no del catálogo actual; etiqueta y formato se leen primero de la copia
  congelada (I12) y después del catálogo. **I5**: la tira de cuatro bloques y la barra de progreso
  se calculan en vivo con `applyReviewDraft` + `isReviewComplete`; al enviar incompleta, un
  diálogo enumera fotos, peso, medidas y preguntas que faltan y deja «Enviar igualmente». **I9**:
  el peso es `weightForReview` sobre la ventana; si no hay pesaje, enlace a Peso. **I17**: con
  `vista` o `revisada` todo queda deshabilitado y sin acciones; con `enviada` se puede seguir
  editando («Guardar cambios»). El texto de la demo «solo se envía completa» se sustituyó por
  «puedes enviarla incompleta», manda el dominio. **La revisión no se persiste por visitar la
  pantalla** (19-09-2026): el borrador vive en memoria y se abre (persistiendo y congelando
  requisitos) en el primer campo que se escribe o la primera foto; si no, cada visita dejaría una
  fila vacía ocupando el hueco de I16 y saliendo en Progreso como «en curso 0/4». **Fotos:
  pendiente número uno cuando haya backend.** Hoy son `object URL` del navegador, revocadas al
  desmontar, y no sobreviven a una recarga: una revisión puede quedar enviada y completa sin
  imágenes recuperables. El 29-09-2026 se decidió que las fotos vivan en el Drive del entrenador
  (`docs/dominio.md` §9 y §12), pero el 05-10-2026 el propietario reabrió esa decisión (ver
  «Siguiente»). **No está implementado**: es la tarjeta 17, y hasta entonces siguen siendo
  `object URL` en memoria.

- **Progreso** (`components/client/progress/`, 19-09-2026): «Evolución de peso» con todas las
  semanas del cliente (`weeklyWeights`) y el delta sin color; «Medidas», primera gráfica
  multi-serie: `measurementSeries` en `lib/domain/progress.ts` da una serie por tipo de medida
  presente en las revisiones, dispersa y con `null` donde no hubo valor, en orden de catálogo;
  un tipo archivado conserva su histórico y se marca «archivado» en el selector, y no entra en
  revisiones nuevas porque `openReview` solo congela tipos activos. Selector de tipos como en la
  demo; por defecto se muestran los tres primeros del catálogo (la demo enseña cintura, cadera y
  muslo, que son los que más varían: elegirlos automáticamente sería un juicio). Histórico
  agrupado de dos en dos semanas (`groupReviewsByWeekPair`, §8); un borrador enlaza a Revisión con
  «n/4», el resto a `/view-review?review=id` con «Completa ✓» o «Parcial». Las líneas van con
  segmentos rectos: la demo no suaviza y una curva inventa valores entre semanas.

- **Rutina** (`components/client/routine/`, 19-09-2026): pestañas por día numérico, tarjeta por
  ejercicio con su prescripción («4 series · 6-8 reps · RIR 2 · descanso 3 min»; `repsMax` nulo
  pinta reps fijas; RIR, descanso y nota tal como los escribe el entrenador, la nota como último
  segmento) y registro opcional desplegable. Nombres por `getExercise` (`useExercisesById`), así
  que un ejercicio archivado sigue nombrándose. Decisiones del 19-09-2026 con el propietario:
  - **Sin «hoy» en pantalla.** Los días numéricos no tienen ancla de calendario. La tarjeta
    lateral se titula con el día seleccionado («Día 2 · Pierna») y muestra ejercicios y series.
    Fuera la «duración estimada» (no hay datos para calcularla) y el «Bloque 2 · Semana 5 de 12»
    (queda «Semana 5»). «Sesión» no aparece: es término prohibido.
  - **La rejilla es la de hoy y solo la de hoy** (`dayRecordOn`, con test): vacía si hoy no se ha
    registrado nada, y con la fecha civil de hoy en la zona del entrenador, que es cuando se hizo.
    Así escribir no vacía casillas y borrar nunca toca histórico: desde esta pantalla solo se
    edita lo de hoy. Lo de la última vez se enseña de solo lectura: al principio era la vez
    anterior del mismo día de rutina, bajo cada serie («última vez: 80 kg × 6»,
    `latestDayRecord`); desde el 07-10-2026 es **por ejercicio**, en la cabecera y en cada fila
    (tarjeta 84, PR #79, abajo).
  - **Contador** = «X de Y series registradas hoy». Aquí «hoy» es correcto: son registros fechados
    hoy, no una suposición sobre qué día de rutina toca. La tarjeta añade «Última vez: DD-MM-YYYY».
  - **Editar registros de otra fecha**: la rejilla sigue siendo solo la de hoy, y corregir otro
    día tiene pantalla propia, `/routine/past`, con un enlace desde Rutina (tarjeta 18, PR #78,
    abajo). La anotación del 19-09-2026 como deuda queda cerrada.
  - **Día por defecto** = el siguiente al último día con registros, en el orden de la rutina y
    volviendo al primero tras el último; sin registros, el primero (`defaultRoutineDay`, con
    test). **Un cliente que nunca registre verá siempre el Día 1.** Si llega a molestar, la
    salida es de dominio —marcar un día como hecho—, no memoria del navegador.
  - **`deleteWorkoutLog` en el puerto** (cambio de contrato), en el adaptador y con test: vaciar
    peso y reps de una serie guardada la retira. Una serie a medias no se guarda y avisa
    («revisa peso y reps») marcando solo el campo que falla.
  - La nota del entrenador se firma con su nombre de pila y **sin día**: `Routine` no guarda
    cuándo se escribió la nota y `updatedAt` cambia con cualquier edición.
  - Se guarda al salir de la fila o con Enter, no con botón: la demo no tiene botón y «✓
    guardada» aparece por serie.
  - Los datos de demo registran el Día 2 hoy y **la misma sentadilla cuatro días antes**, para que
    se vea la línea de referencia; por eso la pantalla abre en el Día 3 y la captura enseña el
    Día 1 (la pierna del Día 1 ya estaba anotada como contradicción).

- **Barra del cliente en móvil** (`client-shell.tsx`, 20-09-2026): a 390 px todas las pantallas
  del cliente medían 842 px de ancho. El nav ahora se desplaza dentro de su caja (`overflow-x-auto`
  con la barra de scroll oculta y los enlaces sin encoger), el nombre corto se oculta y el
  relleno baja a 16 px. Medido en un iframe de 390 px, no con la emulación del panel, que no
  siempre se aplica: `/routine`, `/weight`, `/progress`, `/menu` y `/membership` miden ya 390.
  **`/review` sigue midiendo 688** por contenido suyo (la tira de completitud), no por el nav:
  es trabajo de la pasada responsive, que es una fase aparte y no se ha abierto.

- **Menú** (`components/client/menu/`, 20-09-2026): selector de tipo de día, un menú por tarjeta
  (el sugerido primero y abierto, los demás plegados) con sus comidas y gramos, objetivo del
  cliente a la derecha y la nota del menú sugerido. Decisiones del 20-09-2026:
  - **La pantalla se llama «Tu menú», no «Menú de hoy».** El tipo de día lo elige el cliente con
    el selector: nada en el dominio dice si hoy entrena o descansa, igual que los días numéricos
    de Rutina no tienen ancla de calendario. Derivarlo exigiría guardar en `Client` qué días
    entrena, que es dominio nuevo y no está en el MVP. Cambia `pages.client.menu`.
  - **Las dos cifras de macros se distinguen por etiqueta, no por contexto.** A la derecha, «Tu
    objetivo del día» con «Es lo que te marca tu entrenador para el día entero». En cada menú, la
    cifra va siempre con el verbo delante, «aporta 2.348 kcal · P 165 · C 260 · G 72», y al abrirlo
    lo dice entero: «Macros que declara tu entrenador para este menú. Ni es tu objetivo ni sale de
    sumar los alimentos: si no cuadran, es su criterio». **La app no las compara, ni las corrige,
    ni impide que difieran**: es criterio del entrenador (§5). Los datos de demo las dejan
    idénticas (165/260/72 en las dos), que es el caso peor para el etiquetado y por eso se
    mantiene así.
  - Las barras del objetivo eran la **parte de las kcal** que aporta cada macro (4/4/9). Desde la
    tarjeta 58 (opción B) cada barra es lo que aporta ese macro con 4/4/9 **sobre la suma de los
    tres**: siempre suma 100 % y no lee las kcal, que escribe el entrenador y pueden no cuadrar
    (`macroEnergyShares`). La maqueta las pinta casi llenas sin decir qué miden.
  - Las kcal se formatean con `formatInteger` (`lib/format.ts`): `es-ES` no agrupa los millares de
    cuatro cifras y la demo escribe «2.400», así que va con `useGrouping: "always"`.
  - El selector usa el `Tabs` de Radix, controlado. Durante un rato llevó botones propios por un
    aviso de hidratación que resultó ser **solo del servidor de desarrollo en frío**: ver el
    diagnóstico en el hito responsive (20-09-2026).
  - `TrainerNoteCard` pasa a `components/client/` y su literal a `es.common.trainerNote`: lo usan
    Rutina y Menú.
  - **Menú B declara macros que no son el objetivo ni cuadran con sus alimentos** (150/230/80 →
    2.240 kcal, frente a 2.348 del objetivo; 20-09-2026). El Menú A sigue clavado al objetivo. Así
    la pantalla enseña los dos casos que el etiquetado tiene que distinguir, y se puede verificar.

- **Nada vive solo en un `title` en el área de cliente** (20-09-2026): en táctil no hay hover. Se
  quitaron los tres que quedaban —porcentaje de las barras del objetivo, fecha del «última vez» de
  Rutina y fechas del historial de Peso y del histórico de Progreso—. Ahora el porcentaje se pinta
  («165 g · 28 %», con una línea que dice qué mide), la referencia lleva la fecha dentro
  («última vez (16 sep): 80 kg × 6») y las fechas de las listas se leen en el texto, en forma corta
  dentro del año en curso y completas fuera de él, con `dateTime` para máquinas. La regla, con la
  distinción entre área de cliente y panel del entrenador, está en `CLAUDE.md`.

- **Membresía** (`components/client/membership/`, 20-09-2026): la membresía en curso con su
  tiempo restante, la próxima renovación si está registrada, y el historial completo. **Solo
  lectura**: el cliente no toca nada de su membresía y el cobro pasa fuera de la app (§10, I21),
  así que se mantiene el texto de la maqueta «Si tienes dudas sobre un pago, escribe a tu
  entrenador». Las renovaciones son filas nuevas, nunca ediciones (§7).
  - `lib/domain/membership.ts`, con test: `membershipStanding` da la actual (la que contiene la
    fecha; si dos se solapan, la que empezó más tarde), la siguiente (la primera que empieza
    después), los días que quedan y la parte transcurrida. Primer y último día cuentan como
    dentro: el último día quedan 0 días y la barra está llena. `membershipHistory` ordena de la
    más reciente a la más antigua.
  - **Fechas en `DD-MM-YYYY`**, también en la tabla. La maqueta escribe «1 jul 2026», pero la
    convención de `CLAUDE.md` reserva la forma corta para listas del año en curso y aquí los
    periodos cruzan de año: «20-01-2027» junto a «20-10-2026» se lee sin pensar.
  - Estados de pago con la misma píldora en ficha y tabla (`PaymentPill`), verde pagada y roja no
    pagada, sin importes ni datos de pago.
  - Huecos cubiertos que la maqueta no enseña: sin membresía en curso (hueco entre dos periodos o
    ninguna todavía) sale un vacío explicativo y, si hay una futura, se sigue anunciando; si la
    próxima ya está pagada, el pie dice que empieza al terminar la actual en vez de pedir el pago.

- **Ver revisión** (`components/client/view-review/`, 20-09-2026): solo lectura de una revisión
  ya enviada. Cifras, las tres fotos, las respuestas y el feedback. Los borradores no se leen
  aquí: se rellenan en Revisión, y Progreso ya enlaza cada uno a su sitio.
  - **El vídeo es un enlace externo (I20)**: `target="_blank"`, `rel="noopener noreferrer"` y,
    antes de pulsarlo, se dice que abre pestaña nueva y a qué host lleva («youtu.be»). La app no
    embebe el vídeo ni lo aloja.
  - **Las respuestas salen de la copia congelada** de la revisión —enunciado y formato—, nunca del
    catálogo actual (I12). El máximo de la escala también sale del formato congelado, así que una
    pregunta que era 1-5 se sigue leyendo «4/5» aunque hoy sea 1-10.
  - Huecos que la maqueta no enseña: **enviada sin feedback todavía** (la S5 de la demo) sale como
    «Todavía sin feedback», distinguiendo si el entrenador ya la abrió (`vista`) o no; **fotos no
    recuperables** (deuda de las `object URL`) se detectan con `onError` y dicen por qué no están,
    en vez de un hueco roto; sin ninguna revisión enviada, vacío explicativo.
  - La cabecera de cifras enseña el peso y **las dos primeras medidas de la revisión**, en orden de
    catálogo. La maqueta enseña cintura y cadera; elegirlas automáticamente sería un juicio, el
    mismo criterio que en Progreso.
  - El selector de revisión es un `<select>` nativo: en táctil abre el selector del sistema y no
    depende de `ui/select`, que es Radix y está por diagnosticar. La revisión elegida viaja en la
    query (`?review=`), así que la página necesita `Suspense` para seguir siendo estática.

### Panel del entrenador

- **Biblioteca de ejercicios** (`components/trainer/library/`, tarjeta 7, integrada el
  27-09-2026). Primera pantalla del panel; deja montados los tres patrones que reutilizan las
  demás: rejilla con filtros, panel de edición lateral y acción destructiva con aviso.
  - **«Eliminar» archiva** (I13, §7). Antes de confirmar, el diálogo **nombra a los clientes** que
    tienen el ejercicio prescrito y cuántas plantillas se ven afectadas, y dice que las rutinas
    archivadas se quedan intactas para que un `WorkoutLog` antiguo siga resolviendo el nombre.
  - **El vídeo no se embebe** (I20): donde la maqueta pone un recuadro de previsualización hay un
    enlace que dice a qué host lleva y abre en pestaña nueva.
  - **Grupo y material son texto libre**, con sugerencias de los valores existentes en vez de
    selects, y los filtros se derivan de los datos. Al guardar pasan por `canonicalText`
    (`lib/domain/text.ts`, con test): recorta y adopta la grafía ya existente ignorando
    mayúsculas y tildes, así que «pierna» y «Pierna» no acaban siendo dos filtros. **No unifica
    plurales**: «Piernas» sigue siendo un valor distinto, porque eso ya sería decidir por el
    entrenador.
  - `ExerciseInput` deja de exigir `status` (tarjeta 29): el adaptador siempre crea en «activo»,
    así que el tipo solo producía relleno. Revisados los demás puertos: era el único con ese vicio.
    `ClientInput` incluía `status` y el adaptador no lo forzaba; desde el alta de cliente
    (tarjeta 6) tampoco lo lleva y el adaptador crea siempre en `invitado`.

- **Cuestionario y Medidas** (`components/trainer/catalog/`, tarjeta 12, integrada el
  27-09-2026). Las dos pantallas comparten `CatalogList`, el armazón del catálogo ordenable del
  entrenador: orden con botones de subir y bajar —sin dependencia de arrastre, accesible por
  teclado y usable en táctil—, archivado con aviso corto, archivadas en sección plegada con
  «Restaurar», «+ Añadir» al final y vacío explicativo. Cada pantalla solo pone los campos de su
  fila.
  - **El puerto gana `unarchive`** en los dos catálogos. Sin él, archivar por error obligaba a
    crear otra entrada: otro id, y por tanto la serie de esa medida partida en dos en las
    gráficas de Progreso. Restaurar devuelve la entrada con su id y su orden, y vuelve a exigirse
    en la siguiente revisión que se abra. Con test.
  - **Cuestionario**: el enunciado se edita siempre; el formato —tipo y límites de la escala— se
    ve **deshabilitado** en cuanto la pregunta tiene respuestas (I15), con la razón al lado y qué
    hacer en su lugar. Enseñarlo bloqueado, y no negarlo al guardar, es lo que evita que el
    entrenador escriba un cambio que el dominio va a rechazar.
  - **Medidas** (§11.1, la pantalla que la maqueta no tiene): etiqueta y unidad corta con
    sugerencias de las ya usadas. La unidad pasa por `canonicalText`, así que «CM» se guarda «cm».
  - **Los datos de demo traen una pregunta sin responder** («Estrés fuera del gimnasio»): con las
    cinco originales ya respondidas, el formato editable no se veía en pantalla ni se podía
    verificar. El generador de respuestas de Jorge y Sara la excluye a propósito, y el test de
    apertura de revisión comprueba que se exige y que sigue sin respuestas.
  - **Esa pregunta dejó «Parcial» todas las revisiones de demo** (tarjeta 33, arreglada el
    27-09-2026). Las ocho compartían un `REQUIREMENTS` calculado del catálogo actual, así que la
    pregunta nueva pasó a exigirse también en revisiones cerradas semanas antes, que nadie podía
    haber respondido: Progreso las enseñaba «Parcial» donde la captura 06 pone «Completa ✓». El
    dominio ya hacía lo correcto —`openReview` congela los requisitos al crear la revisión e
    `isReviewComplete` los lee de ahí (I5)—, así que el fallo era solo del seed. La foto pasa a
    ir **escrita a mano**, con los ids literales, y se llama `REQUIREMENTS_BEFORE_STRESS_QUESTION`:
    lo que falló no fue su valor sino que una constante compartida se calculara de datos vivos, y
    con un nombre genérico la novena revisión de demo la reutilizaría igual. El test recorre las
    revisiones de demo y exige que ninguna pida una pregunta sin responder ni un id que no exista
    en el catálogo; la de Sara, parcial a propósito por no tener medidas, queda exenta por nombre.
  - **Una revisión enseña las preguntas que tenía al abrirse, no las del catálogo de hoy, y eso es
    lo esperado.** Hoy el Cuestionario del entrenador tiene seis preguntas y las cinco revisiones
    de Marta enseñan cinco: esa revisión preguntó cinco cosas y así tiene que leerse siempre.
    No es un resto del arreglo de la tarjeta 33 ni un dato que falte. Lo mismo vale para el
    enunciado y el formato de cada respuesta, congelados en ella (I12): editar el catálogo no
    reescribe el histórico. Lo que sí sería un fallo es lo contrario — que una revisión cerrada
    empezara a enseñar, o a exigir, una pregunta posterior a su apertura.

  Tres decisiones que no estaban en la tarjeta:
  1. **Guardado mixto.** El orden, el archivado y la restauración se aplican en el acto: son
     acciones estructurales, cada una con su llamada al puerto y su confirmación. Los textos
     —enunciado, formato, etiqueta, unidad— son borrador hasta «Guardar», como en la maqueta.
  2. **Las filas nuevas viven en local** hasta guardar, porque crear exige enunciado o etiqueta no
     vacíos. Salen al final de la lista, con borde de acento y validación en línea.
  3. **`useQuestionsWithResponses`**, hook que pregunta al puerto por cada pregunta activa si ya
     tiene respuestas: es lo que permite enseñar el bloqueo antes de intentarlo. Con backend
     necesitará un contador en vez del conjunto de respuestas; anotado en la tarjeta del adaptador.

  **Los catálogos pierden el borrador al salir de la pantalla.** Salir sin guardar pierde los
  textos editados. **Decidido no poner guardia de navegación**: interceptar la navegación cuesta
  más de lo que evita para un formulario de cuatro campos. En su lugar el pie va pegado abajo, en
  acento mientras haya cambios, y lo dice con todas las letras.

- **Terreno común antes de Detalle de cliente** (tarjeta 32, integrada el 27-09-2026). Dos cosas
  que salieron del reconocimiento de la captura 10 y que, por la regla «lo compartido va primero y
  va solo», aterrizaron en `main` antes que la pantalla.
  - **Las etiquetas de estado de cliente pierden el género.** La maqueta escribe «Activa» y
    `es.status.client` decía «Activo»: ahora son «Invitación pendiente», «En activo» y «Baja».
    Cambian solo los literales; los valores del dominio (`invitado`, `activo`, `dado_de_baja`) son
    identificadores y no se tocan. La regla general está en «Idioma» de `CLAUDE.md`, porque
    reaparece con cada literal nuevo y no basta con arreglar estos tres.
  - **`MeasurementsCard` y `WeightEvolutionCard` pasan a `components/charts/`**, con sus literales
    de `es.screensProgress.{weight,measurements}` a `es.charts.{weight,measurements}`: un
    componente que usan las dos áreas no cuelga de una pantalla, tampoco en el archivo de textos.
    Se movieron las dos, y no solo la de medidas, porque la gráfica de peso del entrenador es
    exactamente la del cliente con otro título. El título pasa a ser una prop opcional con el
    valor de antes por defecto, para que la pantalla del entrenador pueda titularla sin volver a
    editar terreno común. Traslado e imports: Progreso se comprobó en el navegador después y se
    comporta igual.
  - **La tercera salida —que `components/trainer/` importe de `components/client/`— queda
    descartada por escrito** en «Estructura» de `CLAUDE.md`. Es peor que mover: convierte un área
    en dependencia de la otra y ata su diseño, y el día que la UI de cliente se reescriba para
    móvil se lleva por delante el panel. Sin el porqué escrito, parece la opción barata.

Desde aquí, una entrada corta por tarjeta integrada. El detalle está en el comentario de cada
tarjeta y en la descripción de su PR. «Sin tarjeta» marca deuda que todavía no tiene una propia.

- **Login** (`app/(auth)/login/`, `components/login-form.tsx` y `login-hero.tsx`, tarjeta 37,
  PR #17). Dos columnas de la captura 01 que se apilan en móvil. Valida contra el adaptador en
  memoria y, mientras se desarrolla el panel, lleva a `/dashboard`. La revisión de errores le
  corrigió colores y textos (E22, tarjeta 39) y su literal suelto (E19). Deuda: auth real y el
  resto de E19 (tarjeta 35).

- **Menú hamburguesa** (`components/ui/sheet.tsx` y `mobile-nav.tsx`, tarjeta 48, PR #24). Por
  debajo de `lg`, barra superior con hamburguesa en las dos áreas; desde `lg`, sin cambios. El
  área de cliente también lo recibe: su nav con scroll horizontal no se entendía. El panel se
  cierra con Escape, tocando fuera o navegando. Deuda: no hay botón de cierre visible (sin
  tarjeta); el responsive del resto del panel se midió en la tarjeta 49 (PR #68).

- **Panel de control** (`components/trainer/dashboard/`, tarjeta 4, PR #21). Cuatro cifras de
  toda la cartera —no de la página visible—, las cinco últimas revisiones enviadas con «Ver
  todas» a `/reviews` y la tabla de clientes paginada en servidor. «Revisiones esta semana» cuenta
  por fecha de envío. La tarjeta 60 le añadió carga y error (E15), quitó «inactivos», que no es un
  estado del dominio (E13), y cerró la 52: fuera «Bloque», «Última revisión» real. Deuda:
  unificar sus cifras en una consulta (tarjeta 42).

- **Seguimiento de clientes y selector común** (`components/trainer/clients/`,
  `components/trainer/client-picker.tsx`, tarjetas 51 y 57, PR #25 y #38). Lista de la cartera con
  plan, semana, revisión nueva, pago de la membresía vigente y estado; filtro por estado con
  contadores, paginación en servidor y revisiones nuevas primero. Desde el PR #38 Clientes,
  Membresías y Asignación usan el mismo `ClientPicker`: se elige **un** cliente. Con ese cambio
  desapareció la búsqueda por texto parcial; quedó avisado en la tarjeta 57 como consecuencia, no
  consta que se decidiera (sin tarjeta). «Última revisión», su deuda, llegó con la tarjeta 60.

- **Detalle de cliente** (`components/trainer/client-detail/`, tarjeta 5, PR #22). Cabecera con
  estado y semana, rutina y macros asignadas, gráficas de `components/charts/` y el histórico por
  pares de semanas. «Ver revisión nueva» solo enlaza: abrirla es lo que la pasa a `vista`. Fuera
  «Bloque» y la adherencia; un borrador se ve «En curso n/4», sin enlace. Deuda: con un único
  pesaje la gráfica no pinta nada, también en Progreso (sin tarjeta).

- **Alta de cliente** (`/clients/new`, tarjeta 6, PR #26). Datos, membresía inicial obligatoria y
  siguiente paso (detalle o Asignación). El cliente nace siempre `invitado` y la fecha de alta es
  editable, hoy por defecto. «Invitar» no envía nada. Desde la tarjeta 60 valida con los esquemas
  del dominio (E21). Deuda: email duplicado sin decidir y sin transacción entre cliente y
  membresía (sin tarjeta); el consentimiento, en la 31.

- **Editar datos del cliente** (`/clients/[clientId]/edit`, tarjeta 43, PR #35). Comparte la
  tarjeta de datos con el alta. La fecha de alta se ve pero no se edita (I22) y el estado tiene
  su propio flujo. La cadencia es un número de días libre. Deuda: qué pasa al cambiar el email
  cuando las fotos vivan en el Drive (sin tarjeta, afecta a la 35 y la 17). Un cliente de baja no
  admite cambios (`docs/dominio.md` §7, PR #87): su página de edición por URL muestra el aviso en
  vez del formulario (tarjeta 63, PR #88).

- **Baja y reactivación** (`client-status-action.tsx`, tarjeta 44, PR #37). Tarjeta al pie del
  detalle con su diálogo. Decidido con el propietario: la baja no toca plan ni membresía,
  reactivar vuelve siempre a «En activo» y se puede dar de baja desde cualquier estado. La baja no
  borra nada: el borrado a petición es otra operación (tarjeta 31). Deuda: «reactivar» no está en
  §7 (H6, tarjeta 61); qué bloquea la baja con auth real (tarjetas 34 y 35).

- **Membresías** (`components/trainer/memberships/`, tarjeta 13, PR #18). Una fila por periodo,
  no por cliente como la captura 17: las renovaciones son filas nuevas. Chips Todas / No pagadas
  / Caducan pronto (vigente que acaba en 7 días o menos) y edición en línea. Los solapes se marcan
  «Solapada» y se avisan sin bloquear, porque el dominio no los prohíbe. Deuda: contadores y
  solapes se recalculan sobre toda la cartera en cada consulta (sin tarjeta).

- **Membresía en el detalle y renovación** (`membership-card.tsx`, `renew-membership-dialog.tsx`,
  tarjetas 45 y 38, PR #36). La vigente, la próxima y aviso de solape; «Gestionar» abre
  Membresías filtrada por el cliente. «Renovar» crea una fila nueva: inicio el día siguiente al
  último fin (hoy si ya pasó) y estado «No pagada» por defecto. Renovar solo existe aquí. Deuda:
  `ToggleChip` copiado en el alta y en el diálogo, y el filtro de Membresías no actualiza la URL
  (sin tarjeta).

- **Revisión de cliente y envío de feedback** (`components/trainer/client-review/`, tarjetas 11 y
  15, PR #27, #28 y #33). Abrir una revisión enviada la pasa a `vista` (I17) y la comparación de
  fotos es una acción explícita (I10). **Se aparta de la captura 14 y de su tarjeta en dos
  cosas**, decididas al implementar y que solo constan en los commits (`98706eb`, `7afd6ef`):
  tiene **dos pestañas y no tres** —«Fotos y peso» juntas, y «Cuestionario»—, y en el feedback
  **el vídeo es obligatorio y la nota opcional**, aunque el dominio admite un feedback sin vídeo.
  Las fotos y respuestas de solo lectura se movieron antes a `components/review/` (PR #27).

- **Revisiones recibidas** (`/reviews`, tarjeta 41, PR #34). Sin captura: sigue el patrón de
  Seguimiento, con chips por estado y contadores, paginación en servidor y nuevas primero. Los
  borradores no se listan. Cada fila abre la revisión con «Volver a revisiones». Deuda: su
  buscador sigue siendo de texto libre, distinto del `ClientPicker` (sin tarjeta).

- **Plantillas** (`components/trainer/templates/`, tarjeta 8, PR #29). Rutinas y menús en una
  rejilla con filtros, «Usada en N clientes», duplicar y eliminar avisando de que lo asignado no
  cambia. El uso es un modelo de lectura del puerto, no un campo del dominio, y se cuenta por el
  nombre congelado en cada plan. Deuda: renombrar una plantilla pierde sus usos y dos con el mismo
  nombre los suman (tarjeta 69); duplicar desde un plan, en la 55 (PR #72, abajo).

- **Crear y editar plantilla** (`/templates/new`, `/templates/[kind]/[templateId]`, tarjetas 53
  y 54, PR #30). Sin captura: el layout de la 12 sin macros del cliente. Los editores de rutina y
  menú viven en `components/editor/`, controlados y sin datos, para que los use también el editor
  de plan; `NativeSelect` pasó a `components/ui/`. Se reordena con botones, sin arrastrar. Si el
  guardado falla, el aviso dice qué falta, con un texto para rutina y otro para menú, y se marcan
  los nombres vacíos del menú, de cada comida y de cada alimento, y el de la plantilla (tarjeta 98,
  PR #99). Las marcas siguen hasta guardar con éxito o hasta volver a lo guardado, y cada campo se
  desmarca en cuanto tiene texto. El texto de ejemplo de la comida es «Ej.: Desayuno». Las marcas
  del menú las pinta `MenusEditor` con la prop opcional `showErrors`. Deuda: sin aviso al navegar
  dentro de la app con cambios, sin nota por ejercicio y `<title>` genérico (tarjeta 69); si lo
  único que falta es el nombre de la plantilla, el aviso general sale igualmente y habla de
  ejercicios o de menús (tarjeta 100).

- **Asignación de plan** (`components/trainer/assignment/`, tarjeta 9, PR #31). Cliente por
  `?clientId=` (sin los de baja); entreno y menú desde plantilla o desde cero, y macros aparte.
  Asignar clona la plantilla como borrador (§4) y lleva al editor. Las kcal son un campo
  obligatorio desde la tarjeta 58. Deuda: asignar dos veces la misma plantilla crea dos
  borradores, sin aviso (tarjeta 69).

- **Editor de plan** (`components/trainer/plan-editor/`, tarjeta 10, PR #32). Pestañas Rutina y
  Menú sobre los editores de `components/editor/`, «Partir de plantilla» y un solo «Publicar
  cambios». La edición en sitio de la rutina activa que decidió la tarjeta la sustituyó D3
  (§7): publicar sobre un plan activo crea versión nueva (E27, tarjeta 60). Cerrar o recargar la
  pestaña con cambios sin publicar avisa (tarjeta 97, PR #97). El aviso es `useUnsavedGuard`,
  movido a `components/editor/use-unsaved-guard.ts`, y lo comparten el editor de plan y los dos
  editores de plantilla. Al fallar la publicación, los menús y el nombre de la rutina siguen la
  misma regla de marcas que las plantillas (tarjeta 98, PR #99).
  Deuda: navegar dentro de la app («← Volver», barra lateral) sigue
  perdiendo los cambios sin aviso, aquí y en las plantillas, porque `beforeunload` no salta en la
  navegación del router (tarjeta 69); en móvil es usable pero largo (≈4.500 px a 390; tarjeta 49, PR #68).

- **Alimentos en Biblioteca y cálculo en el editor de menú** (tarjeta 89, PR #95).
  `docs/dominio.md` §4, §5 e I28–I30.
  - **Biblioteca:** pestañas Ejercicios y Alimentos, con la activa en la URL (`?tab=foods`). Tus
    alimentos por nombre; el catálogo común solo se busca, con 300 ms de espera entre teclas y «Ver
    más». Cada fila dice su origen (Tuyo, De otra cuenta, USDA, Open Food Facts) y si está
    pendiente de publicar; lo ajeno se abre en solo lectura y «Eliminar» archiva. Panel a la
    derecha desde `xl` y en Sheet por debajo.
  - **Editor de menú** (plantillas y editor de plan): el campo del alimento sugiere tus alimentos
    y el catálogo, admite texto libre («Sin composición · no suma», con «Guardar en Alimentos») y
    crea alimentos sin salir del menú. Renombrar se calcula desde el alimento tal como estaba al
    entrar en el campo: volver a su nombre recupera el vínculo y Escape lo restaura. Debajo de cada
    alimento, lo que aporta; en cada comida, su subtotal; y «Lo que llevas» frente a las macros del
    propio menú, con la tolerancia de «Cuadra» (5 kcal, 1 g por macro): columna fija desde `xl`,
    2×2 fijo entre `sm` y `xl`, y en móvil un resumen de una fila que aparece al salir el 2×2.
    Avisa y no bloquea (I30). Un catálogo caído no impide elegir lo tuyo ni escribir.
  - **Terreno común:** `FoodForm` vive en `components/editor/` y sus literales en `es.foodForm`;
    `vitest.config.ts` recoge también `components/**/*.test.ts`, para la lógica pura que vive junto
    a un componente (el renombrado).
  - **Comprobado** contra el proyecto real de Firebase (08-10-2026): crear, usar en una plantilla y
    archivar un alimento, sin `failed-precondition` ni `permission-denied`; `foods` no necesita
    índice compuesto (sus consultas son solo de igualdad). Y en un iPhone con Safari.
  - **Aceptado:** en iPhone, con el teclado abierto, el resumen compacto puede quedar por encima de
    lo visible, porque Safari desplaza lo visible sin mover lo fijo; al cerrar el teclado se ve
    bien. Sin arreglo ni tarjeta. **No probado:** Firefox.

### Lo que no es pantalla

- **Un pesaje por cliente y día** (tarjeta 40, PR #19 y #20). I23 en `docs/dominio.md`:
  registrar peso en una fecha que ya tiene pesaje lo actualiza, conservando id y fecha de
  creación, así que la revisión que lo referencia no se rompe. El puerto pasa a
  `saveWeightLog`. La regla de la nota (vacía conserva la anterior) vive en el adaptador, y el de
  Firebase tendrá que repetirla.

- **Las kcal las fija el entrenador** (tarjeta 58, PR #39 y #40). `Macros` lleva `kcal`
  obligatoria y entera, que se guarda tal cual; la app no comprueba 4/4/9 ni avisa
  (`docs/dominio.md` §5). Se retira `derivedKcal`. El campo de kcal es propio
  (`components/editor/kcal-field.tsx`) y no admite punto de millar. Las barras de «Tu objetivo
  del día» del cliente, opción B (ver Menú).

- **Revisión de errores y sus arreglos** (tarjetas 30 y 60, PR #41 y #42). El informe, las
  decisiones que salieron de él y el estado de los treinta hallazgos están en
  `docs/revision-errores-2026-09-30.md`; no se repiten aquí. En el mismo PR se cerraron las
  tarjetas 52 y 39. Siguen abiertos los huecos menores (tarjeta 61) y lo que apareció por el
  camino (62, 63 y 64).

- **Autenticación con correo y contraseña e invitación por enlace** (tarjeta 35, PR #44).
  `docs/dominio.md` §12. Se aparta de la descripción de la tarjeta, que pedía Google obligatorio:
  **no hay login con Google** (decisión del 03-10-2026). El entrenador da de alta al cliente, la app
  le envía un enlace de correo, el cliente lo abre, reescribe su correo y crea su contraseña, y en
  ese primer acceso pasa de `invitado` a `activo`. Nuevo `InvitationPort` (con mock) y `Session`
  con `role`; `RoleGate` en los dos layouts manda a cada cuenta a su área (`lib/session-access.ts`);
  pantalla `/accept-invite` sin captura, sobre el layout del login. El alta de cliente envía la
  invitación y, si falla un paso, el reintento repite solo el que falta (antes habría duplicado la
  membresía). `users/{uid}` enlaza cuenta y persona; el del entrenador lo crea el propietario a mano (ya creado, 06-10-2026).
  El enlace lleva el id del cliente (`?c=`), no su correo. Deuda: los correos no se normalizan a
  minúsculas (cambio de dominio, sin tarjeta); `/login` no redirige a quien ya tiene sesión; el
  cierre de sesión ya está en las dos áreas (tarjetas 50 y 56, PR #61 y #62).

- **Reglas de seguridad de Firestore** (tarjeta 34, PR #45). `firestore.rules` defiende I1, I2, I11,
  I13, I15, I16, I17, I18, I21, I22, I23 e I26 con 34 tests de emulador (`pnpm test:rules`); I3, I4,
  I25 e I27 y la mitad de I8 quedan en el adaptador, y el encabezado del archivo lo dice. Dos
  campos fuera del dominio, `hasResponses` y `hasMeasurements`, son banderas del catálogo que sube
  el cliente. **Las reglas están desplegadas en el proyecto de Firebase** (06-10-2026). Consecuencia para el
  adaptador: el cliente solo lee rutinas, menús y macros que no sean borrador, así que sus consultas
  tienen que filtrar por estado.

- **Configuración de los emuladores** (PR #46, sin tarjeta). `test:firebase` ejecuta ahora también el
  emulador de Auth; antes los tests de auth se saltaban siempre.

- **CI en GitHub Actions** (tarjeta 28, PR #48). `.github/workflows/ci.yml` ejecuta `lint`,
  `typecheck`, `test` y `build` en cada PR y en cada fusión a `main`, con un único job cuyo check se
  llama `CI` (límite de 15 minutos, `ubuntu-latest`). Node sale de `.nvmrc` (22) y pnpm es la
  versión 12; cada paso corre aunque falle el anterior, para ver todos los fallos juntos. Deuda:
  falta activar la protección de rama exigiendo el check `CI` (ver «Siguiente»).

- **Reenviar invitación** (tarjeta 47, PR #49). En el detalle de un cliente `invitado` aparece
  `client-invitation-card.tsx`, con un botón que vuelve a enviar el mismo enlace de correo (§12), por
  si no llegó o caducó. Confirma a qué correo lo envió y muestra un aviso si el envío falla; cuando
  el cliente entra y pasa a `activo`, la tarjeta desaparece. Se aparta de la descripción de la
  tarjeta, que hablaba de Google: no hay login con Google.

- **Adaptador de datos de Firebase** (tarjeta 16, PR #51, #55 y #56). Cubre los 15 puertos de
  entonces (el decimosexto, `passwordReset`, llegó con la tarjeta 85, PR #82;
  `lib/data/adapters/firebase/ports.ts`) y se monta en `app/providers.tsx` solo con
  `NEXT_PUBLIC_DATA_BACKEND=firebase`; sin la variable la app sigue con el adaptador en memoria y el
  SDK ni se descarga. Lo que en Postgres haría una restricción aquí es una transacción: activar un
  plan archiva el anterior y escribe todo junto (I4), y `archiveExercise` y `deleteWeightLog`
  releen cada documento dentro de la transacción para no pisar una edición ni saltarse I25 (#55).
  Las listas del panel se paginan en el servidor (`listReviewsTracking`) y `listClientsTracking`
  lee solo la última revisión enviada; ambas añaden índices compuestos sobre `reviews`. El #56 retira
  el recuento de uso de las plantillas, que costaba una consulta por plantilla: `TemplatePort`
  devuelve `RoutineTemplate[]` y `MenuTemplate[]` y desaparecen los `*Summary`
  (**BREAKING CHANGE** de puerto). Las reglas ya están desplegadas (06-10-2026).

- **Área de cliente sin conexión** (tarjeta 81, PR #57). El service worker precachea las pantallas
  del cliente y una `/~offline` de respaldo; la caché de TanStack Query se persiste en IndexedDB
  (7 días, invalidada en cada build) y un aviso sale cuando el navegador no tiene red. La query de
  sesión no se persiste, para no restaurar nunca una sesión caducada o ajena. **Deuda:** el cierre
  de sesión ya vacía la caché persistida (tarjeta 50, PR #61: `useLogout` llama a
  `clearPersistedCache`). El `start_url` es
  `/`, que redirige a `/login` y no se puede precachear: abrir la app instalada sin red desde el
  icono cae en `/~offline`. El aviso de conexión usa `navigator.onLine`, así que no salta con red
  pero sin servidor. No consta verificación en producción con la red cortada.

- **Escrituras del cliente en cola sin conexión** (tarjeta 82, PR #58). Guardar o borrar una serie
  de entreno y guardar un peso se registran como *mutation defaults* de TanStack Query
  (`lib/data/hooks/offline-writes.ts`): sin red se pausan, se persisten con la caché y se reenvían
  en orden al volver. Comparten una sola cola, así que un borrado posterior a una edición de la
  misma serie no la adelanta, y son idempotentes por id de documento (I23), de modo que reenviar no
  duplica. Solo hooks: ni puerto, ni adaptador, ni dominio. **Deuda:** esto no cubre las
  transacciones de Firestore detrás de `saveWorkoutLog` y `saveWeightLog`, que fallan sin red en
  vez de encolarse; la cola funciona porque la mutación espera a tener conexión antes de llamar al
  puerto. Falta decidir qué ve el cliente si una escritura encolada falla al reenviarse (por
  ejemplo, una rutina archivada mientras tanto): hoy se pierde sin avisar. Falta la actualización
  optimista con marca «pendiente de enviar». Borrar un pesaje offline sigue fuera (I25). No consta
  verificación con la red cortada ni contra las reglas de seguridad con Firestore real.

- **Perfil del cliente y cerrar sesión** (tarjeta 50, PR #61). `/profile` («Tu perfil»), solo
  lectura: datos (nombre, email, teléfono, objetivo, nivel), seguimiento (alta con su semana,
  cadencia, entrenador) y un bloque «Sesión» con «Cerrar sesión». Se llega desde el avatar: el de la
  nav superior en escritorio y el bloque de usuario del menú hamburguesa en tablet y móvil. No hay
  captura de diseño: es una propuesta, sin aprobar. No se edita nada («díselo a tu entrenador») ni
  hay cambio de contraseña. `useLogout` cierra la sesión, vacía la caché de memoria y borra la copia
  de IndexedDB (`clearPersistedCache`), y la pantalla lleva a `/login`. El mensaje de commit del PR
  dice que el acceso será solo con Google: es falso, no hay login con Google (§12). **Deuda:**
  cambiar contraseña y foto, y no consta prueba contra Firebase real, solo con el adaptador en
  memoria.

- **Cerrar sesión desde el panel** (tarjeta 56, PR #62). Botón «Cerrar sesión», con icono, bajo el
  bloque de usuario de la barra lateral del entrenador y de su menú hamburguesa
  (`components/ui/sign-out-button.tsx`). Usa el mismo `useLogout` que el perfil del cliente, lleva a
  `/login` y, si el cierre falla, lo dice en el propio bloque y la sesión sigue abierta. Se eligió el
  botón y no una pantalla de ajustes del entrenador, que tocaría el dominio (qué campos de `Trainer`
  edita); sin captura, es una propuesta. **Deuda:** el perfil del cliente tiene su propio botón en
  vez de usar este componente, y no consta prueba contra Firebase real.

- **Panel del entrenador responsive** (tarjeta 49, PR #68). Se midieron las 17 rutas del panel a 390 y
  768 px en un iframe del ancho exacto, en desarrollo y en producción: **ninguna desborda**. Lo que
  fallaba era pequeño: los enlaces «volver» del editor de plantillas, de la alta de plantilla y del
  editor de plan y el «Editar» de las tarjetas de plan medían 15-20 px (ahora 32), y dos datos
  vivían solo en un `title`, que en táctil no existe: la definición del filtro «Caducan pronto» de
  Membresías (ahora se escribe bajo la cabecera cuando está activo) y el significado de «Reps máx.»
  vacío (el campo vacío muestra «Fijas»). El detalle de cliente conserva su orden en móvil, sin
  reordenar bloques con `order`. **Deuda:** el editor de plan sigue siendo largo en móvil y no se
  evaluó ofrecer otra cosa en su lugar; no consta prueba en un móvil físico ni con Firebase real.

- **Plantilla desde el plan de un cliente** (tarjeta 55, PR #71 y #72). La tarjeta punteada
  «Duplicar desde un plan existente», última de la rejilla de Plantillas, abre un diálogo: cliente,
  qué copiar y nombre, y al crear va al editor de la plantilla nueva, como el alta. De rutina se
  elige una, activa o archivada; de menús, uno o varios, activos o archivados y de versiones
  distintas si se quiere. Los borradores no se copian. La copia son dos funciones puras de dominio,
  `routineToTemplateContent` y `menusToTemplateContent`, con ids nuevos y sin vínculo con el origen
  (§4); al mezclar versiones se queda un menú sugerido por tipo de día. El PR #71 añadió antes
  `MenuPort.listArchivedMenus` y el hook `useArchivedMenus` (solo añade un método, sin cambiar
  firmas). El prototipo dibuja la tarjeta pero no el flujo: el diálogo es una propuesta sin
  aprobar. **Deuda:** no se probó la lista de menús archivados en el navegador (la demo no tiene
  ninguno); no consta prueba con Firebase real; si una rutina archivada prescribe un ejercicio
  archivado después, el guardado puede fallar por I3 y el diálogo solo dice que no se pudo crear.

- **Planes anteriores del cliente** (tarjeta 46, PR #76). La tarjeta «Planes anteriores» del detalle
  de cliente abre un pop-up de solo lectura que se abre con todo el historial: una línea de tiempo
  (carril de rutina y uno por tipo de día de los menús, solo desde `lg`) y la lista de planes con lo
  que duró cada uno y la píldora «En uso» en el vigente. «Filtrar por fechas» despliega un
  calendario (`RangeCalendar`, nuevo en `components/ui`, sin dependencia nueva) que marca con un punto
  los días en que cambió un plan, destaca esos días en la línea de tiempo y filtra la lista con
  contadores del tipo «2 de 3». El primer diseño pedía las fechas antes de enseñar nada; este es la
  propuesta de Dani sobre él, y tampoco hay captura del prototipo: **el pop-up es una propuesta sin
  aprobar**. El dominio no guarda fecha de activación ni de archivado, así que
  `lib/domain/plan-periods.ts` las **deduce** (§7: un plan se archiva en el mismo instante en que se
  activa el siguiente): cada plan archivado va desde el archivado del anterior hasta el suyo, y el
  primero cuenta desde su creación. Los menús de un tipo de día archivados a la vez salen como un
  solo plan. Las duraciones son la diferencia entre fechas (el día del relevo no cuenta dos veces) y
  `planDays` y `planChangeDays` son funciones puras con test. Por debajo de `lg` no se pinta la
  línea de tiempo, porque a 390 px la columna de etiquetas no deja ancho a las barras, y quedan el
  filtro y la lista. «Periodo» de la propuesta se escribió «Fechas elegidas»: «periodo» está en el
  vocabulario prohibido. **Deuda:** un hueco sin plan (el anterior se archivó sin que lo sustituyera
  otro) no se detecta y una barra continua en la línea de tiempo podría esconderlo; los macros
  objetivo no se listan (no hay método de listado de archivados); la demo no tiene planes archivados
  y se comprobó a 390, 768 y 1280 px con datos temporales, ya revertidos, pero no se vio el estado
  vacío en el navegador ni se probó con Firebase real.

- **Entreno de otro día** (tarjeta 18, PR #78). Pantalla `/routine/past`, en el área de cliente,
  para corregir o añadir el entreno de una fecha pasada: fecha elegible, pestañas de día de
  rutina y las mismas filas de serie de Rutina. Se llega desde un enlace bajo la rejilla de Rutina
  («¿Te saltaste un día? Regístralo»), que sigue siendo solo la de hoy. El primer intento la puso
  en Progreso, con una sección «Entrenos»; el 07-10-2026 se decidió con el propietario y con Dani
  que va en Rutina, donde está quien se ha saltado un día, y esa sección se quitó. Sin `?date`
  abre en ayer; el día de rutina por defecto es el que ya tiene registros esa fecha o, si no, el
  siguiente al último registrado antes. Sin límite hacia atrás; se rechazan fechas futuras o
  inexistentes. Sin cambio de puerto (`saveWorkoutLog` y `deleteWorkoutLog` ya recibían la fecha).
  `ExerciseCard` gana la prop opcional `hint` para el pie de la rejilla. **La pantalla no tiene
  captura**: reutiliza el layout de Rutina y es una propuesta sin aprobar; Rutina sí la tiene, y
  solo gana el enlace. **Deuda:** solo se editan líneas de la rutina activa (un registro de una
  línea ya retirada no se ve en la rejilla); dos pestañas o dispositivos no avisan de conflicto, y
  gana el último en guardar, igual que en Rutina; no consta prueba con Firebase real.

- **Última vez de cada ejercicio** (tarjeta 84, PR #79). Bajo la prescripción de cada ejercicio de
  Rutina sale «Última vez (3 oct): 77,5 kg × 8 · 80 kg × 8 · 80 kg × 6», visible sin abrir el
  registro, y cada fila de serie, al desplegar, enseña lo de esa serie la última vez junto a su
  estado («✓ guardada»), no en su lugar. Se calcula **por ejercicio**: `lastExerciseRecord`, nuevo
  en `lib/domain/workout.ts` y con test, devuelve el último día anterior al dado en que se
  registró, en el día de rutina que fuera. Antes era por día de rutina (`latestDayRecord`): no
  salía si el ejercicio no estuvo en el último día registrado de ese día de rutina ni si estaba en
  otro, y desaparecía al guardar la serie. Las líneas que se conservan entre versiones de la
  rutina mantienen su id (§7), de modo que lo que se perdía era la línea nueva o el ejercicio
  puesto en otro día. `ExerciseCard` cambia su prop `reference` por `lastTime`; la pantalla de
  entreno de otro día lo lleva también, contado desde la fecha elegida. `latestDayRecord` sigue en
  Rutina solo para el «Última vez: DD-MM-YYYY» de la tarjeta lateral. Rutina tiene captura: es una
  línea nueva en la tarjeta y una segunda en las filas con estado, sin cambiar el layout; queda
  sin aprobar por quien revise el área de cliente. **Deuda:** no consta prueba con Firebase real;
  si hoy se registran más series que la última vez, esas filas no llevan referencia; y la
  referencia de fila y la de cabecera dicen lo mismo, así que se puede quitar una si molesta.

- **Histórico de revisiones acotado en Progreso** (tarjeta 86, PR #81). La lista de revisiones de
  Progreso pintaba todas, una por semana, y la pantalla crecía sin límite. Ahora enseña las **tres
  parejas de semanas más recientes** (≈ 6 semanas) y, si hay más, un botón «Ver todas las
  revisiones (N)» despliega el resto en la misma página, con «Ver solo las últimas» para volver a
  plegarlo; el botón solo sale si hay algo que desplegar. El borrador en curso está siempre en la
  pareja más reciente, así que nunca se esconde. Elegido con el propietario entre tres opciones
  (frente a plegar los antiguos o «cargar más» de 3 en 3). Progreso tiene captura aprobada: con un
  histórico corto, como el de la demo, no cambia nada visible, y el botón aparece de la semana 7 en
  adelante. **Deuda:** el límite es una constante fija (`RECENT_GROUPS`); no se probó con Firebase
  real.

- **Recuperación de contraseña** (tarjeta 85, PR #82). «He olvidado mi contraseña», que era un
  `href="#"`, lleva a `/forgot-password` (escribir el email y recibir el enlace); el enlace del
  correo abre `/reset-password` (elegir la contraseña nueva), que al guardar vuelve a `/login?reset=1`
  con el aviso «Contraseña cambiada. Entra con la nueva.». Mismo armazón de dos columnas que el
  acceso y que aceptar invitación. Decidido con el propietario el 07-10-2026 y escrito en
  `docs/dominio.md` §12: pantalla propia en lugar de la página alojada por Firebase, el mismo aviso
  exista o no la cuenta (más una línea fija para el cliente `invitado`) y volver al acceso sin
  abrir sesión. Puerto nuevo `PasswordResetPort` (`sendPasswordReset`, `checkPasswordResetCode`,
  `confirmPasswordReset`) con adaptador de Firebase y adaptador de demo
  (`/reset-password?oobCode=demo`); **`DataPorts` gana `passwordReset`, así que todo adaptador debe
  implementarlo (BREAKING CHANGE) y el de Firebase pasa de 15 a 16 puertos**. Un email mal escrito se
  rechaza antes de llamar a Firebase (que lo trata como cuenta inexistente) y una contraseña corta,
  antes de gastar el código de un solo uso. `emailSchema` pasa a `lib/domain/schemas/primitives.ts`
  y lo comparten los adaptadores y el esquema de cliente. **Paso manual pendiente:** apuntar la URL
  de acción de la plantilla «Restablecer contraseña» de Firebase Authentication a `/reset-password`;
  sin eso el correo lleva a la página de Firebase. **Deuda:** el diseño no tiene captura y es una
  propuesta sin aprobar; no se probó con un correo real contra el proyecto de Firebase, solo con el
  emulador y la demo; y conviene tener App Check y las alertas de presupuesto (tarjeta 83) antes de
  abrir el flujo a usuarios reales, por la cuota diaria de correos.

- **Capa de datos de los alimentos** (tarjeta 88, PR #85). Sin pantallas: las hace la 89.
  `docs/dominio.md` §4, §5, §7, §12 e I28–I30.
  - **Dominio:** `Food` con su composición por 100 g. Los macros llevan un decimal como mucho y lo
    que escribe el entrenador se redondea a uno; el tope de 100 g se comprueba sobre lo redondeado
    y en décimas enteras, sin error de coma flotante. `FoodItem` gana `foodId` y la composición
    congelada, los dos o ninguno, así que los menús anteriores validan sin tocarlos. Funciones
    puras para lo que aporta un alimento, una comida y un menú, lo que queda frente a las macros del
    menú y la unión de lo propio con el catálogo. Clonar, duplicar o hacer una plantilla desde un
    plan conserva la copia congelada: antes copiaban solo nombre y gramos, y rompían I29.
  - **Puertos:** dos, `OwnFoodPort` (la copia propia) y `FoodCatalogPort` (el catálogo común), y
    ningún adaptador conoce al otro. `DataPorts` pasa a 18 (**BREAKING CHANGE**). Un catálogo caído
    lanza `food_catalog.unavailable`. Marcar como publicado recibe la versión publicada
    (`updatedAt`) y solo surte efecto si sigue siendo la actual.
  - **Adaptadores:** en memoria, con datos de demo (alimentos propios, uno pendiente, otros de otro
    entrenador solo en el catálogo, y el menú A con alimentos de biblioteca y uno de texto libre) y
    la caída del catálogo forzable con `NEXT_PUBLIC_MOCK_FOOD_CATALOG_DOWN=true`. En Firebase, la
    colección `foods` con transacciones y sus reglas: solo su entrenador la lee y la escribe, ningún
    cliente la lee, nada se borra y un archivado no vuelve. El catálogo responde siempre «no
    disponible» hasta que la app se conecte a su API (tarjeta 90).
  - **Hooks:** la sincronización vive una sola vez en `lib/data/hooks/food-sync.ts`, fuera de
    React. Guardar y archivar escriben, publican y marcan; si publicar falla, el alimento queda
    `pendiente` y la mutación no falla. Lo pendiente se reintenta al montar y al volver la red, y
    con el catálogo caído cada reintento cuesta una sola llamada. La lista propia que se une con el
    catálogo lleva también los archivados pendientes, para que el catálogo no los devuelva como
    ajenos.
  - **Deuda:** los índices de `foods` no están comprobados contra el proyecto real; la versión es
    `updatedAt`, así que dos escrituras en el mismo milisegundo no se distinguen; el editor de menús
    renombra sin desvincular el alimento (lo resuelve la 89 con `renameFoodItem`); no se ha visto en
    el navegador, porque no hay pantallas.

- **Catálogo de alimentos por búsqueda paginada y alimentos sembrados** (tarjeta 92, PR #93). Sin
  pantallas: las hace la 89. `docs/dominio.md` §4 y §5.
  - **Dominio:** `CatalogFood` gana `source` (`trainer`, `usda` u `off`) y la biblioteca tiene tres
    orígenes: tuyo (`own`), de otro (`other`) y sembrado, con su fuente (`seeded`). Lo que llega del
    catálogo se lee con `parseCatalogFood`, que redondea los macros a un decimal con el mismo esquema
    que lo que escribe el entrenador; lo que redondeado pasa de 100 g, o no cumple el esquema, se
    descarta sin hacer fallar la página. La copia propia se filtra por el texto con el mismo
    criterio con que busca el catálogo (sin mayúsculas ni tildes; con menos de 3 letras, solo por
    el principio del nombre o de una palabra), y tapa al catálogo entera, no solo lo que coincide:
    un propio renombrado y sin publicar no vuelve como ajeno por su nombre viejo.
  - **Puerto:** `searchCatalogFoods({ text, cursor, limit })` sustituye a `listCatalogFoods()`
    (**BREAKING CHANGE**) y devuelve una página y el cursor de la siguiente, opaco y `null` en la
    última: 10 resultados por defecto y 100 como máximo. Ningún método devuelve el catálogo entero.
    Un cursor que el catálogo no emitió da `food_catalog.invalid_cursor`, que no es «no disponible».
  - **Adaptadores:** el de memoria ordena como el contrato de la API (empieza por el texto, una
    palabra empieza por él, lo contiene; a igual relevancia, los sembrados primero; con el texto
    vacío, todos por nombre), respeta el límite aunque lo tenga todo en memoria y trae sembrados de
    USDA y Open Food Facts con dos decimales, uno de ellos por encima de 100 g al redondearlo. No
    imita las erratas de la API. Con Firebase, la búsqueda responde «no disponible» hasta la 90.
  - **Hooks:** `useFoods({ text, onlyMine })` lista entera la copia propia y busca en el catálogo
    por páginas: la primera al buscar y la siguiente solo cuando quien lo usa la pide («ver más»).
    Nada encadena páginas por su cuenta, y si hay más lo dice `nextCursor`, no el tamaño de la
    página. El catálogo está `loading`, `available`, `unavailable`, `error` (la primera página falló
    por otra cosa que no es «no disponible») o `null` con «solo los míos»; un «ver más» que falla no
    esconde lo ya cargado y da su error aparte. La unión de las páginas con la copia propia vive
    fuera de React, en `lib/data/hooks/food-library.ts`.
  - **Deuda:** el adaptador de Firebase fija el puerto 8080 del emulador de Firestore, así que con
    ese puerto ocupado `ports.test.ts` agota el tiempo aunque los emuladores estén en otro (tarjeta
    95); y la paginación por desplazamiento puede saltarse un alimento si el catálogo cambia entre
    una página y la siguiente (los repetidos sí se quitan).

- **Revisión con IA en el pre-commit** (PR #101, sin tarjeta). `.husky/pre-commit` corre `gga run`
  (Gentleman Guardian Angel) después de lint-staged: revisa los archivos staged, enteros, contra
  las reglas de `AGENTS.md`, que salen de las reglas duras y las convenciones de `CLAUDE.md`. El
  10-10-2026 la regla 9 deja de exigir comentarios en inglés (tarjeta 102): pueden ir en español o
  en inglés y la revisión no marca su idioma. **Falta** un `.gga` común en el repo: hoy cada uno
  revisa con su propia configuración.

- **PR sin tarjeta.** #14 (nombres de los generadores de datos de demo), #15 (rutas de `app/` a
  inglés), #16 (carpetas `components/cliente/` y `components/entrenador/` a `client/` y
  `trainer/`) y #33 (enlace a la revisión desde el panel de control, rama
  `feature/navigate-to-reviews`).

## Siguiente

Las pantallas del cliente y del panel están en `main`. Desde el 21-09-2026 trabajan dos personas
(sección «Equipo» de `CLAUDE.md`) y este archivo es un resumen curado que se escribe en un PR de
documentación después de cada fusión. Lo que queda, con su tarjeta:

- **Alimentos:**
  - **Conectar la API del catálogo común (90).** La API ya existe (`FitnessCRM/food-api`); la
    tarjeta está bloqueada porque la API no tiene CORS y porque falta la URL de su despliegue.
    Hasta entonces, con Firebase todos los alimentos quedan pendientes de publicar. Además, la
    implementación de la API no cumple su contrato en el orden con el texto vacío: saca primero los
    sembrados en vez de todos por nombre. La app sigue el contrato; hay que pedir en
    `FitnessCRM/food-api` que se alineen.
  - **Lo que dejó la 89, con su tarjeta:** el panel de Ejercicios en Sheet por debajo de `xl`,
    como el de Alimentos (96).

- **Backend.** Firebase está conectado y se ha probado con el proyecto real (06-10-2026): el
  `users/{uid}` del entrenador está creado, y las reglas de seguridad (tarjeta 34) y los índices de
  `reviews` están desplegados. Las reglas se comprobaron con sesión de entrenador contra el proyecto
  real el 08-10-2026 (tarjeta 34, PR #86). Falta, por este orden: decidir cuándo el adaptador de Firebase (16)
  pasa a ser el adaptador por defecto de `providers.tsx`; fotos de revisión (17), con la decisión
  de dónde guardarlas **reabierta el 05-10-2026** por el propietario: no se construye nada hasta
  cerrarla. Opciones: (a) el Drive del entrenador con un servidor y su token, que exige el plan
  Blaze de Firebase, o (b) Firebase Storage. El motivo es que con el permiso `drive.file` una app
  solo ve los archivos que ella misma creó, así que el token de un cliente no puede escribir en la
  carpeta del entrenador; y consentimiento del alta con el borrado a petición (31).
- **Recuperación de contraseña (85), paso manual:** apuntar la URL de acción de la plantilla
  «Restablecer contraseña» de Firebase Authentication a `/reset-password` (`docs/dominio.md` §12) y
  probarla con un correo real; es un ajuste de todo el proyecto, sin distinción de entornos.
- **Protección de rama** en GitHub exigiendo el check `CI` (tarjeta 28, ya hecha): pendiente de
  activar.
- **Índices compuestos de `reviews`** (tarjeta 71, en «En revisión»): los tres de
  `firestore.indexes.json` están desplegados (06-10-2026). Sin ellos, el panel, Clientes y
  Revisiones fallan con `failed-precondition` con `NEXT_PUBLIC_DATA_BACKEND=firebase`; el emulador
  no los exige, así que solo se comprueban contra un proyecto real. La tarjeta sigue en «En
  revisión» hasta su cierre.
- **Decisiones de dominio pendientes**: los huecos menores de la revisión de errores, H5, H6, H7 y
  H9 (tarjeta 61), y si archivar un ejercicio crea versión nueva de las rutinas vivas (62). La
  regla de baja ya está en §7 (PR #87); falta comprobar que asignar planes y enviar feedback a un
  cliente de baja la respetan (tarjeta 61).
- **Deuda menor con tarjeta**: favicon (19) y cifras del panel en una consulta (42). Resueltas: el nombre accesible de `NumberField` (59, PR
  #66, etiqueta y campo asociados con `useId`) y `ReviewPort.listSubmittedReviews`, que se quitó
  del puerto con su hook y su clave por no usarlo ninguna pantalla (64, PR #74, **BREAKING
  CHANGE** de puerto): «Revisiones recibidas» lee `listReviewsTracking` filtrado por `enviada`.

### Anotado para el panel del entrenador

- ~~Marcar las membresías solapadas en la tabla de Membresías~~ (20-09-2026). **Hecho en la
  tarjeta 13**: la tabla marca «Solapada» y el detalle del cliente avisa (tarjeta 45). El dominio
  sigue sin prohibir el solape.

### Puntos abiertos

- **Versión de Node.** `.nvmrc` pide Node 22 y todas las comprobaciones desde el 30-09-2026 se han
  hecho con Node 24.18, que es el que hay instalado. No se ha cambiado `.nvmrc`: queda por decidir
  si se instala Node 22 o se sube la versión fijada, y lo natural es cerrarlo con la CI (tarjeta
  28), que fijará la suya.

### Hito: pasada responsive del área de cliente — hecho (21-09-2026)

**Una sola pasada sobre todas las pantallas del cliente, cuando estén las cuatro que faltan y
antes de empezar el panel del entrenador** (decidido el 20-09-2026). No se hace pantalla a
pantalla: mientras tanto, a cada pantalla nueva solo se le exige que no desborde el viewport.

El porqué: el área de cliente es la que se usa en el móvil —el cliente mira su rutina en el
gimnasio— y el panel del entrenador es de escritorio por naturaleza, con tablas densas, barra
lateral y comparador de fotos a dos columnas.

Entra en esta pasada: los 688 px de `/review` a 390 px (la tira de completitud), y lo que
salga de revisar las demás. Ya hecho aparte, porque desbordaba todo el área: el nav de
`client-shell.tsx`.

**Cómo se midió.** En un iframe de 390 px (dentro de él la página dispone de 375: la barra de
scroll vertical del iframe ocupa 15 px, cosa que en un móvil no pasa, así que la prueba es más
estricta que el teléfono). Antes de fiarse del instrumento se comprobó que detectaba el fallo
conocido de `/review` (688 px, y señalaba la tira). Tres comprobaciones por pantalla: que nada
desborde el viewport, ningún control tocable por debajo de 32 px, y que el apartado activo del nav
se vea entero. Un «desborde» de las gráficas de Peso y Progreso resultó ser un falso positivo del
propio instrumento: el contenedor que medía era un envoltorio de Recharts de ancho 0. **Todo se
repitió al final contra el build de producción**: las siete pantallas pasan, sin avisos de
hidratación. Y a ojo, porque no desbordar no es leerse bien.

**Qué se cambió:**

- **Revisión.** La tira de completitud va debajo del título y en 2×2; era la de los 688 px. La barra
  de envío pliega: la barra de progreso con su contador en una fila y los botones debajo, apilados
  y con «Enviar revisión» arriba (en borrador se salía 8 px de la columna; se comprobó forzando el
  estado borrador, porque la demo solo tiene la revisión enviada).
- **Membresía.** La tabla no desbordaba pero no se leía: las fechas se partían en tres renglones y
  la píldora en dos. En móvil cada fila es una ficha de dos líneas —tipo y estado; inicio y fin con
  su etiqueta—, con la misma tabla semántica y las cabeceras solo para lectores de pantalla. En
  escritorio sigue siendo tabla (comprobado a 1280).
- **Ver revisión.** Las fotos van siempre en tres columnas, también en móvil —las poses se
  comparan una junto a otra—, con un solo aviso debajo si alguna no se recuperó, en vez de uno por
  foto. Y en móvil el feedback sube justo después de las cifras: antes quedaba debajo de las fotos
  y las respuestas, a casi 3.000 px. Se hace disolviendo las columnas con `display: contents` y
  ordenando cada bloque; la columna lateral pasa de `aside` a `div` porque `contents` sobre un
  landmark pierde su semántica en algunos navegadores. La página baja de 2.949 a 1.713 px.
- **Progreso.** Los botones del selector de medidas medían 15 px de alto; ahora 32.
- **Rutina.** «Registrar» medía 29 px de alto; ahora 32.
- **Menú.** En móvil la flecha del desplegable caía sola en un tercer renglón; ahora va en la línea
  del título y «aporta…» debajo.
- **Nav del cliente.** En móvil el apartado activo podía quedar fuera de la vista (en Peso solo
  asomaba un filo rojo). Ahora se centra al cargar, al terminar de cargar las fuentes y cuando
  cambia el ancho del nav: la barra de scroll de un navegador estrecho aparece al cargar el
  contenido y lo descentraba 15 px.

- **Columna lateral en móvil** (decidido por el propietario el 21-09-2026, regla en `CLAUDE.md`):
  sube lo que es contexto para leer el contenido principal y baja lo que es resumen de lo leído,
  bloque a bloque. Aplicado así:
  - **Rutina:** la nota del entrenador sube, entre el título y los días; el resumen de series del
    día baja al final.
  - **Menú:** «Tu objetivo del día» y la nota del menú suben, entre el selector de tipo de día y la
    lista de menús: el objetivo es lo que da sentido a cada «aporta…». El selector va antes porque
    los dos dependen del tipo de día elegido.
  - **Ver revisión:** el feedback sube tras las cifras (ya estaba); «Revisiones anteriores» baja.
  - **Progreso y Membresía** ya cumplían: la lista de revisiones de Progreso es resumen y queda
    debajo; en Membresía la membresía en curso es contexto y ya iba primero.
  - **Peso y Revisión** no tienen columna lateral: son dos columnas de peso parecido y se quedan en
    su orden.

**Diagnosticado el 20-09-2026: `components/ui/tabs.tsx` no está roto.** El aviso de hidratación
—ids de Radix distintos en servidor y cliente— **solo aparece en el servidor de desarrollo cuando
compila la ruta por primera vez**. Qué se probó:

1. Una sonda temporal con el mismo `Tabs` dentro del armazón de cliente, a dos profundidades y con
   consultas alrededor: hidrata limpia. Luego no es el armazón, ni la profundidad, ni TanStack.
2. La pantalla de Menú con `Tabs` otra vez, en un servidor ya caliente: limpia, y el id del DOM es
   justo el que el servidor había mandado en el fallo anterior.
3. La misma pantalla con `.next` borrado, servidor recién arrancado y pestaña nueva: **reproduce**.
   Es decir, depende de que la ruta se compile en esa primera petición, no del componente.
4. `pnpm build` + `pnpm start` (entrada `prod` en `.claude/launch.json`, puerto 3100): consola
   limpia, el id del HTML servido es estable entre peticiones y coincide con el del DOM ya
   hidratado, y el selector funciona. **En producción no ocurre.**

Conclusión: era un artefacto de desarrollo, no un defecto que se despache. Menú vuelve a usar
`Tabs` y **la revisión del entrenador puede usarlo sin rodeos**. La prueba del `Dialog` del día 20
no demostraba lo que parecía: se hizo en caliente, donde tampoco falla `Tabs`.

**Regla que deja esto**, generalizada en `CLAUDE.md` («Verificar el entorno antes de concluir»):
antes de concluir nada, verifica que el entorno mide lo que crees; y «solo sale en dev» no quiere
decir «no importa», sino que hay que comprobarlo en producción antes de decidir, en los dos
sentidos.

Cómo medir: en un iframe de 390 px, no con la emulación de viewport del panel de vista previa,
que no siempre se aplica y da falsos positivos.
