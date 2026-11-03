# Dominio — HECTOR

Cuarta pasada. Reconcilia el dominio cerrado en la tercera pasada con la demo navegable
aprobada (`docs/design/demo-navegable.html`, 18 pantallas). **Donde el diseño y la tercera
pasada discrepaban, manda el diseño**: es posterior y responde a peticiones explícitas.

Estado: dominio cerrado para el MVP. Backend decidido el 28-10-2026: **Supabase para datos, auth
y fotos de revisión** (§12 y §9), con Firebase en producción hasta que acabe la migración (Fase 9 de
`docs/plan-migracion-supabase.md`). El acceso es con correo y contraseña, con invitación por enlace
de correo (§12, 03-10-2026). Implementados: la autenticación, las reglas de seguridad y los
adaptadores de datos de Firebase y de Supabase, que cubren los 18 puertos; el catálogo común de
alimentos responde «no disponible» hasta que la app se conecte a su API (tarjeta 90, §12). La app
monta el adaptador en memoria salvo con `NEXT_PUBLIC_DATA_BACKEND=firebase` o `supabase`.

**Decisiones del 03-11-2026** (aprobadas por Dani y Miguel, tanda de noviembre, tarjeta 120): el
cliente paga su membresía al entrenador con Stripe (§10 y §12), tarifas por tipo de membresía (§4 y
§5), I21 reescrita, archivar un ejercicio versiona las rutinas activas (§7), `sourceTemplateId` y un
solo borrador por cliente y tipo de plan (§4, I32), email del cliente único (I31), consentimiento al
aceptar la invitación (I33) y borrado a petición sin anonimizar (§7, I14).

---

## 1. Qué cambió respecto a la tercera pasada

| # | Antes | Ahora |
|---|---|---|
| 1 | Auth con 2FA | Sin 2FA en el MVP. Post-MVP, y probablemente gratis si el backend es Firebase |
| 2 | Rutina en modo numérico **o** día de semana | Solo días numéricos. `ModoDeDia` eliminado |
| 3 | El entrenador fija la periodicidad y el sistema la impone: periodos de calendario, estado `vencida`, I6, I19 | El entrenador fija una **cadencia orientativa**; el cliente envía cuando toca o cuando quiere. Nada se vence. `Periodicidad` como VO impuesto, `Periodo` como agregado y el estado `vencida` desaparecen |
| 4 | — | El "bloque" de la maqueta queda **fuera del MVP**. Las semanas se cuentan desde el alta del cliente y no se reinician |
| 5 | Pagos fuera del dominio (§8 anterior) | Entra **Membresía**: registro del estado de pago. El cobro sigue fuera de la app |
| 6 | Vídeo fuera de alcance | Entra `feedbackVideoUrl` en la revisión: **enlace externo**, igual que el vídeo del ejercicio. No se aloja vídeo |
| 7 | Agregado `Diet` con los menús dentro | "Dieta" desaparece. `MacroTargets` y `Menu` son independientes y se asignan por separado |
| 8 | Revisión completa = ≥1 imagen + peso + medidas + cuestionario | Tres fotos con pose fija. La completitud **avisa pero no bloquea**: el cliente puede enviar incompleta tras aceptar el aviso |
| 9 | Catálogo de tipos de medida del entrenador, con UI | Igual, y **hace falta una pantalla** que la demo no tiene (§11) |
| 10 | Estados `pendiente/parcial/completa/vista/vencida` | `borrador → enviada → vista → revisada`. La completitud pasa a ser un atributo, no un estado |
| 11 | §11 abierto: qué se prescribe por ejercicio | Resuelto: series, reps (rango **o** fijas), RIR, descanso, nota |
| 12 | — | La "adherencia %" de la maqueta sale de la UI: no había forma de calcularla |
| 13 | El cobro de las membresías fuera de la app (fila 5) | **El cliente paga su membresía al entrenador con Stripe** (03-11-2026, §10 y §12). El registro manual de una membresía pagada se mantiene |

---

## 2. Distinciones centrales

Se mantienen las cuatro de la tercera pasada. Dos siguen siendo el núcleo:

**Prescripción vs. registro.** `RoutineDayExercise` (lo que manda el entrenador) nunca en la
misma tabla que `WorkoutLog` (lo que hace el cliente). El registro es opcional y no bloquea nada.
El menú no tiene registro: es sugerencia pura.

**Dato continuo vs. dato de corte.** `WeightLog` es libre y alimenta las gráficas; `Review` es un
corte y alimenta la comparación. **Mientras la revisión es editable, el peso no vive dentro de
ella**: referencia el `WeightLog` de su ventana. Una sola fuente de verdad para la gráfica. Al
pasar a `vista` la revisión guarda copia del peso y de su fecha, y desde entonces se lee de la
copia (I24); la gráfica sigue leyendo los pesajes.

**Catálogo vivo vs. copia congelada.** `QuestionnaireQuestion` → `QuestionnaireResponse`,
`MeasurementType` → `BodyMeasurement`. La FK al catálogo se mantiene (permite comparar entre
revisiones por identidad); el enunciado, formato, etiqueta y unidad se copian congelados al
registrar el valor, y de nuevo solo si el valor cambia (I12) (permite leer el pasado tal y como
se preguntó).

**Sugerencia vs. obligación.** Nada es obligatorio para el cliente salvo enviar la revisión, y
ni eso se impone: la cadencia es orientativa.

Y una quinta, que llega con la biblioteca de alimentos (07-10-2026):

**Declarado vs. calculado.** Las kcal y los tres macros de un menú los escribe el entrenador y se
guardan: son lo que declara que aporta ese menú y lo que lee el cliente. Lo que suman sus alimentos
lo calcula la app a partir de los gramos y de la composición de cada uno (§5), y es un apoyo del
editor: no se guarda, no rellena ni corrige las macros declaradas y no bloquea guardar ni publicar
(I30).

---

## 3. Lenguaje ubicuo

UI en español, identificadores de código en inglés.

| UI | Código | Definición |
|---|---|---|
| Entrenador | `Trainer` | Profesional propietario de una cartera. **Frontera de tenancy** |
| Cliente | `Client` | Persona con seguimiento. Pertenece a un único entrenador |
| Membresía | `Membership` | Periodo contratado y su estado de pago. Un cliente acumula varias |
| Tarifa | `MembershipRate` | Lo que el entrenador cobra por un tipo de membresía: si la ofrece (activa) y su precio. Una por entrenador y tipo |
| Pago en línea | `OnlinePayment` | Cobro de una membresía con Stripe Checkout, del cliente al entrenador. Lo que queda en la app es la membresía con el id del pago y el importe (I21) |
| Consentimiento | `consentVersion`, `consentAcceptedAt` | Texto que el cliente acepta al aceptar la invitación. Se guardan la versión aceptada y la fecha (I33) |
| Ejercicio | `Exercise` | Entrada de la biblioteca: nombre, grupo, material, enlace de vídeo, descripción |
| Rutina | `Routine` | Plan de entrenamiento del cliente, organizado en días numéricos |
| Día de rutina | `RoutineDay` | Día 1, 2, 3… con etiqueta opcional ("Torso") |
| Ejercicio prescrito | `RoutineDayExercise` | Un ejercicio dentro de un día, con su prescripción |
| Registro de entreno | `WorkoutLog` | Serie realmente ejecutada. Opcional |
| Macros objetivo | `MacroTargets` | Objetivo diario del cliente por tipo de día. Se edita aparte del menú |
| Menú | `Menu` | Conjunto de comidas para un tipo de día, con macros propias declaradas por el entrenador. Puede haber varios; uno marcado como sugerido |
| Tipo de día | `DayType` | `entrenamiento` \| `descanso` |
| Comida | `Meal` | Bloque del menú: desayuno, comida, merienda, cena |
| Alimento | `Food` | Entrada de la biblioteca: nombre y composición por 100 g. Lo crea un entrenador, y vive en su copia propia y en el catálogo común con el mismo `id`, o llega sembrado de una base de datos pública y vive solo en el catálogo común (§4) |
| Alimento del menú | `FoodItem` | Línea de una comida, con sus gramos. Sale de la biblioteca, con copia congelada del nombre y la composición, o es texto libre |
| Registro de peso | `WeightLog` | Peso en una fecha, en kg, con nota opcional. Uno por cliente y fecha (I23) |
| Revisión | `Review` | Corte semanal: fotos + peso + medidas + cuestionario |
| Semana | `weekNumber` | Entero derivado de la fecha de alta del cliente. Se congela en la revisión |
| Tipo de medida | `MeasurementType` | Entrada del catálogo del entrenador: etiqueta + unidad + orden |
| Medida corporal | `BodyMeasurement` | Valor de un tipo de medida, con etiqueta y unidad congeladas |
| Foto de revisión | `ReviewMedia` | Imagen de composición corporal con pose fija |
| Pregunta | `QuestionnaireQuestion` | Definida por el entrenador. Enunciado + formato (+ rango si es escala) |
| Respuesta | `QuestionnaireResponse` | Respuesta en una revisión, con enunciado y formato congelados |
| Feedback | `feedbackVideoUrl`, `feedbackNote` | Respuesta del entrenador a una revisión. El vídeo es enlace externo |
| Plantilla | `RoutineTemplate`, `MenuTemplate` | Rutina o menú sin cliente, base para clonar |

**Los valores de enumeración se escriben en español** (`borrador`, `frente`, `pagada`,
`entrenamiento`), porque son vocabulario del dominio; los identificadores siguen en inglés. Eso
no los convierte en texto de interfaz: un valor de enumeración no se pinta nunca directamente en
pantalla, se traduce desde `lib/i18n/es.ts` como cualquier otro literal.

**Términos prohibidos**, por ambiguos: *dieta* (se dividió en macros y menú), *sesión* (día de
rutina vs. entreno registrado), *periodo* (ya no existe como entidad), *bloque* (fuera del MVP),
*medida* a secas (tipo de catálogo vs. valor registrado).

---

## 4. Agregados

Cada agregado tiene una raíz; solo la raíz se referencia desde fuera. Todos llevan `trainerId`
denormalizado aunque sea derivable, para que el aislamiento multi-tenant sea una comparación
directa sin joins — valga RLS o reglas de seguridad.

| Agregado (raíz) | Contiene | Frontera |
|---|---|---|
| **Trainer** | Configuración, catálogo de preguntas, catálogo de tipos de medida, tarifas de membresía | Raíz de tenancy. Los catálogos y las tarifas son suyos, no de la plataforma. La cuenta de Stripe conectada no es del dominio: vive detrás de las Edge Functions (§12) |
| **Client** | Perfil, cadencia orientativa de revisión, fecha de alta, visibilidad de kcal y macros (`macrosVisible`, por defecto `true`), consentimiento aceptado (versión y fecha) | La fecha de alta es el origen de la numeración de semanas. `macrosVisible` lo cambian el entrenador, desde la ficha del cliente, y el propio cliente, solo desde su perfil (I11). El email es único en la plataforma (I31) |
| **Membership** | — | Suelto: un cliente tiene un historial, no una membresía. Guarda el tipo, la copia congelada del precio cobrado y, si se pagó con Stripe, el id del pago (I21) |
| **Exercise** | — | Vive en la biblioteca, se referencia desde las rutinas |
| **Food** | — | El de un entrenador vive en dos sitios con el mismo `id`: la **copia propia** de su autor, con `trainerId`, y el **catálogo común**, que leen todos los entrenadores; el sembrado, solo en el catálogo común, sin autor. Desde los menús se referencia y se congela |
| **Routine** | `RoutineDay` → `RoutineDayExercise` | Se edita como un todo |
| **MacroTargets** | — | Uno por cliente y tipo de día. Independiente del menú |
| **Menu** | `Meal` → `FoodItem` | Jerarquía que solo se consulta y edita completa. Un `FoodItem` puede apuntar a un `Food`, propio o del catálogo común, y lleva su copia congelada (I29) |
| **Review** | `ReviewMedia`, `BodyMeasurement`, `QuestionnaireResponse`, feedback | Donde vive la lógica de completitud |
| **WeightLog** | — | Suelto por diseño: es continuo, la revisión es de corte |
| **WorkoutLog** | — | Suelto: es un evento del cliente, no parte de la rutina |
| **RoutineTemplate / MenuTemplate** | Misma estructura, sin cliente | Se **clonan** al asignar, nunca se enlazan. El plan clonado guarda el id de su plantilla (`sourceTemplateId`) y la copia de su nombre (`sourceTemplateName`) |

**Plantillas: clonar, no referenciar.** Si se referenciara, editar una plantilla modificaría
retroactivamente el plan de clientes activos. La UI lo dice explícitamente: "la plantilla se
copia al cliente".

**De qué plantilla salió un plan (E8, 03-11-2026).** El plan clonado guarda `sourceTemplateId`, el id
de la plantilla, y `sourceTemplateName`, la copia de su nombre al asignarla. No es una referencia
viva: editar la plantilla no toca el plan. El id sirve para contar los usos de una plantilla —antes
se contaban por nombre, y renombrarla los perdía y dos plantillas homónimas los sumaban—; el nombre
congelado, para mostrarlo. Los planes anteriores a esta decisión no tienen id y no cuentan como uso
de ninguna plantilla.

**Catálogos: referenciar *y* congelar.** Al contrario que las plantillas, aquí sí hay FK viva
**y además** copia congelada del texto. Son dos necesidades distintas: la FK sostiene la
comparación entre revisiones, el texto congelado sostiene la lectura fiel del histórico. Los
alimentos del menú siguen la misma regla (I29): el `foodId` dice de qué alimento salió y la copia
congelada, con qué nombre y composición se puso.

**Alimentos: copia propia y catálogo común.** Un alimento lo crea un entrenador o llega sembrado.
El de un entrenador vive en dos sitios con el mismo `id`. La **copia propia** es la fuente de
verdad: lleva `trainerId` y cumple I1 como cualquier otro dato del entrenador. El **catálogo común**
es lo que se publica de esa copia para que lo lean todos los entrenadores (§7, §12), y solo su
autor lo cambia (I28). El catálogo común tiene además alimentos **sembrados** de bases de datos
públicas (USDA FoodData Central y Open Food Facts): sin autor y de solo lectura para todos los
entrenadores (decidido el 08-10-2026).

La copia propia se lista entera; el catálogo común no se lista: se busca por texto, por páginas.
Lo que devuelve la búsqueda se une por `id` con la copia propia, y si un alimento está en las dos
manda la propia, porque el catálogo puede ir por detrás (`pendiente`, §7). En la biblioteca hay
tres orígenes: **tuyo**, si está en la copia propia del entrenador; **de otra cuenta**, si llega
del catálogo y es de otro entrenador, del que no se muestra nada más que eso, nunca su identidad;
y **sembrado**, que se muestra con su fuente. Mostrar la fuente es además la atribución que exige
la licencia ODbL de Open Food Facts. Se admiten nombres duplicados (§11).

---

## 5. Objetos de valor

- **`Macros`** — kcal + proteína / carbohidratos / grasa. Los macros en gramos; las kcal, un
  entero mayor que cero. **Las kcal las escribe el entrenador y se guardan**, igual que los
  macros, y los cuatro valores son obligatorios. No se derivan de los macros: la app no comprueba
  si cuadran con 4/4/9, no avisa si no cuadran y no propone ningún valor (decidido el
  01-10-2026; antes se derivaban con 4/4/9 y no se almacenaban).
  El mismo objeto de valor se usa en dos sitios que no hay que confundir: `MacroTargets` es el
  **objetivo diario del cliente**, y las macros que lleva cada `Menu` —también en las plantillas
  de menú— son **lo que el entrenador declara que aporta ese menú**, informativas para el
  cliente. Las escribe el entrenador y no se derivan de nada, tampoco de sus alimentos. La app sí
  calcula lo que suman los alimentos del menú que tienen composición, pero como apoyo del editor:
  enseña lo que queda frente a las macros **del propio menú** —también en las plantillas—, avisa
  si se pasa o se queda corto, y no rellena ni corrige lo declarado ni bloquea guardar o publicar
  (I30). Decidido el 07-10-2026; antes `FoodItem` solo guardaba gramos y la app no podía calcular
  lo que aporta un menú. Que las macros de un menú coincidan o no con el objetivo del cliente es
  criterio del entrenador, y la app ni lo compara ni lo insinúa: lo que queda se mide contra el
  menú, nunca contra `MacroTargets`.
- **`Composicion`** — lo que aportan 100 g de un alimento: kcal + proteína / carbohidratos /
  grasa. Las kcal, un entero mayor o igual que cero (un alimento puede tener 0 kcal; un menú, no);
  con decimales dan error. Los macros, en gramos, mayores o iguales que cero y guardados con un
  decimal como mucho: lo que escribe el entrenador con más decimales se redondea a uno al
  guardarlo, y lo que llega del catálogo común con más decimales, a uno al leerlo. Los tres juntos
  no pasan de 100 g, comprobado sobre los valores ya redondeados; un alimento del catálogo que,
  redondeado, lo pase no se ofrece. Ese tope es físico, no un criterio nutricional, y está para
  cazar erratas. Las cuatro cifras son obligatorias: las de un alimento creado por un entrenador
  las escribe su autor y las de uno sembrado llegan de su fuente. Como en `Macros`, las kcal no se
  derivan con 4/4/9 ni se contrastan con los macros.
- **Alimento del menú (`FoodItem`)** — nombre + gramos (`Cantidad`), de una de dos clases:
  - **de la biblioteca**: guarda `foodId` y copia congelada del nombre y de la `Composicion` del
    momento en que se añadió (I29). Aporta gramos × composición / 100. Su nombre es siempre el de
    la copia congelada: un alimento del menú con otro nombre es de texto libre, sin `foodId` ni
    composición, porque la composición dejaría de corresponder al nombre. Mientras se edita el
    nombre, volver al de la copia congelada recupera el alimento tal como estaba, con su vínculo y
    su composición; no se vuelve a leer de la biblioteca. Los gramos se cambian sin perder el
    vínculo.
  - **de texto libre**: nombre y gramos, sin composición. No suma.
- **Redondeo de lo calculado** — lo que aporta un alimento, el subtotal de una comida, la suma de
  un menú y lo que queda se calculan sin redondear y se redondean solo al presentarlos: kcal a
  entero, gramos a un decimal.
- **Tolerancia de «Cuadra»** — lo que queda de un menú (I30) **cuadra** si la diferencia entre lo
  declarado y lo que suman sus alimentos, sobre los valores redondeados como se presentan, es como
  mucho 5 kcal en las kcal y como mucho 1 g en cada macro, límite incluido. Fuera de ese margen se
  dice lo que queda o lo que sobra, con la diferencia real. Decidido el 08-10-2026.
- **`Prescripcion`** — series (entero), `repsMin` (entero), `repsMax` (entero o nulo: nulo = reps
  fijas), `rir` (texto libre, admite "2" y "1-2"), `rest` (texto libre, admite "3 min" y "el que
  necesites"), `note` (texto libre opcional).
- **`Ejecucion`** — número de serie, peso real, reps reales.
- **`Cantidad`** — gramos.
- **`ValorMedido`** — valor + etiqueta congelada + unidad congelada.
- **`FormatoRespuesta`** — `escala` (con mínimo y máximo, definidos por el entrenador) |
  `texto`. Los límites de la escala forman parte del formato. El mínimo no puede ser negativo; el
  máximo no tiene tope fijo (H5, tarjeta 61).
- **`Cadencia`** — cada N días. Orientativa: alimenta un "te quedan X días" y nada más.
- **`Pose`** — `frente` | `perfil` | `espalda`. Lista cerrada, no configurable.
- **`DayType`** — `entrenamiento` | `descanso`.
- **`TipoMembresia`** — `mensual` | `trimestral` | `semestral` | `anual`. Lista cerrada (E1,
  03-11-2026): el entrenador no crea tipos, solo activa o desactiva cada uno en sus tarifas.
- **`Precio`** — importe en **céntimos de euro**, entero y mayor que cero. Solo EUR: no se guarda
  moneda (E3, 03-11-2026). Se presenta en euros con dos decimales.
- **`Tarifa` (`MembershipRate`)** — tipo + activa (sí/no) + precio (opcional). Una por entrenador
  y tipo. **Solo una tarifa activa y con precio se puede pagar con Stripe**; el registro manual
  admite cualquiera de los cuatro tipos, tenga o no tarifa (E1).

---

## 6. Invariantes

Se conserva la numeración de la tercera pasada para no romper trazabilidad. Las derogadas se
marcan y no se reutiliza su número.

| # | Invariante | Dónde se garantiza |
|---|---|---|
| I1 | Todo registro pertenece a un único entrenador y solo él lo lee o escribe. El catálogo común de alimentos queda fuera: ver I28 | Reglas de seguridad de Firestore |
| I2 | Un cliente pertenece a exactamente un entrenador | Reglas de seguridad (la escritura que nombra un cliente exige que sea del mismo entrenador) |
| I3 | Una rutina solo usa ejercicios de la biblioteca de su mismo entrenador | Validación de dominio + adaptador. Las reglas no recorren la lista de ejercicios de una rutina |
| I4 | Un cliente tiene como máximo una rutina activa y un juego de macros por tipo de día. De los menús puede haber varios activos por tipo de día, uno de ellos sugerido (§3) | Lógica de dominio + adaptador (transacción al activar). Las reglas no pueden contar documentos activos |
| I5 | Una revisión está **completa** ⟺ 3 fotos (frente, perfil, espalda) + peso en ventana + un valor por cada tipo de medida exigido al abrirla + todas las preguntas exigidas al abrirla. **La completitud no bloquea el envío**: se avisa y el cliente decide. Es una **foto del momento del envío**: si una imagen desaparece después, la revisión ni se reabre ni pasa a incompleta | `lib/domain/review` |
| ~~I6~~ | ~~La periodicidad la fija el entrenador y el cliente no la escribe~~ | **Derogada** (§1.3). La cadencia sigue siendo del entrenador, pero es orientativa |
| ~~I7~~ | ~~Una revisión pertenece a exactamente un periodo~~ | **Derogada**: el periodo ya no existe |
| I8 | Los tipos de medida provienen del catálogo **del entrenador**, cerrado para el cliente | Reglas (el catálogo es del entrenador y cerrado para el cliente) + adaptador (que una medida apunte a un tipo del mismo entrenador) |
| I9 | El peso de una revisión sale de un `WeightLog` con fecha dentro de la ventana de la revisión: mientras es editable lo referencia, y desde `vista` guarda su copia (I24) | Lógica de dominio |
| I10 | La comparación de fotos es una acción explícita del entrenador, nunca un estado derivado | Ausencia de automatismo |
| I11 | El cliente lee su rutina y su menú, incluido el peso por alimento; nunca los escribe. Sus kcal y macros (objetivo diario y las declaradas por menú) los ve solo si `macrosVisible` no está en `false` en su ficha. Ese valor lo pueden cambiar el entrenador y el propio cliente, y gana la última escritura. El entrenador los ve siempre. Por defecto, `true` | Con Supabase, la base de datos: con el flag en `false`, `macro_targets_client_select` no devuelve los objetivos y la lectura de menús del cliente no devuelve las kcal ni las macros declaradas (E12, 03-11-2026, tarjeta 123; test pgTAP con los dos valores). La política que deja al cliente escribir en su ficha solo `macros_visible`, mientras esté `activo`. Con Firebase, las reglas de `macroTargets`; las macros de `menus` siguen en la app (decisión del 13-10-2026, que no se trabaja más con Firebase). La pantalla de cliente no las pide ni pinta con el flag en `false` |
| I12 | Toda respuesta y toda medida conservan enunciado/etiqueta, formato y unidad vigentes cuando se registró su valor. La copia congelada se escribe al registrar el valor por primera vez o al cambiarlo: volver a guardar una revisión no recongela lo que no ha cambiado. Editar el catálogo no altera el histórico. Lo único que puede faltar de una revisión antigua es la **imagen**, que vive en Storage (§9) | Columnas congeladas, escritas solo al registrar o cambiar el valor |
| I13 | Nada de lo que cuelgue histórico se borra: preguntas, tipos de medida, ejercicios y alimentos se archivan | Soft delete + reglas (ninguna colección con histórico admite `delete`) · en el catálogo común de alimentos, su API (tarjeta 90) |
| I14 | Las imágenes viven en Supabase Storage y **se borran con el resto de los datos del cliente**, en su operación explícita de borrado a petición (§7). Esa operación solo se hace sobre un cliente `dado_de_baja`, se confirma escribiendo su nombre y borra definitivamente, sin anonimizar: fotos, revisiones, pesajes, registros de entreno, membresías, planes, el cliente y su cuenta. Si una imagen falta, la app lo dice (§9) | Lógica de dominio (función SQL que devuelve las rutas y comprueba el estado) · Edge Function · políticas de Storage |
| I15 | El formato de una pregunta —tipo y límites de la escala— es inmutable desde que existe la primera respuesta. El enunciado es editable siempre | Lógica de dominio + reglas (bandera `hasResponses` en la pregunta) |
| I16 | Como máximo una revisión por cliente y número de semana | Id del documento `{clientId}_{semana}`, que las reglas comprueban |
| I17 | El cliente puede editar su revisión hasta que el entrenador la marca como `vista` | Lógica de dominio + reglas (el cliente solo edita en `borrador` y `enviada`) |
| I18 | El peso corporal se almacena siempre en kg | Validación + reglas (número entre 0 y 400) |
| ~~I19~~ | ~~Los periodos cerrados no se recalculan al cambiar la periodicidad~~ | **Derogada**: no hay periodos |
| I20 | El vídeo, tanto de ejercicio como de feedback, es siempre un enlace externo. La app **no aloja vídeo**: las fotos de revisión viven en Supabase Storage (§9) | Validación de URL |
| I21 | La app nunca guarda datos de tarjeta ni de cuenta bancaria. De un pago guarda solo el id del pago de Stripe, su estado y el importe cobrado, en la membresía que crea. Una membresía guarda su tipo y la copia congelada del precio cobrado: cambiar la tarifa después no la altera (reescrita el 03-11-2026, S2 y E2) | Modelo de datos: la membresía solo tiene esas columnas, y los datos de tarjeta no llegan nunca a la app (los pide Stripe Checkout) |
| I22 | `weekNumber` se congela al crear la revisión y no se recalcula nunca | Escritura única + reglas (no cambia tras crearse) |
| I23 | Como máximo un `WeightLog` por cliente y fecha civil. Registrar un peso en una fecha que ya tiene pesaje **lo actualiza** en lugar de crear otro: conserva su identidad y su fecha de creación (la revisión que lo referencia, I9, no se rompe) y sustituye el peso. La nota se sustituye solo si llega una; si llega vacía, se conserva la anterior | Lógica de dominio + id del documento `{clientId}_{fecha}`, que las reglas comprueban |
| I24 | Mientras una revisión está en `borrador` o `enviada`, su peso es el del pesaje al que apunta (`weightLogId`): si el cliente corrige ese pesaje, la revisión lo refleja. La revisión no cambia sola de pesaje —no sigue al último de la ventana—: cambia cuando el cliente la vuelve a guardar. Al pasar a `vista` guarda copia del peso en kg y de la fecha del pesaje, y desde entonces se lee de la copia aunque el pesaje se corrija | Lógica de dominio + reglas (solo el entrenador escribe la copia, al marcar `vista`) |
| I25 | Un pesaje al que apunta una revisión `enviada`, `vista` o `revisada` no se puede borrar. Rige en el uso normal de la app: el borrado a petición (§7, §9) se lleva a la vez las revisiones y los pesajes del cliente, e I25 no lo impide | Lógica de dominio + adaptador. Las reglas no consultan las revisiones que apuntan a un pesaje |
| I26 | La unidad de un tipo de medida es inmutable desde la primera medida registrada de ese tipo. Para cambiarla se archiva el tipo y se crea otro. La etiqueta es editable siempre | Lógica de dominio + reglas (bandera `hasMeasurements` en el tipo de medida) |
| I27 | Un pesaje no admite una fecha posterior a hoy, en la zona del entrenador, ni anterior a la fecha de alta del cliente | Lógica de dominio + adaptador. Las reglas no conocen «hoy» en la zona del entrenador |
| I28 | Un alimento solo lo edita o archiva el entrenador que lo creó. El catálogo común es de lectura para todos los entrenadores, y de escritura solo para el autor de cada alimento | Reglas de seguridad en la copia propia (por `trainerId`) · la API del catálogo en el catálogo común (tarjeta 90) |
| I29 | Un alimento del menú que sale de la biblioteca conserva el nombre y la composición con que se añadió. Corregir o archivar el alimento no cambia los menús que ya lo usan, de clientes ni de plantillas; clonar una plantilla copia la copia congelada tal cual, sin refrescarla desde la biblioteca | Copia congelada en el `FoodItem`, escrita solo al añadir el alimento |
| I30 | Lo que aporta un menú se calcula solo con los alimentos del menú que tienen composición; los de texto libre no suman. El resultado se mide contra las macros del propio menú y avisa —de lo que queda o sobra, y de que hay alimentos que no suman—, pero nunca bloquea guardar ni publicar, ni rellena las macros declaradas | Lógica de dominio (funciones puras) |
| I31 | El email de un cliente es único en toda la plataforma, sin distinguir mayúsculas. El entrenador solo lo cambia mientras el cliente es `invitado`, y la invitación se reenvía al correo nuevo; con el cliente `activo` o de baja no se cambia (E10, 03-11-2026) | Lógica de dominio + índice único sobre `lower(email)` en Supabase + adaptador |
| I32 | Un cliente tiene como máximo un borrador por tipo de plan al asignar una plantilla: una rutina y un conjunto de menús por tipo de día. Asignar cuando ya hay uno pregunta si se sustituye; sustituirlo lo borra, porque un borrador no tiene histórico (E9, 03-11-2026). Los objetivos de macros no tienen borrador: se fijan activos | Lógica de dominio + adaptador · en Supabase, las funciones de asignación (`plan.draft_exists`). No es un índice único: versionar una rutina activa o archivar un ejercicio crean un borrador un instante mientras puede existir otro |
| I33 | Un cliente no pasa de `invitado` a `activo` sin aceptar el texto de consentimiento vigente. Se guardan la versión aceptada y la fecha, y no se reescriben (C1, 03-11-2026) | Lógica de dominio + función de aceptación de la invitación (Supabase) |
| I34 | Una membresía pagada con Stripe nace solo cuando el webhook confirma el pago, nunca antes: no hay estado «pendiente» y un pago abandonado no deja nada. El mismo pago confirmado dos veces crea una sola membresía (E6, S10) | Índice único sobre el id del pago + Edge Function del webhook, que verifica la firma |
| I35 | Solo se paga con Stripe una tarifa activa y con precio, de un entrenador que ha conectado su cuenta, y solo la paga un cliente `activo` (E1, E5) | Lógica de dominio + Edge Function de Checkout, que relee la tarifa y el cliente al crear la sesión |

Las reglas de seguridad (`firestore.rules`, tarjeta 34) son el sustituto de RLS y llevan un test
por invariante contra el emulador de Firestore, con su caso negativo. Dos campos **no son del
dominio**: `hasResponses` en la pregunta y `hasMeasurements` en el tipo de medida. Son banderas que
sube a `true` quien registra la primera respuesta o la primera medida —el cliente, al guardar su
revisión— y que fijan el formato (I15) y la unidad (I26) sin recorrer el histórico. Nadie las baja
y los esquemas zod las descartan al leer.

I5, I9, I12, I15, I17, I22, I23, I24, I25, I26 e I27 concentran casi toda la lógica de negocio
real. Se cubren con tests desde el primer día. Las del 03-11-2026 (I31–I35) llevan test de dominio
y, lo que garantiza la base de datos, pgTAP.

Cómo se implementan I5 e I9: la revisión guarda al crearse su **ventana** (las fechas entre las
que vale un pesaje) y sus **requisitos congelados** (qué tipos de medida y qué preguntas se le
exigen). Sin esos dos campos, I9 obliga a recalcular desde la fecha de alta en cada lectura e I5
no tiene forma de resistir un cambio posterior del catálogo.

Sobre I5: "exigido al abrirla" significa que la completitud **no** se calcula contra el catálogo
actual. Si el entrenador añade un tipo de medida hoy, las revisiones de ayer no pueden pasar a
estar incompletas. La revisión guarda, al crearse, el conjunto de tipos y preguntas que se le
exigen.

Y por el mismo motivo, **la completitud se congela con el envío**. Que una foto ya no se pueda abrir
no reabre la revisión ni la vuelve "Parcial": lo que se envió, se envió. Decir lo contrario dejaría
el histórico a merced de lo que pase con las fotos después, y una revisión cerrada hace ocho semanas
podría cambiar de estado sola.

Sobre I28 e I1: la copia propia de un alimento es un registro del entrenador como cualquier otro y
cumple I1 tal cual —solo él la lee y la escribe—. Lo que leen los demás es el catálogo común, que
no vive en Firestore (§12) y existe precisamente para eso: es lo que los autores publican para
todos, sin su identidad, más los alimentos sembrados, de solo lectura (§4). Es la única excepción
a la lectura de I1 y es deliberada; la escritura sigue siendo solo del autor, en los dos sitios.

Sobre I17: el tope de la tercera pasada ("o hasta que se abre el periodo siguiente") desaparece
con los periodos. Si el entrenador no abre nunca la revisión, el cliente puede seguir editándola.
Es aceptable: el entrenador recibe aviso de revisión nueva y el flujo real es que la mira.

---

## 7. Ciclos de vida

**Cliente** — `invitado` → `activo` → `dado_de_baja`
Son los tres únicos estados: **«inactivo» no existe**. Cualquier agrupación o cifra en pantalla
usa estos tres, con sus etiquetas «Invitación pendiente», «En activo» y «Baja» (decidido el
01-10-2026).
**`invitado` pasa a `activo` en el primer acceso**: el cliente abre el enlace de la invitación que
recibe por correo, escribe su correo, crea su contraseña y **acepta el texto de consentimiento**
(I33, §9). Sin aceptarlo la cuenta no se activa.
**El email solo se cambia mientras el cliente es `invitado`** (I31): cambiarlo reenvía la
invitación al correo nuevo. Con el cliente `activo` no se cambia.
La baja conserva el histórico completo, fotos incluidas, sin caducidad. Aparte existe una
operación de **borrado a petición** (decidida el 03-11-2026, E11): el entrenador borra
definitivamente a un cliente **de baja**, y lo confirma escribiendo su nombre. Se van las fotos de
Storage, las revisiones con sus medidas y respuestas, los pesajes, los registros de entreno, las
membresías, sus planes, la ficha y su cuenta. **No se anonimiza nada: se borra.** Los pagos quedan
en el panel de Stripe del entrenador, que es el comercio (§12). Se lleva a la vez sus revisiones y
sus pesajes, y por eso I25 no la impide. Un cliente `invitado` o `activo` no se borra: primero se
da de baja.
**Un cliente dado de baja no tiene acceso a la app** (decidido el 08-10-2026): ni lectura ni
escritura desde su cuenta. Su área de cliente no muestra nada más que el aviso de cuenta dada de
baja, y las reglas de seguridad lo impiden aunque se llegue a Firestore directamente. **El
entrenador no admite cambios sobre él** hasta que se reactive: no se editan sus datos, no se le
asignan planes y no se le envía feedback. Lo único que se permite es reactivarlo, que lo devuelve
a `activo`, y ver su histórico desde el panel.

**Transiciones válidas del cliente (H6, tarjeta 61).** Solo estas tres; cualquier otra se rechaza:
`invitado → activo` (primer acceso), `activo → dado_de_baja` (baja) y `dado_de_baja → activo`
(reactivar). Una invitación que nadie acepta no tiene baja: sigue `invitado`.

**La baja no congela la semana (H7, tarjeta 61).** La numeración de semanas sigue la fecha de
alta también para un cliente dado de baja (§8).
**Esa operación alcanza también a las fotos**: las borra de Storage en la misma operación (I14, §9).

**Rutina / Macros / Menú** — `borrador` → `activo` → `archivado`
Asignar una rutina nueva archiva la anterior, y lo mismo unos macros nuevos para un tipo de día.
Los menús activos de un tipo de día forman un **conjunto** (I4): activar un conjunto nuevo para
ese tipo de día, sea al asignar una plantilla o al publicar desde el editor, archiva todos los que
estaban activos en él. El histórico se conserva para poder leer un `WorkoutLog` antiguo en su
contexto.
**Una rutina o un menú activo no se edita en sitio**: publicar cambios sobre él crea una versión
nueva y archiva la anterior; en los menús, la versión nueva es el conjunto de su tipo de día. Un
borrador sí se edita en sitio. Decidido el 01-10-2026; sustituye la decisión de la tarjeta 10, que
editaba la rutina activa en sitio.
**Como máximo un borrador por cliente y tipo de plan** (I32, 03-11-2026): si al asignar una
plantilla ya hay uno, se pregunta si se sustituye; sustituirlo lo borra, porque un borrador no
tiene histórico que conservar.

**Ejercicio** — `activo` → `archivado`
El entrenador puede "eliminar" un ejercicio de su biblioteca. El sistema le avisa antes de qué
clientes lo tienen prescrito y, si confirma, el ejercicio sale de la biblioteca y de las rutinas
de esos clientes. **La fila no se borra: se archiva.** Un `WorkoutLog` antiguo tiene que poder
seguir diciendo qué ejercicio se hizo, que es la misma razón por la que las rutinas se archivan
en vez de borrarse.
**Cómo sale de las rutinas** (E7, 03-11-2026): cada rutina **activa** que lo prescribe se versiona
igual que al publicar: se crea una versión nueva, activa, sin ese ejercicio, y la anterior se
archiva con él dentro, así que el registro de entreno sigue teniendo su prescripción en alguna
rutina. Los **borradores** se editan en sitio. Las rutinas archivadas no se tocan. Un día que se
queda sin ejercicios se conserva vacío.

**Alimento** — `activo` → `archivado`
«Eliminar» un alimento lo archiva (I13): sale de la biblioteca, en la copia propia y en el
catálogo común, y ya no se puede elegir en un menú. A diferencia del ejercicio, no toca ningún
menú: los que ya lo usan conservan su copia congelada (I29).
Aparte, cada alimento tiene un **estado de publicación**: `pendiente` → `publicado`. Crear, editar
o archivar escribe primero en la copia propia y después publica en el catálogo común. `publicado`
significa que el catálogo tiene la última versión de la copia propia; mientras no la tiene, el
alimento está `pendiente`, y cada escritura nueva lo vuelve a dejar así hasta que se publica. Si la
publicación falla, se queda `pendiente`, su autor lo puede usar ya en sus menús y la app reintenta.
Es un estado de la copia propia: solo lo ve el autor.

**Entrada de catálogo (pregunta, tipo de medida)** — `activa` → `archivada`
Nunca se borra: hay histórico colgando. Archivar la saca de las revisiones futuras y de la
comprobación de completitud (I5), pero no toca las pasadas. La UI ya lo advierte: "los cambios
aplican a partir de la próxima revisión".
La unidad de un tipo de medida no se edita desde su primera medida registrada (I26): para
cambiarla se archiva el tipo y se crea otro. La etiqueta se edita siempre.

**Revisión** — `borrador` → `enviada` → `vista` → `revisada`

| Estado | Significado | ¿Almacenado? | Señal en la UI |
|---|---|---|---|
| `borrador` | El cliente la está rellenando | Sí | "en curso 2/4" |
| `enviada` | El cliente la ha enviado, completa o no | Sí | Insignia "Nueva" en el panel del entrenador |
| `vista` | El entrenador la ha abierto. Apaga "Nueva" y cierra la edición del cliente (I17) | Sí | — |
| `revisada` | El entrenador ha enviado el feedback | Sí | "Revisada · feedback enviado" |

**`completa` no es un estado, es un atributo derivado** de I5. Una revisión puede estar `enviada`
e incompleta — la UI la marca "Parcial" — y eso es normal, no un error.

**Membresía** — `pagada` / `no_pagada`, con fechas de inicio y fin.
Las renovaciones son filas nuevas, no ediciones de la anterior. El historial es la lista completa.
Una membresía nace de una de dos formas (03-11-2026):

- **Registro manual del entrenador** (S6). Como hasta ahora: cualquiera de los cuatro tipos, con
  el estado de pago que diga el entrenador. No lleva id de pago.
- **Pago del cliente con Stripe** (E5, E6). Desde su pantalla Membresía, el cliente elige un tipo
  con tarifa activa y precio y va a Stripe Checkout. Si el entrenador no ha conectado Stripe, el
  botón no aparece; un cliente de baja no puede pagar. La fila se crea **solo cuando el webhook
  confirma el pago** (I34), ya `pagada`, con el tipo, la copia del precio cobrado y el id del pago
  (I21). Su **inicio** es el día siguiente al fin de la membresía en vigor el día del pago, si la
  hay; si no, el día del pago, en la zona del entrenador (E4). Su fin, el de `membershipEndDate`.
  Los solapes se siguen marcando y no se bloquean.

Un pago es siempre único y de un periodo: no hay suscripciones ni cobros recurrentes (S3).

---

## 8. Numeración de semanas

Sin bloques y sin periodos, la semana es una función pura de dos datos:

```
weekNumber(client, date) = floor((date - client.startDate) / 7 días) + 1
```

- Se calcula en la zona horaria del entrenador, que es un campo de su configuración.
- Antes de la fecha de alta no hay semana. Un cliente cuya fecha de alta todavía no ha llegado no
  tiene `weekNumber`, y en pantalla se pinta «—», no «Semana 1».
- Se **congela** en la revisión al crearla (I22). Cambiar `startDate` después no reetiqueta el
  histórico.
- El histórico se agrupa de dos en dos para la UI: "Semana 1-2", "Semana 3-4". Es presentación
  pura, no estructura.
- Si el cliente se salta una semana, esa semana simplemente no tiene revisión. No hay estado
  `vencida` ni fila fantasma.
- La cadencia del entrenador solo alimenta el aviso "te quedan X días para la próxima revisión".
  No genera estado ni incumplimiento.

---

## 9. Dónde viven las fotos y cómo se borran

**Decidido el 28-10-2026, con Dani: las imágenes de las revisiones van a Supabase Storage**, en un
bucket privado con URLs firmadas (plan de migración, Fase 4). Sustituye a la decisión del 29-09-2026
(Drive del entrenador), que queda derogada. Los datos y la autenticación también pasan a Supabase
(§12). Conservación indefinida, también tras la baja.

> **Punto abierto.** Quién figura como responsable del tratamiento de las fotos en Storage está por
> confirmar con Dani (plan de migración, Fase 0.1, tarjeta 117). El texto de consentimiento tiene un
> **borrador** desde el 03-11-2026 (C2, tarjeta 31), pendiente de validar por Dani: no es
> definitivo. Lo que no cambia: la ausencia de una foto es un estado esperado, nunca un hueco roto.

Con las fotos en Storage, **la app sí puede borrarlas**: son suyas y las gestiona ella. De ahí salen
cuatro cosas, y las cuatro son del dominio, no de la interfaz:

1. **El borrado de las fotos es parte de la operación de borrado del cliente.** Una función SQL
   devuelve las rutas de sus imágenes y una Edge Function borra los objetos; un job periódico limpia
   los huérfanos que queden si algo falla a medias (plan de migración, Fase 4.5). La app tiene que
   poder comprobar que las fotos se borraron, no solo lanzar la operación.
2. **Una sola operación explícita por cliente borra sus fotos y el resto de sus datos**: revisiones,
   medidas, respuestas, pesajes, registros de entreno. Dentro de esa operación, revisiones y pesajes
   se van a la vez, así que I25 —que rige en el uso normal de la app— no la impide.
3. **El texto de consentimiento del alta es obligatorio.** Tiene que decir **dónde viven las fotos**
   (Supabase Storage), **quién las custodia** (el entrenador), **a quién se le pide el borrado** (al
   entrenador) y **cuánto se conservan** (mientras dure la relación y tras la baja, hasta que se
   pida el borrado). El cliente lo acepta al aceptar la invitación y se guardan la versión y la
   fecha (I33). Cada texto lleva una versión: cambiarlo es una versión nueva, y lo aceptado antes no
   se reescribe. El texto actual es un borrador pendiente de validar (Punto abierto, arriba).
4. **La ausencia de una imagen es un estado esperado, no un fallo.** Una foto puede faltar porque se
   borró, porque su subida falló o porque su ruta ya no existe, y la app se entera al leerla con una
   URL firmada. Así que **la app tiene que detectar que la imagen no está y decirlo, nunca enseñar un
   hueco roto**: el mismo patrón que ya usa Ver revisión —un marcador en el sitio de la foto y un
   aviso único explicando por qué falta, no uno por foto—. Lo que no cambia es el resto de la
   revisión: medidas y respuestas siguen congeladas e intactas (I12), y la completitud sigue
   siendo la del envío (I5).

Las fotos de composición corporal son datos personales de categoría sensible bajo el RGPD. **Esto no
es asesoramiento legal**: conviene contrastar con quien lleve la protección de datos del entrenador
—antes del lanzamiento— tanto el texto de consentimiento como quién figura como responsable del
tratamiento de las fotos en Storage.

---

## 10. Fuera de alcance (v1)

- **Cobro de pagos: lo que sigue fuera.** Desde el 03-11-2026 el cliente paga su membresía al
  entrenador con Stripe (§7 y §12): un pago único por periodo, con Stripe Connect y cargos directos.
  Siguen fuera de la app: la cuota de los entrenadores a la plataforma (S1), las suscripciones y los
  cobros recurrentes (S3), los reembolsos desde la app, las facturas, los impuestos y los
  reintentos de cobros fallidos (S8). Reembolsos y disputas los gestiona el entrenador desde su
  panel de Stripe, porque el comercio es él (S5).
- **Mensajería y chat.** El feedback del entrenador es un vídeo enlazado y una nota, no una
  conversación.
- **Alojamiento de vídeo.** El vídeo es siempre un enlace externo (I20). Las fotos de revisión son
  la única imagen que la app guarda, en Supabase Storage (§9).
- **2FA.** Post-MVP.
- **Bloques de entrenamiento.** Post-MVP.
- **Adherencia calculada.** Sin definición clara de la métrica, fuera de la UI.

El dominio no debe contener campos "preparados por si acaso" para nada de esta lista.

---

## 11. Huecos del diseño

La demo no cubre estas dos cosas y el MVP las necesita:

1. **Pantalla de tipos de medida.** El entrenador fija qué medidas se toman (§1.9), pero la demo
   solo tiene editor de cuestionario. Va un ítem "Tipos de medida" en la barra lateral (no
   «Medidas», H9, tarjeta 61), junto a
   "Cuestionario", con la misma mecánica: lista ordenable, etiqueta, unidad, archivar.
2. **Envío del feedback.** El botón "Enviar feedback" existe pero no hay pantalla detrás. Mínimo:
   campo de URL de vídeo, nota de texto y confirmación que pasa la revisión a `revisada`.

La biblioteca de alimentos (07-10-2026) deja abiertas estas, cada una con su tarjeta:

3. **A la API del catálogo común (tarjeta 90).** Qué pasa con los alimentos de un autor que se da
   de baja o desaparece, que nadie más puede corregir. ~~Si el catálogo nace vacío o
   precargado.~~ **Resuelto el 08-10-2026**: nace precargado con los alimentos sembrados (§4). Qué
   hacer con los nombres duplicados, que hoy se admiten. ~~Y cómo se asegura que la identidad del
   autor de un alimento no llega a los demás entrenadores, que solo ven «de otro» (§4).~~
   **Resuelto el 08-10-2026**: comprobado en `FitnessCRM/food-api`, la respuesta de la API no lleva
   el autor (solo `mine`) y un test de la API lo verifica.
4. ~~**Tolerancia de «Cuadra» (tarjeta 89).** Cuándo lo que queda de un menú se da por
   cuadrado.~~ **Cerrado el 08-10-2026**: ver §5.

---

## 12. Backend: Supabase para datos, auth y fotos

**Decidido el 28-10-2026: migración de Firebase a Supabase.** Los datos, la autenticación y las fotos
de revisión pasan a Supabase (Postgres con RLS, Auth y Storage), salvo el catálogo común de alimentos
(abajo). Las fotos van a Supabase Storage (§9). El plan, con sus fases, está en
`docs/plan-migracion-supabase.md`. Esta sección describe todavía el backend de Firebase hasta que
cada tarjeta de la migración lo sustituya; sus subsecciones se reescriben con ella.

La decisión del 29-09-2026 (Firebase para datos y auth, Drive para las imágenes) queda derogada.

Lo que hasta ahora era el coste hipotético de elegir Firebase pasa a ser trabajo pendiente y
conviene dejarlo escrito para que nadie lo descubra a mitad del adaptador. La columna "dónde se
garantiza" de §6 asignaba a Postgres —RLS, FKs, índices únicos parciales, checks, triggers— buena
parte del trabajo. **Con Firestore ninguna de esas herramientas existe**: I1, I2, I3, I4, I8, I13,
I15, I16, I18 e I23 pasan de garantía del motor a reglas de seguridad más lógica de aplicación, es
decir, código que hay que escribir, testear y mantener. A cambio, Firebase resuelve auth con 2FA
de serie, hosting y push sin trabajo. En §6 consta, invariante a invariante, qué cubren las reglas
y qué queda en el adaptador.

La decisión se implementa por tarjetas. El acceso a datos sigue pasando por las interfaces de
`lib/data/ports/`, y el SDK de Firebase solo se importa desde `lib/data/adapters/firebase/`
(ESLint lo impide en cualquier otro sitio). Con el adaptador de datos a medias, la app sigue
montando el adaptador en memoria. Las interfaces se diseñan sabiendo que detrás hay una base de datos y un almacenamiento de fotos: en
particular, **leer una imagen es una operación que puede fallar por ausencia y tiene que poder
decirlo** (§9), no una URL que siempre resuelve.

### Acceso: correo y contraseña, con invitación por enlace

**Decidido el 03-10-2026. No hay login con Google.** El flujo es:

1. El entrenador da de alta al cliente con su correo y la app le envía un enlace de acceso
   (`sendSignInLinkToEmail`).
2. El cliente abre el enlace, vuelve a escribir su correo y crea su contraseña. En ese primer acceso
   pasa de `invitado` a `activo` (§7).
3. Desde entonces entra con correo y contraseña. Reenviar la invitación es volver a enviar el
   enlace a un cliente que sigue `invitado`.

El enlace lleva el id del cliente invitado (`?c=`) y ningún dato personal; el correo lo reescribe
quien lo recibe, porque casi nunca abre el enlace el navegador del entrenador que lo envió. Cualquiera
puede pedir un enlace para cualquier correo, así que, si al aceptar no hay un cliente `invitado` con
ese correo, la cuenta recién creada se deshace.

**Quién es cada cuenta.** Un documento `users/{uid}` con `role` (`trainer` o `client`), `trainerId` y,
el de un cliente, `clientId` (y su correo). No es una entidad del dominio. Solo nace al aceptar una
invitación: lo crea el propio cliente, y las reglas lo permiten solo con un correo verificado igual
al del cliente invitado; el de un entrenador lo crea el propio entrenador al darse de alta con la
invitación de la administración (abajo). Nunca se edita ni se borra desde la app. La sesión lleva ese
`role`, y es lo que decide si se carga el panel del entrenador o el área de cliente. Una cuenta de
Auth sin `users/{uid}` no es nadie: la app la cierra.

**Administración de la plataforma.** El panel de administración de la plataforma (repo
`FitnessAdmin`) entra con un *custom claim* `admin: true` en el token. Lo asigna una persona, una vez
por cuenta, con el SDK de administración desde un script local: no hay servidor en producción ni
Cloud Functions. Las reglas lo usan para dos cosas y nada más: leer `trainers` y `clients` (no
reseñas, pesos ni entrenos), e invitar entrenadores (crear y retirar invitaciones pendientes en
`trainerInvitations`). No da ninguna otra escritura.

### Alta de un entrenador: invitación de la administración

**Decidido el 14-10-2026.** Los entrenadores no se dan de alta solos ni los crea nadie a mano: los
invita la administración, con el mismo mecanismo de enlace que la invitación de un cliente.

1. La administración (FitnessAdmin) escribe `trainerInvitations/{correo}`, con el id en el correo
   en minúsculas: `{email, name, timeZone, status: 'invitado', createdAt}`. Como `users/{uid}`, no es
   una entidad del dominio de esta app: su modelo es de la administración, y aquí solo se lee para
   dar el alta y se marca como aceptada. Después, la administración envía al correo un enlace de
   acceso que vuelve a `/accept-invite?kind=trainer` de esta app, sin más datos. Si el correo no
   sale, retira la invitación. Al usar el correo como id, no caben dos invitaciones pendientes para
   el mismo correo.
2. El entrenador abre el enlace, vuelve a escribir su correo y elige una contraseña. La página dice
   que la invitación es de entrenador por `kind=trainer` (`lib/domain/invitation-link.ts`).
3. Con la cuenta ya creada por el enlace (y el correo, verificado), la app lee la invitación de ese
   correo y, en **un solo lote**, crea `trainers/{uid}` `{id, name, email, timeZone, createdAt}` con
   el nombre, el correo y la zona horaria de la invitación, crea `users/{uid}` `{role: 'trainer',
   trainerId: uid}` y deja la invitación `aceptada` con `trainerId` y `acceptedAt`. El id del
   entrenador es el `uid` de su cuenta. Entra directo a su panel.

**Lo que se rechaza.** Sin invitación pendiente para el correo (no la hay, o ya se aceptó), no hay
alta: la cuenta se borra si la acaba de crear el enlace y, si ya existía, solo se cierra la sesión;
una cuenta anterior al enlace nunca se borra. Si el correo ya es de alguien de la app (ya tiene
`users/{uid}`, p. ej. un cliente), tampoco hay alta y esa cuenta queda como estaba, sin cambiar su
contraseña: un correo, una persona. La contraseña corta y el correo distinto del invitado se
rechazan como en la invitación de un cliente, sin gastar el enlace.

**Las reglas que lo atan.** Todas miran la invitación desde el correo verificado del token
(`trainerInvitations/{correo del token en minúsculas}`), así que solo el invitado puede leerla y
aceptarla:

- `trainerInvitations`: la crea y la retira (solo pendiente) la administración, con exactamente esos
  campos y `status: 'invitado'`; la lee la administración o el invitado; la actualiza solo el
  invitado, de `invitado` a `aceptada`, cambiando solo `status`, `trainerId` (su `uid`) y
  `acceptedAt`, y en el mismo lote que crea su ficha.
- `trainers/{uid}`: la crea solo la cuenta `uid`, con exactamente esos campos, nombre, correo y zona
  horaria iguales a los de la invitación pendiente, y en el lote que deja la invitación `aceptada` y
  crea su `users/{uid}` de entrenador.
- `users/{uid}`: el de un entrenador, solo `role` y `trainerId` (igual a `uid`), con invitación
  pendiente y su ficha creada en el mismo lote.

Fuera de alcance por ahora: reenviar o cancelar una invitación desde el panel de la administración, y
la baja de un entrenador.

**Correos.** Firestore compara los correos tal cual y Firebase Auth los guarda en minúsculas. Hasta
que el esquema los normalice a minúsculas al guardarlos (pendiente: es un cambio de dominio), la
comparación entre ambos no es fiable si el entrenador escribió mayúsculas.

### Recuperar la contraseña

**Decidido el 07-10-2026.** Quien pierde su contraseña la recupera por correo, sin intervención del
entrenador:

1. En el acceso, «He olvidado mi contraseña» lleva a una pantalla donde escribe su correo y la app
   le envía un enlace (`sendPasswordResetEmail`).
2. El enlace abre una pantalla de la app (`/reset-password`, no la página que aloja Firebase), que
   comprueba el código, enseña a qué correo pertenece y pide la contraseña nueva dos veces.
3. Al guardar no se abre sesión: vuelve al acceso con un aviso y se entra con la nueva.

**No se enumeran cuentas.** Pedir el enlace dice siempre lo mismo, exista o no una cuenta con ese
correo, igual que con las invitaciones. Debajo, una línea fija recuerda al cliente `invitado` que lo
suyo es el enlace de invitación: no tiene contraseña que recuperar, porque su cuenta nace al aceptar
la invitación (§7). Un correo mal escrito sí se rechaza antes de enviar.

El código del enlace es de un solo uso y caduca; caducado o ya usado se dice «Enlace no válido» y se
ofrece pedir otro. Una contraseña corta (menos de 6 caracteres, el mínimo de Firebase) se rechaza sin
gastar el código.

**Configuración manual.** La URL de acción de la plantilla «Restablecer contraseña» de Firebase
Authentication tiene que apuntar a `/reset-password` de la app; es un ajuste de todo el proyecto y
no distingue entornos. Los correos de recuperación tienen cuota diaria en Firebase Auth y son un
blanco típico de abuso: App Check y las alertas de presupuesto (tarjeta 83) son lo que lo protege.

### Cobro de membresías con Stripe

**Decidido el 03-11-2026 (S1–S10, aprobado por Dani y Miguel; tarjetas 124 y 125).**

- **Quién paga a quién.** El cliente paga al entrenador (S1). Stripe Connect con **cuentas
  Standard** y **cargos directos** (S5): el entrenador es el comercio, así que fraude, disputas y
  reembolsos son suyos y los lleva desde su panel de Stripe. Sin comisión de la plataforma. El mismo
  tipo de cuenta para todos los entrenadores.
- **Dónde vive Stripe.** Conectar la cuenta del entrenador, crear la sesión de Checkout y recibir
  el webhook son **Edge Functions de Supabase** (S7), junto a `invite-client` y
  `delete-review-photos`. Todo lo específico de Stripe vive ahí: los puertos y las pantallas hablan
  de «pago en línea», no de Stripe, y el id de la cuenta conectada se guarda en una tabla que solo
  escriben las funciones.
- **Qué guarda la app** (I21). Nunca datos de tarjeta ni de cuenta: los pide Stripe Checkout. Del
  pago, el id, el estado y el importe, en la membresía que crea el webhook (I34).
- **El webhook** verifica la firma de Stripe y es **idempotente**: el mismo evento dos veces no crea
  dos membresías (índice único sobre el id del pago). Un evento de un pago no completado no crea
  nada.
- **Modo test y sin claves en el repo** (S9, S10). Los tests usan eventos de ejemplo y verifican la
  firma con un secreto generado en el propio test. Las claves reales se configuran como secretos de
  las Edge Functions, fuera del repo.
- **Solo con Supabase.** Con Firebase, los métodos de pago en línea responden «no disponible».

### Alimentos: copia propia en Firestore, catálogo común en una API propia

**Decidido el 07-10-2026.** La copia propia de los alimentos de cada entrenador vive en Firestore,
con sus reglas (I28), como el resto de sus datos. El catálogo común no: lo sirve una API propia
(repositorio `FitnessCRM/food-api`), que ya existe, detrás de su propio puerto, separado del de la
copia propia, así que ningún componente sabe de dónde llega cada alimento. Falta conectarla a la
app (tarjeta 90).

Hasta que la app se conecte a la API, con Firebase el catálogo responde «no disponible»: cada
entrenador ve solo sus alimentos, y todos se quedan `pendiente` de publicar (§7). Cuando se conecte
vale lo mismo para cuando no responda: **un catálogo caído no deja a nadie sin sus alimentos**. El
entrenador sigue viendo y usando los suyos, y lo pendiente se publica cuando el catálogo vuelve.
