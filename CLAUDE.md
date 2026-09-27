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
4. **El diseño son las capturas de `docs/design/screens/`.** Son las 18 pantallas del prototipo
   aprobado; míralas antes de maquetar. `docs/design/demo-navegable.html` es un volcado estático
   de la misma demo (sin navegación), útil para inspeccionar medidas y textos, no para navegar.
   No inventes pantallas ni te desvíes del layout sin decirlo.
5. **Las reglas de negocio son `docs/dominio.md`.** Si una petición choca con una invariante de
   su §6, dilo antes de programar. Si aparece un hueco que ese documento no cubre, pregunta —
   no asumas. **El maestro es el repo**: `docs/` manda, y el proyecto Hector de claude.ai es un
   espejo que se actualiza cuando una decisión se cierra. Un cambio de dominio no se edita desde
   una rama de feature (ver «Equipo»).
6. **Trabaja por secciones.** Una sección —una tarjeta del tablero—, luego aprobación explícita de
   quien corresponda (ver «Equipo»), luego la siguiente. No encadenes módulos enteros sin parar.

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
  design/screens/     las 18 capturas del prototipo: la referencia visual
  design/demo-navegable.html   volcado estático de la demo
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
curso, día y mes abreviado como en la demo («29 ago»); fuera del año en curso, `DD-MM-YYYY`, que
es lo que hace `formatShortDate`. El elemento lleva `dateTime` con la fecha ISO para máquinas.
Formateadores en `lib/format.ts`. En el dominio, fechas civiles `YYYY-MM-DD` para
revisiones y pesajes, y timestamps UTC ISO para lo técnico. La zona horaria es configuración del
entrenador, nunca una constante en el código.

**Táctil frente a escritorio.** En el **área de cliente**, que se usa en el móvil, ningún dato que
el cliente necesite puede vivir solo en un `title`: en táctil no hay hover y ese texto no existe.
Se pinta visible o se alcanza con un toque. En el **panel del entrenador**, que es de escritorio
por naturaleza, el `title` sí vale como complemento —nunca como único sitio donde está el dato—.

**Columna lateral en móvil.** Cuando en móvil las dos columnas pasan a una, lo que estaba en la
lateral **sube por encima del contenido principal cuando es contexto para leerlo, y baja cuando es
un resumen de lo que ya has leído**. Cada bloque de la lateral se clasifica por separado, no la
columna entera: en Rutina la nota del entrenador sube y el resumen de series baja. Se hace
disolviendo las columnas con `max-lg:contents` y dando `order` a cada bloque, sin duplicar
componentes; el contenedor lateral es un `div`, no un `aside`, porque `contents` sobre un landmark
pierde su semántica en algunos navegadores.

**Unidades.** El peso corporal siempre en kg (I18). Cada tipo de medida declara su unidad y el
valor se guarda en ella, sin conversiones silenciosas. Las kcal se derivan de los macros (4/4/9)
y no se almacenan.

**Validación.** Un esquema zod por concepto en `lib/domain/schemas`, y es la única fuente de
verdad. El formulario valida contra él y el futuro backend también.

**Tests.** Vitest sobre el dominio. Antes de darse por terminadas, I5, I9, I12, I15, I17 y I22
tienen test. Los componentes no se testean todavía.

**Verificar el entorno antes de concluir.** Antes de dar por buena una comprobación, confirma que
el entorno mide lo que crees. Ya ha mentido tres veces: la emulación de viewport del panel que no
siempre se aplicaba (se mide en un iframe del ancho exacto), un diálogo comprobado cerrado que
nunca llegaba al HTML del servidor (se fuerza abierto para que hidrate), y un aviso de hidratación
que solo daba la primera compilación de `pnpm dev`. Si una medición depende del entorno, compruébala
contra un caso conocido —que detecte el fallo que sabes que existe— y repítela en el entorno que
cuenta. Y **«solo sale en dev» no significa «no importa»**: significa que hay que comprobarlo en
producción (`pnpm build` + `pnpm start`, entrada `prod` de `.claude/launch.json`) antes de decidir,
en los dos sentidos —ni se descarta sin mirar, ni se arregla lo que en producción no pasa—.

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
  que se actualice el espejo de claude.ai.

Ramas: `main` siempre en verde (`build`, `lint`, `typecheck`, `test`). Rama por módulo o
sección, desde `main`, kebab-case y en inglés: `feature/<module>-<what>`, `fix/<what>`,
`refactor/<what>`, `chore/<what>`, `docs/<what>` (`feature/client-routine-screen`,
`fix/week-number-timezone`). **La fusión ocurre en GitHub**, con *Squash and merge*: el título del
PR sigue el formato de commit de arriba y su descripción explica el porqué. Nadie fusiona en local
ni empuja a `main`. Con el tablero, la rama de una tarjeta es `feature/<id-tarjeta>-<slug>`
(ver «Equipo»).

**No subir nada al remoto.** Claude Code hace commits en ramas locales y nada más: ni `git push`,
ni crear PR, ni fusionar, ni tocar la configuración del repo en GitHub. Subir y fusionar lo
hacemos nosotros. Lo que hace Claude Code es dejar la rama lista —verde en `lint`, `typecheck`,
`test` y `build`, con la tarjeta en «En revisión» y su comentario— y decirlo. «Lista» no es
permiso para empujarla.

**`main` solo se toca por PR.** Nadie empuja a `main`, ni personas ni agentes: se sube la rama, se
abre el PR y la fusión ocurre en GitHub con *Squash and merge*. Si alguien necesita `--no-verify`
para empujar `main`, es señal de que se está saltando el flujo, no de que el hook estorbe.

Hoy la única barrera es el hook `pre-push` de husky (`.husky/pre-push`, se instala con
`pnpm install`), que se salta con `--no-verify`: la regla vale por acuerdo. La protección de rama
en GitHub, que no se salta, está pendiente de activar — hasta entonces, el acuerdo es lo único que
hay.

Pre-commit (husky + lint-staged) pasa ESLint y Prettier sobre lo staged; lo que no pasa no
entra. Nunca se commitea `node_modules`, `.next`, `public/sw.js` ni `.env*`.

---

## Equipo

Dos desarrolladores, cada uno con su Claude Code sobre el mismo repo
(`github.com/danimoreno73/FitnessCRM`).

**Reparto: por pantallas completas.** Cada uno coge pantallas enteras del panel del entrenador,
nunca capas de la misma pantalla. Dividir por «uno el dominio, otro la UI» bloquea al segundo
constantemente, porque cada pantalla necesita dominio nuevo.

**Los componentes compartidos los toca quien llegue primero.** Todo lo que vive en
`components/ui/`, `lib/domain/`, `lib/data/ports/` y `lib/i18n/es.ts` es terreno común. Antes de
modificar algo de ahí que ya exista, mira si la otra rama lo está tocando: si la tarjeta del otro
está en curso y cae sobre el mismo archivo, dilo en la tarjeta antes de editarlo. Añadir cosas
nuevas no necesita aviso; cambiar la firma de algo que ya usa otra pantalla, sí.

**Aprobación.** Cada uno aprueba las pantallas de su propio reparto antes de integrar. Lo que
toca el dominio, los puertos o los componentes compartidos lo aprueban los dos, porque afecta al
trabajo del otro. «Espera mi aprobación» significa esperar la de quien corresponda según esto.

**Ramas y commits.** Una rama por tarjeta, nombrada `feature/<id-tarjeta>-<slug>`. El
identificador de la tarjeta va en el título del PR (`Refs: card <id>` en el cuerpo). Se fusiona
con *Squash and merge* en GitHub, nunca en local.

**Después de cada fusión: sincronizar y borrar.** En cuanto un PR se fusiona, `git fetch origin` y
`git reset --hard origin/main` en el `main` local, y borrar la rama fusionada (local y remota). El
squash crea en el remoto **un commit nuevo, con un SHA que no existe en local**, así que los dos
`main` divergen aunque el contenido sea el mismo. El síntoma, que no parece un problema de git:
ramificar o rebasar desde el `main` viejo arrastra los commits originales de la rama ya fusionada,
y el PR siguiente aparece con cambios que no son suyos y con conflictos contra código idéntico.

### El tablero

Trello. Cada tarjeta es una unidad de trabajo aprobable: una pantalla, un hito, una decisión.

Listas: **Backlog** · **Listo para empezar** · **En curso** · **En revisión** · **Hecho**

Reglas que Claude Code debe cumplir:

1. **Antes de escribir una línea de código, comprueba que la tarjeta existe, está asignada a
   quien va a trabajar y está en «En curso».** Si no está, muévela tú y dilo. Si no existe
   tarjeta, para y pregunta: trabajo sin tarjeta es trabajo que el otro no ve venir.
2. **Una tarjeta en curso por persona.** Si vas a empezar otra, la anterior se cierra o vuelve a
   «Listo para empezar» con una nota de dónde se quedó.
3. **Al terminar, la tarjeta pasa a «En revisión»**, con un comentario que diga: qué se hizo, qué
   decisiones se tomaron que no estaban en las instrucciones, y qué quedó anotado como deuda. Ese
   comentario es lo que lee el otro; no lo resumas de más.
4. **A «Hecho» solo se llega cuando están fusionados los dos PR: el de código y el de
   documentación.** La mueve quien fusiona, no quien desarrolla. Mientras el de documentación no
   esté dentro, la tarjeta sigue en «En revisión»: si no, ese PR queda siempre para luego y
   `estado.md` se atrasa solo.
5. **Si al trabajar aparece algo que no es de esta tarjeta** —una deuda, un fallo de otra
   pantalla, una contradicción en los documentos— crea una tarjeta en Backlog y sigue con lo
   tuyo. No lo arregles de paso: un arreglo fuera de alcance en una rama ajena es lo que rompe
   el reparto.

### `docs/estado.md` y `docs/dominio.md` con dos personas

Con dos ramas paralelas, `estado.md` sería un imán de conflictos: dos agentes escribiendo el mismo
párrafo en cada merge. Se parte en dos:

- **Lo de cada feature va al comentario de la tarjeta y a la descripción del PR**, no a
  `estado.md`. Ahí vive el detalle de lo que se hizo y por qué.
- **`estado.md` queda como resumen curado** y **nunca viaja en la rama de una pantalla**: si lo
  hiciera, dos ramas paralelas pelearían por el mismo párrafo en cada fusión. Como la fusión
  ocurre en GitHub y ya no hay commit de integración donde meterlo, se escribe **después**: en
  cuanto el PR está fusionado, quien llevaba la tarjeta saca `docs/<algo>-estado` desde `main`
  recién actualizado, escribe el resumen y abre un PR aparte que se fusiona enseguida. La ventana
  de conflicto son minutos. Lo mismo vale para la sección «Estado» de este archivo.
- **Mientras tanto el detalle vive en la tarjeta**, que es de donde se copia. Escribir en
  `estado.md` algo que todavía no está en `main` no vale ni pidiéndolo quien integra: si hace
  falta dejarlo escrito, va a «Anotado para el panel del entrenador» y marcado como pendiente.

Lo mismo para `docs/dominio.md`: si una decisión de desarrollo cambia el dominio, no lo edites en
tu rama. Anótalo en la tarjeta, ciérralo con los dos, y que entre en `main` en su propio PR, con
`Domain:` en el cuerpo del commit.

### Lo que no cambia

Estas cuatro siguen siendo innegociables: sin SDK de backend hasta que se decida, `lib/domain/`
puro, los datos solo por los hooks, y ni un literal suelto fuera de `lib/i18n/es.ts`. Y el
criterio de terminado tampoco cambia: compila, pasan `lint`, `typecheck` y `test`, los tres
estados implementados, y comparada en el navegador contra su captura.

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
devuelve una sesión de demo (Adrián como entrenador, Marta como cliente). Los datos de demo se
generan relativos a la fecha de hoy (Marta siempre en su semana 5), no con fechas fijas.
Detalle, decisiones y dudas en `docs/estado.md`.

Las dos decisiones del 18-09-2026 —macros declaradas por menú y borrado de ejercicios por
archivado— están en `docs/dominio.md` (§5 y §7). Desde el 21-09-2026 el maestro es el repo y el
proyecto de claude.ai es su espejo.

Pantallas del cliente terminadas (20-09-2026), las siete: Peso, Revisión, Progreso, Rutina,
Menú, Membresía y Ver revisión, y pasada responsive del área de cliente hecha (21-09-2026, detalle
en `docs/estado.md`). Coordinación de equipo montada (21-09-2026, sección «Equipo»): lo siguiente
es el panel del entrenador, repartido por pantallas, y por último la decisión de backend con su
adaptador. Esta sección la actualiza quien integra.
