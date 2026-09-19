# FitnessCRM

Repositorio `FitnessCRM`, paquete `fitness-crm`. **La app se llama HECTOR**: ese es el nombre que
ve el usuario y el único que aparece en pantalla. Son cosas distintas a propósito — la marca puede
cambiar y el repo no.

App de seguimiento para un entrenador personal y sus clientes: rutinas, macros y menús,
revisiones semanales de composición corporal, y membresías.

Dos roles. El **entrenador** gestiona su cartera: da de alta clientes, mantiene su biblioteca de
ejercicios, asigna planes, revisa lo que suben sus clientes y envía feedback. El **cliente**
consulta su plan, registra su peso cuando quiere y envía su revisión semanal.

Arquitectura multi-tenant desde el primer día, aunque en el lanzamiento solo opere un entrenador.

---

## Reglas duras

Estas seis se comprueban antes de dar por buena cualquier tarea.

1. **No hay backend elegido.** Firebase y Supabase están en debate. **No instales ni importes
   ningún SDK de backend, ni `firebase`, ni `@supabase/*`, ni un ORM, ni nada que hable con una
   base de datos.** Si una tarea parece exigirlo, para y pregunta.
2. **El dominio es puro.** Nada dentro de `lib/domain/` importa React, Next, el DOM ni la red.
   Es TypeScript y zod, y se ejecuta igual en Node, en el navegador y algún día en React Native.
3. **Los datos entran por el puerto.** Ningún componente llama a una fuente de datos
   directamente: todo pasa por los hooks de `lib/data/hooks/`, que hablan con las interfaces de
   `lib/data/ports/`. Hoy las implementa el adaptador en memoria. Cambiar de backend debe ser
   escribir un adaptador nuevo y no tocar ni un componente.
4. **El diseño es `docs/design/demo-navegable.html`.** Es una demo real y navegable con las 16
   pantallas. Ábrela y míralas antes de maquetar. No inventes pantallas ni te desvíes del layout
   sin decirlo.
5. **Las reglas de negocio son `docs/dominio.md`.** Si una petición choca con una invariante de
   su §6, dilo antes de programar. Si aparece un hueco que ese documento no cubre, pregunta —
   no asumas. Ese archivo es una **copia** del documento maestro que vive en el proyecto Hector
   de Claude: si una decisión lo cambia, avísalo para sincronizar el original.
6. **Trabaja por secciones.** Una sección, luego aprobación explícita, luego la siguiente. No
   encadenes módulos enteros sin parar.

---

## Stack

| | |
|---|---|
| Framework | Next.js 15, App Router, React 19 |
| Lenguaje | TypeScript en modo `strict` |
| Estilos | Tailwind CSS v4 |
| Componentes | shadcn/ui, copiados al repo y retematizados con los tokens de abajo |
| Formularios | react-hook-form + zod |
| Datos en cliente | TanStack Query sobre los puertos |
| Gráficas | Recharts |
| Fechas | date-fns + @date-fns/tz |
| PWA | Serwist |
| Tests | Vitest |
| Gestor de paquetes | pnpm. Node 22 |

**Sin fetching en Server Components de momento.** Es deliberado: Supabase encaja con RSC y
Firebase es SDK de cliente; elegir RSC ahora ataría la decisión de facto. Los Server Components
montan el armazón, los datos llegan por hooks. Se puede migrar después si gana Supabase.

**Camino a móvil.** Se mantiene Next.js. El día que haya Expo se reutilizan `lib/domain`,
`lib/data` y `lib/i18n` íntegros; los componentes se reescriben, que es lo que va a pasar de
todas formas porque el diseño móvil será otro. Por eso la regla 2 no es negociable.

---

## Estructura

```
app/
  (auth)/login/
  (cliente)/          rutina, menu, peso, revision, progreso, membresia, ver-revision
  (entrenador)/       dashboard, clientes, clientes/nuevo, clientes/[clientId],
                      clientes/[clientId]/editor, clientes/[clientId]/revision,
                      biblioteca, plantillas, cuestionario, medidas, membresias, asignacion
  providers.tsx       raíz de composición: el único archivo que elige un adaptador
components/
  ui/                 shadcn, retematizado
  cliente/ entrenador/ charts/
lib/
  domain/             tipos, esquemas zod, invariantes. CERO dependencias externas
  data/
    ports/            interfaces de repositorio
    adapters/mock/    implementación en memoria con datos de demo
    hooks/            TanStack Query sobre los puertos
  design/             tokens
  i18n/es.ts          todos los literales visibles
docs/
  dominio.md
  design/demo-navegable.html
```

---

## Sistema de diseño

Extraído de la demo. Tema oscuro único, neutros cálidos y un acento rojo. Todos los valores van
a tokens de Tailwind: **ningún color a pelo en un componente**.

**Tipografía** — Oswald para display y etiquetas (mayúsculas, `letter-spacing` 1.5–2px) e Inter
Tight para interfaz y texto. Google Fonts, cargadas con `next/font`. Pesos 400, 600 y 700.

**Fondo y superficies** — `#121110` base · `#1A1815` superficie · `#211E1B` y `#26221E` elevada ·
`#2A2622`–`#2E2A25` bordes. Los separadores finos son `rgba(255,255,255,0.08)` y
`rgba(255,255,255,0.12)`.

**Texto** — `#F2EFE9` primario · `#98928A` secundario · `#6E6862` terciario · `#4A453F`
desactivado.

**Acento** — `oklch(0.68 0.21 30)`. Hover y énfasis en `0.72`, `0.74` y `0.78` de luminosidad.
Fondos y bordes tintados con alfa `0.14`, `0.35` y `0.5`. Texto sobre acento: `#16100D`.

**Estado** — pagada / éxito `oklch(0.72 0.13 155)` · no pagada / error `oklch(0.72 0.19 25)`.
Ambos con alfa `0.14` de fondo para las píldoras.

**Formas** — radio 6px por defecto, 8 y 10px en tarjetas, 99px en píldoras. Tamaños 11–17px en
interfaz, 20–44px en display, 76px en el hero del login.

---

## Convenciones

**Nombres.** El nombre visible de la app sale de una constante única, `APP_NAME` en
`lib/i18n/es.ts`. Nunca se escribe "HECTOR" a pelo en un componente, ni en el `<title>`, ni en el
manifest: renombrar la marca debe ser cambiar esa línea. El nombre del repo y del paquete no
aparecen en ninguna pantalla.

**Idioma.** La UI es española, el código es inglés. Nombres de archivos, tipos, funciones,
variables, ramas y commits en inglés. Todo literal visible sale de `lib/i18n/es.ts`; no hay
strings sueltos en los componentes.

**Fechas.** En pantalla, `DD-MM-YYYY` por defecto. En listas cronológicas densas del año en
curso, día y mes abreviado como en la demo («29 ago»); fuera del año en curso, `DD-MM-YYYY`.
El `title` del elemento lleva siempre la fecha completa. Formateadores en `lib/format.ts`. En el dominio, fechas civiles `YYYY-MM-DD` para
revisiones y pesajes, y timestamps UTC ISO para lo técnico. La zona horaria es configuración del
entrenador, nunca una constante en el código.

**Unidades.** El peso corporal siempre en kg (I18). Cada tipo de medida declara su unidad y el
valor se guarda en ella, sin conversiones silenciosas. Las kcal se derivan de los macros (4/4/9)
y no se almacenan.

**Validación.** Un esquema zod por concepto en `lib/domain/schemas`, y es la única fuente de
verdad. El formulario valida contra él y el futuro backend también.

**Tests.** Vitest sobre el dominio. Antes de darse por terminadas, I5, I9, I12, I15, I17 y I22
tienen test. Los componentes no se testean todavía.

**Commits y ramas.** Todo en inglés. Conventional Commits: `type(scope): subject`.

- `type`: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`, `build`, `ci`.
- `scope` (opcional, uno de): `domain`, `data`, `ui`, `cliente`, `entrenador`, `i18n`, `design`,
  `pwa`, `deps`, `docs`.
- `subject`: imperativo, minúscula inicial, sin punto final, ≤ 72 caracteres
  (`feat(domain): add review completeness check`).
- Cuerpo opcional que explica el *porqué*, no el qué. Pie con `BREAKING CHANGE:` si rompe un
  contrato (puerto, esquema zod) y `Refs:` si cierra un issue.
- Un commit = un cambio coherente. No mezclar refactor con feature.
- Si un commit cambia una regla de `docs/dominio.md`, lo dice en el cuerpo (`Domain: ...`) para
  que se sincronice el original.

Ramas: `main` siempre en verde (`build`, `lint`, `typecheck`, `test`). Rama por módulo o
sección, desde `main`, kebab-case y en inglés: `feature/<module>-<what>`, `fix/<what>`,
`refactor/<what>`, `chore/<what>`, `docs/<what>` (`feature/client-routine-screen`,
`fix/week-number-timezone`). Se integran con squash y el mensaje del squash sigue el formato de
arriba. No se hace push directo a `main`.

Pre-commit (husky + lint-staged) pasa ESLint y Prettier sobre lo staged; lo que no pasa no
entra. Nunca se commitea `node_modules`, `.next`, `public/sw.js` ni `.env*`.

---

## Vocabulario

Estos términos están prohibidos porque son ambiguos y ya causaron confusión: **dieta** (se
dividió en macros y menú), **periodo** (ya no existe), **bloque** (fuera del MVP), **sesión**
(día de rutina vs. entreno registrado) y **medida** a secas (tipo de catálogo vs. valor
registrado). La tabla completa de lenguaje ubicuo está en `docs/dominio.md` §3.

---

## Comandos

```
pnpm dev          # desarrollo
pnpm build        # producción
pnpm test         # Vitest
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
```

---

## Estado

Cimientos terminados (18-09-2026): esqueleto, sistema de diseño, dominio con tests, capa de
datos con adaptador en memoria y armazón de navegación con las dos áreas. Sin backend, sin auth
real y sin persistencia: `app/providers.tsx` monta el adaptador en memoria y `SessionPort`
devuelve una sesión de demo (Adrián como entrenador, Marta como cliente). Detalle, decisiones y
dudas en `docs/estado.md`.

Dos decisiones del 18-09-2026 cambian `docs/dominio.md` y hay que sincronizar el original: cada
menú lleva macros declaradas por el entrenador (informativas), y los ejercicios de la biblioteca
se borran retirándolos de las rutinas tras avisar.

Después, en este orden: pantallas del cliente, panel del entrenador, y por último la decisión de
backend con su adaptador. Mantén esta sección al día conforme avance.
