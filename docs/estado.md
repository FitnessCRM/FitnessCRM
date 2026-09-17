# Estado del arranque

Última actualización: 17-09-2026. Fases 1 y 2 de la tarea de cimientos hechas y commiteadas en
`main` (`4d6853c`, `62050c1`). Fases 3, 4 y 5 pendientes: su especificación está al final de este
archivo. Lee `CLAUDE.md` y `docs/dominio.md` antes de continuar.

## Cómo se trabajó hasta aquí (y qué cambia ahora)

Las fases 1–2 se hicieron desde Cowork en un VM Linux y se sincronizó a esta carpeta solo el
código fuente y `.git`. Consecuencias:

- **No hay `node_modules`.** Ejecuta `pnpm install` antes de nada (Node 22, pnpm 12).
- El repo tiene `core.fileMode = false` en `.git/config`; no lo quites en Windows.
- Se pide `pnpm dlx shadcn@latest add <componente>` para traer más componentes: `components.json`
  está listo. Los 13 actuales se retematizaron a mano (ver abajo) — al añadir uno nuevo hay que
  hacer lo mismo: sustituir `bg-primary`, `text-muted-foreground`, `dark:*`, sombras, etc. por
  nuestros tokens.

## Hecho

### Fase 1 — Esqueleto
- Next.js **15.5** (App Router, React 19.1), TypeScript `strict` + `noUncheckedIndexedAccess`,
  alias `@/*`, Tailwind v4, ESLint (+ `eslint-config-prettier`), Prettier
  (+ `prettier-plugin-tailwindcss`), husky + lint-staged, pnpm 12, `.nvmrc` 22.
- Scripts: `dev`, `build`, `start`, `test` (vitest run), `lint`, `typecheck`, `format`.
- Vitest: `lib/**/*.test.ts`, entorno Node, sin jsdom. Alias `@` en `vitest.config.ts`.
- PWA con Serwist 9: `app/sw.ts`, `next.config.ts` (`withSerwist`, desactivado en dev),
  `app/manifest.ts` (nombre desde `APP_NAME`), iconos placeholder en `public/icons/`.
  `public/sw.js` está en `.gitignore`.
- `lib/i18n/es.ts` con `APP_NAME` y el objeto `es` (por ahora solo `dev.kitchenSink`).
- Árbol de carpetas de `CLAUDE.md` con `.gitkeep`, incluida `app/(entrenador)/medidas`.
- Prettier ignora `CLAUDE.md` y `docs/**`.

### Fase 2 — Sistema de diseño
- `app/globals.css`: `@theme` con tokens semánticos. **La paleta por defecto de Tailwind está
  desactivada** (`--color-*: initial`): `bg-red-500` no compila. Tokens:
  `background`, `background-deep`, `surface`, `surface-raised`, `surface-overlay`, `border`,
  `border-strong`, `border-subtle`, `border-emphasis`, `overlay`, `text-primary`, `text-muted`,
  `text-subtle`, `text-disabled`, `accent`, `accent-hover`, `accent-bright`, `accent-emphasis`,
  `accent-soft`, `accent-outline`, `accent-strong`, `on-accent`, `success`, `success-soft`,
  `danger`, `danger-soft`, `ring`.
- Tipografía: `font-display` (Oswald) y `font-ui` (Inter Tight) vía `next/font/google`,
  variables `--font-display` / `--font-ui`. Escala: `text-xs` 11, `sm` 13, `base` 15, `lg` 17,
  `display-sm/md/lg/xl` 20/26/40/44, `hero` 76. `tracking-label` 1.5px, `tracking-wide` 2px.
  Radios 4/6/8/10/99. Utilidades `eyebrow`, `section-title`, `page-title`.
- `lib/design/tokens.ts`: espejo TS de los valores necesarios fuera de CSS (manifest, viewport,
  gráficas). La fuente de verdad es el CSS.
- `components/ui/`: button, input, select, label, tabs, table, dialog, badge, card,
  dropdown-menu, textarea, switch, tooltip (shadcn new-york-v4, retematizados).
  Extras: `Button` variante `pill`; `Badge` variantes `success`/`destructive`/`outline`;
  `TabsList` variantes `underline` (defecto) y `segmented`.
- `/kitchen-sink` solo en desarrollo (`notFound()` en producción).

## Decisiones tomadas que no estaban en las instrucciones

1. **Next 15, no 16.** `create-next-app@latest` da 16.3; se fijó 15 por la tabla de `CLAUDE.md`.
2. `@types/node` `^22`; `pnpm-workspace.yaml` con `allowBuilds: unrs-resolver: false`.
3. Paleta de Tailwind desactivada para que la regla "ningún color a pelo" la aplique el compilador.
4. Token `background-deep` (#0C0B0A) añadido: la demo lo usa para sidebar y nav superior y
   `CLAUDE.md` no lo lista. `#100F0D` (marco de la maqueta) se ignoró.
5. Inputs con borde `border-emphasis` (0.12); la demo usa 0.10, `CLAUDE.md` da 0.08 / 0.12.
6. `text-sm` = 13px y `text-base` = 15px en todo el sistema (shadcn heredaba 14/16).
7. Botones `outline`/`ghost` en Oswald como el resto; en la demo los secundarios (Editar,
   Eliminar, Cancelar) son Inter 12–13px. Pendiente de decidir si `outline` pasa a Inter.
8. Los rótulos del kitchen sink están en `es.dev.kitchenSink`; el contenido de ejemplo es dato.
9. Convención de commits y ramas ampliada en `CLAUDE.md` (Conventional Commits, scopes,
   `feature/…` `fix/…`, squash a `main`).

## Dudas / contradicciones detectadas

- `CLAUDE.md` y `dominio.md` referencian `docs/design/demo-navegable.html`, pero el archivo
  original es `docs/design/Demo Navegable.dc.html`, en formato Claude Design, y depende de un
  `./support.js` que no está en el repo: **no es navegable por sí solo**. Se generó
  `docs/design/demo-navegable.html` (versión estática: las 18 pantallas apiladas, sin JS, con
  todos los `<sc-if>` resueltos) y capturas de cada pantalla en `docs/design/screens/`. Para
  mirar el diseño, usa las capturas o el HTML estático; el `.dc.html` es la fuente.
- La demo tiene **18** pantallas etiquetadas, no 16: además de las de las barras de navegación
  están «Detalle cliente», «Alta de cliente» y «Ver revisión».
- La demo muestra cosas fuera del MVP según `dominio.md` §1/§10: «Bloque 2 · Semana 5 de 12»,
  «12 semanas de bloque», columna «Bloque» y «Adherencia %» en el dashboard, «2FA» en la etiqueta
  del login. Al maquetar, se omiten (dominio manda en alcance; diseño manda en layout).
- La pantalla de revisión del cliente dice «La revisión solo se envía completa», pero `dominio.md`
  §1.8 / I5 dice que la completitud avisa y no bloquea. Manda el dominio.
- La barra lateral de la demo no tiene «Medidas» (hueco §11.1). `CLAUDE.md` sí lo incluye; se
  añade en la fase 5 entre «Cuestionario» y «Membresías».
- `app/favicon.ico` es el de create-next-app; sustituir por el logo cuando toque.

## Pendiente — especificación de las fases 3, 4 y 5

Regla general: una fase, parar, enseñar, esperar aprobación. No encadenar. Cero SDKs de backend
(`firebase`, `@supabase/*`, Prisma, Drizzle, clientes de BD): si parece necesario, preguntar.

### Fase 3 — Dominio
En `lib/domain/`, puro TypeScript y zod. Cero imports de React, Next, DOM o red.

Tipos y esquemas para: `Trainer`, `Client`, `Membership`, `Exercise`, `Routine`, `RoutineDay`,
`RoutineDayExercise`, `WorkoutLog`, `MacroTargets`, `Menu`, `Meal`, `FoodItem`, `WeightLog`,
`Review`, `ReviewMedia`, `MeasurementType`, `BodyMeasurement`, `QuestionnaireQuestion`,
`QuestionnaireResponse`, `RoutineTemplate`, `MenuTemplate`.

Detalles que se suelen equivocar:
- `RoutineDayExercise`: `sets` entero, `repsMin` entero, `repsMax` entero o nulo (nulo = reps
  fijas), y `rir`, `rest` y `note` como texto libre ("1-2", "el que necesites").
- `MacroTargets`: proteína, carbos y grasa en gramos. Las kcal se derivan (4/4/9) con una
  función, no se almacenan.
- `Review`: `weekNumber` congelado, estado `borrador | enviada | vista | revisada`,
  `feedbackVideoUrl` y `feedbackNote`. La completitud no es un estado.
- `ReviewMedia`: pose `frente | perfil | espalda`, lista cerrada.
- `QuestionnaireResponse` y `BodyMeasurement`: además del valor y la FK al catálogo, copia
  congelada del enunciado o etiqueta, el formato y la unidad o los límites de escala.

Funciones de dominio con tests en Vitest:
- `weekNumber(startDate, date, timeZone)` — fórmula de `docs/dominio.md` §8.
- `isReviewComplete(review, requirements)` — I5, devolviendo qué falta, no solo un booleano.
- `canClientEditReview(review)` — I17.
- `canChangeQuestionFormat(question, hasResponses)` — I15.
- `weightForReview(weightLogs, window)` — I9.
- `derivedKcal(macros)`.

Tests cubren I5, I9, I12, I15, I17 y I22, con casos límite: catálogo modificado después de una
respuesta, semana saltada, revisión enviada incompleta, peso fuera de ventana.

### Fase 4 — Capa de datos
- `lib/data/ports/`: una interfaz por agregado, en términos del dominio, sin rastro de
  tecnología (nada de `query`, `collection`, `snapshot`, `row`).
- `lib/data/adapters/mock/`: implementación en memoria con latencia simulada de 150 ms.
- Datos de demo sacados de la demo navegable: Adrián Vega como entrenador; Marta Ruiz, Jorge
  Lema, Sara Peña, David Cano, Lucía Torres como clientes; ejercicios, plantillas, menús y
  membresías del HTML. Cinco semanas de pesajes y revisiones de Marta con valores coherentes
  (S1 65,5 · S2 64,8 · S3 64,3 · S4 63,9 · S5 63,4 kg; cintura 74,0 → 71,0; cadera 98,0 → 96,5;
  muslo +0,8). Pesajes diarios de agosto en la pantalla «Revisión de cliente».
- `lib/data/hooks/`: TanStack Query sobre los puertos, `QueryClientProvider` montado.
- Criterio: un componente de prueba lista clientes con estado de carga y error, y en su código
  no aparece la palabra "mock".

### Fase 5 — Armazón de navegación
- Rutas de `CLAUDE.md`, vacías: cada una renderiza su título y nada más.
- Dos layouts completos: barra lateral del entrenador (Dashboard, Clientes, Biblioteca,
  Plantillas, Cuestionario, Medidas, Membresías, Asignación) y nav superior del cliente
  (Rutina, Menú, Peso, Revisión, Progreso, Membresía), con logo `APP_NAME` y bloque de usuario
  como en la demo (`docs/design/screens/09-*.png` y `02-*.png`).
- `lib/i18n/es.ts` con los literales de navegación y estados. Ni un string suelto.
- Criterio: navegar por las dos áreas y que la estructura se sienta la de la demo.

Al terminar: actualizar este archivo (qué se montó, decisiones no previstas, qué resultó confuso
o contradictorio entre diseño y dominio) y la sección «Estado» de `CLAUDE.md`.
