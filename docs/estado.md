# Estado del arranque

Última actualización: 19-09-2026. Las cinco fases de la tarea de cimientos están hechas y en
`main`. Lee `CLAUDE.md` y `docs/dominio.md` antes de continuar.

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
  (`questionnaire.ts`); `derivedKcal` (`macros.ts`); `cloneRoutineTemplate`,
  `cloneMenuTemplate` (`templates.ts`); `routinesUsingExercise`, `removeExerciseFromRoutine`
  (`routine.ts`). `DomainError` con `code` para que la UI traduzca.
- Tests de I5, I9, I12, I15, I17 y I22 con casos límite, más esquemas y plantillas. 57 tests.
- ESLint prohíbe en `lib/domain/**` importar React, Next, globales del DOM y capas superiores.

### Fase 4 — Capa de datos (`lib/data/`)
- `ports/`: una interfaz por agregado, agrupadas en `DataPorts` (`ports/index.ts`). Todos los
  métodos reciben `trainerId` explícito.
- `adapters/mock/`: en memoria, 150 ms de latencia, filtrado por `trainerId`, copia en cada
  respuesta. Las invariantes se aplican con las funciones del dominio (I4, I9, I13, I15, I16,
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
- `components/entrenador/trainer-shell.tsx`: barra lateral de 232 px con Dashboard, Clientes,
  Biblioteca, Plantillas, Cuestionario, **Medidas**, Membresías, Asignación; logo con etiqueta
  «Coach» y bloque de usuario leído por `useTrainer()`.
- `components/cliente/client-shell.tsx`: nav superior con Rutina, Menú, Peso, Revisión,
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
    test de tenancy. Un backend con RLS podrá ignorarlo.
18. **Los métodos del adaptador son `async`** para que un `DomainError` sea siempre un rechazo,
    nunca una excepción síncrona.
19. Los menús de demo declaran las macros de la maqueta y las kcal se derivan: Menú A da 2.348
    kcal (la maqueta dice 2.410) y el de descanso 2.145 (2.100). Manda la fórmula 4/4/9.
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
    `/clientes/[clientId]` y el alta en `/clientes/nuevo`. `CLAUDE.md` está actualizado.
25. `/` redirige a `/login` mientras no haya auth. Para navegar: `/dashboard` (entrenador),
    `/rutina` (cliente).
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
- Sin cubrir por el dominio ni la demo: la pantalla «Medidas» (§11.1) y el envío de feedback
  (§11.2) tienen ruta y puerto, pero no diseño.
- `app/favicon.ico` sigue siendo el de create-next-app.

### Pantallas del cliente

- **Peso** (`components/cliente/weight/`, 18-09-2026): formulario (react-hook-form + zod, coma
  decimal admitida), tres cifras, gráfica de las últimas 6 semanas con `TrendChart` e historial
  descendente con «Día de revisión». Las definiciones viven en `lib/domain/weight.ts` y tienen
  test: **media 7 días** = media de los pesajes de los 7 días civiles que terminan en el último
  pesaje (inclusive), `null` con menos de 2 pesajes en la ventana; **desde inicio** = último
  pesaje − primer pesaje registrado, `null` con menos de 2 pesajes; **día de revisión** = la
  revisión referencia ese pesaje como su peso (I9), no "cae en la ventana" porque la ventana es
  la semana entera y marcaría todos; **gráfica** = último pesaje de cada semana del cliente, hueco
  si no hubo. Fechas en `DD-MM-YYYY` por convención (la demo enseña "29 ago"). El delta solo se
  pinta en verde cuando baja, como en la demo; para un cliente de hipertrofia eso es discutible.

- **Revisión** (`components/cliente/review/`, 19-09-2026): abre o recupera la revisión de la semana
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
  imágenes recuperables. Con backend, la foto sube a Storage antes de guardar la URL en
  `ReviewMedia`.

- **Progreso** (`components/cliente/progress/`, 19-09-2026): «Evolución de peso» con todas las
  semanas del cliente (`weeklyWeights`) y el delta sin color; «Medidas», primera gráfica
  multi-serie: `measurementSeries` en `lib/domain/progress.ts` da una serie por tipo de medida
  presente en las revisiones, dispersa y con `null` donde no hubo valor, en orden de catálogo;
  un tipo archivado conserva su histórico y se marca «archivado» en el selector, y no entra en
  revisiones nuevas porque `openReview` solo congela tipos activos. Selector de tipos como en la
  demo; por defecto se muestran los tres primeros del catálogo (la demo enseña cintura, cadera y
  muslo, que son los que más varían: elegirlos automáticamente sería un juicio). Histórico
  agrupado de dos en dos semanas (`groupReviewsByWeekPair`, §8); un borrador enlaza a Revisión con
  «n/4», el resto a `/ver-revision?review=id` con «Completa ✓» o «Parcial». Las líneas van con
  segmentos rectos: la demo no suaviza y una curva inventa valores entre semanas.

- **Rutina** (`components/cliente/routine/`, 19-09-2026): pestañas por día numérico, tarjeta por
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
    edita lo de hoy. La vez anterior del mismo día de rutina se enseña de solo lectura bajo cada
    serie, «última vez: 80 kg × 6», con la fecha completa en el `title`
    (`latestDayRecord(day, logs, { before: hoy })`, con test).
  - **Contador** = «X de Y series registradas hoy». Aquí «hoy» es correcto: son registros fechados
    hoy, no una suposición sobre qué día de rutina toca. La tarjeta añade «Última vez: DD-MM-YYYY».
  - **Editar registros de otra fecha es deuda anotada**, no implementada: hoy solo se corrige lo
    del día en curso. Si hace falta, pide pantalla propia (elegir fecha) o edición desde Progreso.
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
  siempre se aplica: `/rutina`, `/peso`, `/progreso`, `/menu` y `/membresia` miden ya 390.
  **`/revision` sigue midiendo 688** por contenido suyo (la tira de completitud), no por el nav:
  es trabajo de la pasada responsive, que es una fase aparte y no se ha abierto.

- **Menú** (`components/cliente/menu/`, 20-09-2026): selector de tipo de día, un menú por tarjeta
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
  - Las barras del objetivo son la **parte de las kcal** que aporta cada macro (4/4/9), con el
    porcentaje en el `title`. La maqueta las pinta casi llenas sin decir qué miden.
  - Las kcal se formatean con `formatInteger` (`lib/format.ts`): `es-ES` no agrupa los millares de
    cuatro cifras y la demo escribe «2.400», así que va con `useGrouping: "always"`.
  - El selector usa el `Tabs` de Radix, controlado. Durante un rato llevó botones propios por un
    aviso de hidratación que resultó ser **solo del servidor de desarrollo en frío**: ver el
    diagnóstico en el hito responsive (20-09-2026).
  - `TrainerNoteCard` pasa a `components/cliente/` y su literal a `es.common.trainerNote`: lo usan
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

- **Membresía** (`components/cliente/membership/`, 20-09-2026): la membresía en curso con su
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

- **Ver revisión** (`components/cliente/view-review/`, 20-09-2026): solo lectura de una revisión
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

- **Biblioteca de ejercicios** (`components/entrenador/library/`, tarjeta 7, integrada el
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
    `ClientInput` incluye `status` pero el adaptador **no** lo fuerza, así que hoy es honesto;
    anotado en la tarjeta del alta de cliente.

- **Cuestionario y Medidas** (`components/entrenador/catalog/`, tarjeta 12, integrada el
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
  - **La tercera salida —que `components/entrenador/` importe de `components/cliente/`— queda
    descartada por escrito** en «Estructura» de `CLAUDE.md`. Es peor que mover: convierte un área
    en dependencia de la otra y ata su diseño, y el día que la UI de cliente se reescriba para
    móvil se lleva por delante el panel. Sin el porqué escrito, parece la opción barata.

## Siguiente

Las siete pantallas del cliente y el hito responsive están terminados. Desde el 21-09-2026
trabajan dos personas (sección «Equipo» de `CLAUDE.md`): el panel del entrenador se reparte por
pantallas completas en el tablero de Trello, y este archivo pasa a ser un resumen curado que solo
edita quien integra. Por último, la decisión de backend con su adaptador.

### Anotado para el panel del entrenador

- **Marcar las membresías solapadas en la tabla de Membresías** (20-09-2026). El dominio no
  prohíbe que dos periodos de un cliente se solapen y no se va a llevar allí. La pantalla del
  cliente lo resuelve en silencio: `membershipStanding` enseña la que empezó más tarde. Eso
  significa que, si el entrenador se equivoca de fechas, **el cliente ve una membresía y el
  entrenador cree que aplica otra**. La tabla del entrenador tiene que marcar el solape donde se
  crea, que es donde se puede corregir.

### Hito: pasada responsive del área de cliente — hecho (21-09-2026)

**Una sola pasada sobre todas las pantallas del cliente, cuando estén las cuatro que faltan y
antes de empezar el panel del entrenador** (decidido el 20-09-2026). No se hace pantalla a
pantalla: mientras tanto, a cada pantalla nueva solo se le exige que no desborde el viewport.

El porqué: el área de cliente es la que se usa en el móvil —el cliente mira su rutina en el
gimnasio— y el panel del entrenador es de escritorio por naturaleza, con tablas densas, barra
lateral y comparador de fotos a dos columnas.

Entra en esta pasada: los 688 px de `/revision` a 390 px (la tira de completitud), y lo que
salga de revisar las demás. Ya hecho aparte, porque desbordaba todo el área: el nav de
`client-shell.tsx`.

**Cómo se midió.** En un iframe de 390 px (dentro de él la página dispone de 375: la barra de
scroll vertical del iframe ocupa 15 px, cosa que en un móvil no pasa, así que la prueba es más
estricta que el teléfono). Antes de fiarse del instrumento se comprobó que detectaba el fallo
conocido de `/revision` (688 px, y señalaba la tira). Tres comprobaciones por pantalla: que nada
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
