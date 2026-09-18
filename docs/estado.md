# Estado del arranque

Última actualización: 18-09-2026. Las cinco fases de la tarea de cimientos están hechas y en
`main`. Lee `CLAUDE.md` y `docs/dominio.md` antes de continuar.

## Cómo se trabajó hasta aquí

Las fases 1–2 se hicieron desde Cowork en un VM Linux; las fases 3–5 desde el escritorio en
Windows. Consecuencias:

- Ejecuta `pnpm install` antes de nada (Node 22, pnpm 11+). Git convierte a CRLF al tocar
  archivos; `core.fileMode = false` en `.git/config` y no lo quites en Windows.
- Para más componentes shadcn: `pnpm dlx shadcn@latest add <componente>` y retematizar a mano
  (`bg-primary`, `text-muted-foreground`, `dark:*`, sombras → tokens de `app/globals.css`).
- `.claude/launch.json` arranca `pnpm dev` en el puerto 3000 desde el navegador integrado.

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
  13 pesajes de agosto, 5 revisiones de Marta y las enviadas de Jorge y Sara. Un test valida
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
6. Botones `outline`/`ghost` en Oswald; en la demo los secundarios son Inter 12–13px. Pendiente.

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
21. Fechas de alta ajustadas para que el 29-08-2026 Marta esté en S5, Jorge en S8, Sara en S3 y
    David en S11, como muestra el panel.
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
  partir de `Demo Navegable.dc.html`, que depende de un `support.js` ausente. Usa las capturas
  de `docs/design/screens/`.
- La demo tiene **18** pantallas, no 16: además están «Detalle cliente», «Alta de cliente» y
  «Ver revisión».
- Fuera del MVP según `dominio.md` pero presente en la demo: «Bloque 2 · Semana 5 de 12»,
  columna «Bloque», «Adherencia %», «2FA» en el login. Se omiten al maquetar.
- La pantalla de revisión del cliente dice «La revisión solo se envía completa»; I5 dice que la
  completitud avisa y no bloquea. Manda el dominio.
- La maqueta dice "viernes, 29 agosto" pero el 29-08-2026 es sábado. Se mantiene la fecha; el
  día de la semana se calculará.
- La demo muestra en el Día 1 del cliente ejercicios de pierna y en el editor Día 1 = Torso.
- El "Eliminar" de la biblioteca y las macros por menú ya están resueltos (decisión 15).
- Sin cubrir por el dominio ni la demo: la pantalla «Medidas» (§11.1) y el envío de feedback
  (§11.2) tienen ruta y puerto, pero no diseño.
- `app/favicon.ico` sigue siendo el de create-next-app.

## Siguiente

Pantallas del cliente (rutina, menú, peso, revisión, progreso, membresía, ver revisión) sobre
los hooks existentes, una por sección y con aprobación entre secciones. Después el panel del
entrenador, y por último la decisión de backend con su adaptador.
