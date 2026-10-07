# Dominio — HECTOR

Cuarta pasada. Reconcilia el dominio cerrado en la tercera pasada con la demo navegable
aprobada (`docs/design/demo-navegable.html`, 18 pantallas). **Donde el diseño y la tercera
pasada discrepaban, manda el diseño**: es posterior y responde a peticiones explícitas.

Estado: dominio cerrado para el MVP. Backend decidido el 29-09-2026: **Firebase para datos y
auth, y el Drive del entrenador para las imágenes de las revisiones** — ver §12 y §9. El acceso
es con correo y contraseña, con invitación por enlace de correo (§12, 03-10-2026). Implementados:
la autenticación y las reglas de seguridad; el adaptador de datos, solo en parte. La app sigue
montando el adaptador en memoria hasta que el de Firebase cubra todos los puertos.

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

---

## 3. Lenguaje ubicuo

UI en español, identificadores de código en inglés.

| UI | Código | Definición |
|---|---|---|
| Entrenador | `Trainer` | Profesional propietario de una cartera. **Frontera de tenancy** |
| Cliente | `Client` | Persona con seguimiento. Pertenece a un único entrenador |
| Membresía | `Membership` | Periodo contratado y su estado de pago. Un cliente acumula varias |
| Ejercicio | `Exercise` | Entrada de la biblioteca: nombre, grupo, material, enlace de vídeo, descripción |
| Rutina | `Routine` | Plan de entrenamiento del cliente, organizado en días numéricos |
| Día de rutina | `RoutineDay` | Día 1, 2, 3… con etiqueta opcional ("Torso") |
| Ejercicio prescrito | `RoutineDayExercise` | Un ejercicio dentro de un día, con su prescripción |
| Registro de entreno | `WorkoutLog` | Serie realmente ejecutada. Opcional |
| Macros objetivo | `MacroTargets` | Objetivo diario del cliente por tipo de día. Se edita aparte del menú |
| Menú | `Menu` | Conjunto de comidas para un tipo de día, con macros propias declaradas por el entrenador. Puede haber varios; uno marcado como sugerido |
| Tipo de día | `DayType` | `entrenamiento` \| `descanso` |
| Comida | `Meal` | Bloque del menú: desayuno, comida, merienda, cena |
| Alimento | `FoodItem` | Alimento con su peso en gramos |
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
| **Trainer** | Configuración, catálogo de preguntas, catálogo de tipos de medida | Raíz de tenancy. Los catálogos son suyos, no de la plataforma |
| **Client** | Perfil, cadencia orientativa de revisión, fecha de alta | La fecha de alta es el origen de la numeración de semanas |
| **Membership** | — | Suelto: un cliente tiene un historial, no una membresía |
| **Exercise** | — | Vive en la biblioteca, se referencia desde las rutinas |
| **Routine** | `RoutineDay` → `RoutineDayExercise` | Se edita como un todo |
| **MacroTargets** | — | Uno por cliente y tipo de día. Independiente del menú |
| **Menu** | `Meal` → `FoodItem` | Jerarquía que solo se consulta y edita completa |
| **Review** | `ReviewMedia`, `BodyMeasurement`, `QuestionnaireResponse`, feedback | Donde vive la lógica de completitud |
| **WeightLog** | — | Suelto por diseño: es continuo, la revisión es de corte |
| **WorkoutLog** | — | Suelto: es un evento del cliente, no parte de la rutina |
| **RoutineTemplate / MenuTemplate** | Misma estructura, sin cliente | Se **clonan** al asignar, nunca se enlazan |

**Plantillas: clonar, no referenciar.** Si se referenciara, editar una plantilla modificaría
retroactivamente el plan de clientes activos. La UI lo dice explícitamente: "la plantilla se
copia al cliente".

**Catálogos: referenciar *y* congelar.** Al contrario que las plantillas, aquí sí hay FK viva
**y además** copia congelada del texto. Son dos necesidades distintas: la FK sostiene la
comparación entre revisiones, el texto congelado sostiene la lectura fiel del histórico.

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
  cliente. Las escribe el entrenador y no se derivan de nada: `FoodItem` solo guarda gramos, sin
  composición nutricional, así que la app no puede calcular lo que aporta un menú ni contrastarlo
  con lo declarado. Que las macros de un menú coincidan o no con el objetivo del cliente es
  criterio del entrenador, y la app ni lo compara ni lo insinúa.
- **`Prescripcion`** — series (entero), `repsMin` (entero), `repsMax` (entero o nulo: nulo = reps
  fijas), `rir` (texto libre, admite "2" y "1-2"), `rest` (texto libre, admite "3 min" y "el que
  necesites"), `note` (texto libre opcional).
- **`Ejecucion`** — número de serie, peso real, reps reales.
- **`Cantidad`** — gramos.
- **`ValorMedido`** — valor + etiqueta congelada + unidad congelada.
- **`FormatoRespuesta`** — `escala` (con mínimo y máximo, definidos por el entrenador) |
  `texto`. Los límites de la escala forman parte del formato.
- **`Cadencia`** — cada N días. Orientativa: alimenta un "te quedan X días" y nada más.
- **`Pose`** — `frente` | `perfil` | `espalda`. Lista cerrada, no configurable.
- **`DayType`** — `entrenamiento` | `descanso`.
- **`TipoMembresia`** — `mensual` | `trimestral` | `semestral` | `anual`.

---

## 6. Invariantes

Se conserva la numeración de la tercera pasada para no romper trazabilidad. Las derogadas se
marcan y no se reutiliza su número.

| # | Invariante | Dónde se garantiza |
|---|---|---|
| I1 | Todo registro pertenece a un único entrenador y solo él lo lee o escribe | Reglas de seguridad de Firestore |
| I2 | Un cliente pertenece a exactamente un entrenador | Reglas de seguridad (la escritura que nombra un cliente exige que sea del mismo entrenador) |
| I3 | Una rutina solo usa ejercicios de la biblioteca de su mismo entrenador | Validación de dominio + adaptador. Las reglas no recorren la lista de ejercicios de una rutina |
| I4 | Un cliente tiene como máximo una rutina activa y un juego de macros por tipo de día. De los menús puede haber varios activos por tipo de día, uno de ellos sugerido (§3) | Lógica de dominio + adaptador (transacción al activar). Las reglas no pueden contar documentos activos |
| I5 | Una revisión está **completa** ⟺ 3 fotos (frente, perfil, espalda) + peso en ventana + un valor por cada tipo de medida exigido al abrirla + todas las preguntas exigidas al abrirla. **La completitud no bloquea el envío**: se avisa y el cliente decide. Es una **foto del momento del envío**: si una imagen desaparece después, la revisión ni se reabre ni pasa a incompleta | `lib/domain/review` |
| ~~I6~~ | ~~La periodicidad la fija el entrenador y el cliente no la escribe~~ | **Derogada** (§1.3). La cadencia sigue siendo del entrenador, pero es orientativa |
| ~~I7~~ | ~~Una revisión pertenece a exactamente un periodo~~ | **Derogada**: el periodo ya no existe |
| I8 | Los tipos de medida provienen del catálogo **del entrenador**, cerrado para el cliente | Reglas (el catálogo es del entrenador y cerrado para el cliente) + adaptador (que una medida apunte a un tipo del mismo entrenador) |
| I9 | El peso de una revisión sale de un `WeightLog` con fecha dentro de la ventana de la revisión: mientras es editable lo referencia, y desde `vista` guarda su copia (I24) | Lógica de dominio |
| I10 | La comparación de fotos es una acción explícita del entrenador, nunca un estado derivado | Ausencia de automatismo |
| I11 | El cliente lee su rutina, macros y menú; nunca los escribe | Reglas de seguridad |
| I12 | Toda respuesta y toda medida conservan enunciado/etiqueta, formato y unidad vigentes cuando se registró su valor. La copia congelada se escribe al registrar el valor por primera vez o al cambiarlo: volver a guardar una revisión no recongela lo que no ha cambiado. Editar el catálogo no altera el histórico. Lo único que puede faltar de una revisión antigua es la **imagen**, que vive fuera de la app (§9) | Columnas congeladas, escritas solo al registrar o cambiar el valor |
| I13 | Nada de lo que cuelgue histórico se borra: preguntas, tipos de medida y ejercicios se archivan | Soft delete + reglas (ninguna colección con histórico admite `delete`) |
| I14 | Las imágenes viven en el Drive del entrenador y **la app no puede borrarlas**: el borrado de las fotos lo hace el entrenador a mano, en su Drive. La app sí borra el resto de los datos del cliente, con una operación explícita por cliente | Fuera de la app (Drive) para las imágenes · lógica de dominio para lo demás |
| I15 | El formato de una pregunta —tipo y límites de la escala— es inmutable desde que existe la primera respuesta. El enunciado es editable siempre | Lógica de dominio + reglas (bandera `hasResponses` en la pregunta) |
| I16 | Como máximo una revisión por cliente y número de semana | Id del documento `{clientId}_{semana}`, que las reglas comprueban |
| I17 | El cliente puede editar su revisión hasta que el entrenador la marca como `vista` | Lógica de dominio + reglas (el cliente solo edita en `borrador` y `enviada`) |
| I18 | El peso corporal se almacena siempre en kg | Validación + reglas (número entre 0 y 400) |
| ~~I19~~ | ~~Los periodos cerrados no se recalculan al cambiar la periodicidad~~ | **Derogada**: no hay periodos |
| I20 | El vídeo, tanto de ejercicio como de feedback, es siempre un enlace externo. La app **no aloja vídeo ni imágenes**: las fotos de revisión viven en el Drive del entrenador (§9) | Validación de URL |
| I21 | Una membresía registra estado de pago, nunca importes cobrados ni datos de pago | Modelo de datos + reglas (solo existen las claves del modelo) |
| I22 | `weekNumber` se congela al crear la revisión y no se recalcula nunca | Escritura única + reglas (no cambia tras crearse) |
| I23 | Como máximo un `WeightLog` por cliente y fecha civil. Registrar un peso en una fecha que ya tiene pesaje **lo actualiza** en lugar de crear otro: conserva su identidad y su fecha de creación (la revisión que lo referencia, I9, no se rompe) y sustituye el peso. La nota se sustituye solo si llega una; si llega vacía, se conserva la anterior | Lógica de dominio + id del documento `{clientId}_{fecha}`, que las reglas comprueban |
| I24 | Mientras una revisión está en `borrador` o `enviada`, su peso es el del pesaje al que apunta (`weightLogId`): si el cliente corrige ese pesaje, la revisión lo refleja. La revisión no cambia sola de pesaje —no sigue al último de la ventana—: cambia cuando el cliente la vuelve a guardar. Al pasar a `vista` guarda copia del peso en kg y de la fecha del pesaje, y desde entonces se lee de la copia aunque el pesaje se corrija | Lógica de dominio + reglas (solo el entrenador escribe la copia, al marcar `vista`) |
| I25 | Un pesaje al que apunta una revisión `enviada`, `vista` o `revisada` no se puede borrar. Rige en el uso normal de la app: el borrado a petición (§7, §9) se lleva a la vez las revisiones y los pesajes del cliente, e I25 no lo impide | Lógica de dominio + adaptador. Las reglas no consultan las revisiones que apuntan a un pesaje |
| I26 | La unidad de un tipo de medida es inmutable desde la primera medida registrada de ese tipo. Para cambiarla se archiva el tipo y se crea otro. La etiqueta es editable siempre | Lógica de dominio + reglas (bandera `hasMeasurements` en el tipo de medida) |
| I27 | Un pesaje no admite una fecha posterior a hoy, en la zona del entrenador, ni anterior a la fecha de alta del cliente | Lógica de dominio + adaptador. Las reglas no conocen «hoy» en la zona del entrenador |

Las reglas de seguridad (`firestore.rules`, tarjeta 34) son el sustituto de RLS y llevan un test
por invariante contra el emulador de Firestore, con su caso negativo. Dos campos **no son del
dominio**: `hasResponses` en la pregunta y `hasMeasurements` en el tipo de medida. Son banderas que
sube a `true` quien registra la primera respuesta o la primera medida —el cliente, al guardar su
revisión— y que fijan el formato (I15) y la unidad (I26) sin recorrer el histórico. Nadie las baja
y los esquemas zod las descartan al leer.

I5, I9, I12, I15, I17, I22, I23, I24, I25, I26 e I27 concentran casi toda la lógica de negocio
real. Se cubren con tests desde el primer día.

Cómo se implementan I5 e I9: la revisión guarda al crearse su **ventana** (las fechas entre las
que vale un pesaje) y sus **requisitos congelados** (qué tipos de medida y qué preguntas se le
exigen). Sin esos dos campos, I9 obliga a recalcular desde la fecha de alta en cada lectura e I5
no tiene forma de resistir un cambio posterior del catálogo.

Sobre I5: "exigido al abrirla" significa que la completitud **no** se calcula contra el catálogo
actual. Si el entrenador añade un tipo de medida hoy, las revisiones de ayer no pueden pasar a
estar incompletas. La revisión guarda, al crearse, el conjunto de tipos y preguntas que se le
exigen.

Y por el mismo motivo, desde que las imágenes viven fuera de la app (§9), **la completitud se
congela con el envío**. Que una foto ya no se pueda abrir no reabre la revisión ni la vuelve
"Parcial": lo que se envió, se envió. Decir lo contrario dejaría el histórico a merced de lo que
pase en un Drive que la app no controla, y una revisión cerrada hace ocho semanas podría cambiar
de estado sola.

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
recibe por correo, escribe su correo y crea su contraseña (§12).
La baja conserva el histórico completo, fotos incluidas, sin caducidad. Aparte existe una
operación de **borrado a petición** que anonimiza el histórico y borra los datos del cliente. Se
lleva a la vez sus revisiones y sus pesajes, y por eso I25 no la impide.
**Esa operación no alcanza a las imágenes**: viven en el Drive del entrenador y las borra él a
mano (I14, §9). Son dos actos distintos y hay que contarlos como tales, porque el segundo puede
no ocurrir.

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

**Ejercicio** — `activo` → `archivado`
El entrenador puede "eliminar" un ejercicio de su biblioteca. El sistema le avisa antes de qué
clientes lo tienen prescrito y, si confirma, el ejercicio sale de la biblioteca y de las rutinas
de esos clientes. **La fila no se borra: se archiva.** Un `WorkoutLog` antiguo tiene que poder
seguir diciendo qué ejercicio se hizo, que es la misma razón por la que las rutinas se archivan
en vez de borrarse.

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

**Decidido el 29-09-2026: las imágenes de las revisiones van al Drive del entrenador**, una
carpeta por cliente compartida con la cuenta de Google de ese cliente. No a Firebase Storage. Los
datos y la autenticación siguen en Firebase (§12). Conservación indefinida, también tras la baja.

> **Punto abierto (03-10-2026).** Esta sección suponía que el cliente entra con Google y que su
> carpeta se comparte con esa cuenta. El acceso es ahora con correo y contraseña (§12), así que
> **cómo ve el cliente su carpeta queda por decidir** en la tarjeta de las fotos (17): no se decide
> aquí. Lo que no cambia: la app no puede borrar las fotos y su ausencia es un estado esperado.

Esto tiene una consecuencia que no se puede suavizar, y de la que cuelga el resto de esta sección:
**la app no puede borrar las fotos.** No es que delegue el borrado: no tiene la capacidad, porque
los archivos no son suyos. Viven en una cuenta de Google que la app no administra.

De ahí salen cuatro cosas, y las cuatro son del dominio, no de la interfaz:

1. **El borrado de las imágenes es un acto manual del entrenador en su Drive.** Si un cliente
   ejerce su derecho de supresión, alguien tiene que pedírselo al entrenador y el entrenador tiene
   que entrar en su Drive y borrar la carpeta. Si no lo hace, no ocurre — y la app no puede
   comprobarlo, ni registrar que ocurrió, ni enseñar que se cumplió.
2. **El borrado del resto de los datos del cliente sigue siendo de la app**, con su operación
   explícita por cliente: revisiones, medidas, respuestas, pesajes, registros de entreno. Son dos
   actos separados y hay que contarlos separados. Dar por hecho que el primero arrastra al segundo
   es exactamente el error que esta sección existe para evitar. Dentro de esa operación,
   revisiones y pesajes se van a la vez, así que I25 —que rige en el uso normal de la app— no la
   impide.
3. **El texto de consentimiento del alta deja de ser una nota y pasa a ser obligatorio.** Ya no
   basta con declarar finalidad y plazo: tiene que decir **dónde viven las fotos** (el Drive del
   entrenador), **quién las custodia** (el entrenador, no la app) y **a quién se le pide el
   borrado** (al entrenador). Sin eso, el cliente no puede ejercer un derecho que la app no está
   en condiciones de ejecutar por él.
4. **La ausencia de una imagen es un estado esperado, no un fallo.** El entrenador puede mover,
   renombrar o borrar un archivo en su Drive en cualquier momento, y la app se entera al intentar
   leerlo. Así que **la app tiene que detectar que la imagen no está y decirlo, nunca enseñar un
   hueco roto**: el mismo patrón que ya usa Ver revisión —un marcador en el sitio de la foto y un
   aviso único explicando por qué falta, no uno por foto—. Lo que no cambia es el resto de la
   revisión: medidas y respuestas siguen congeladas e intactas (I12), y la completitud sigue
   siendo la del envío (I5).

Las fotos de composición corporal son datos personales de categoría sensible bajo el RGPD, y esta
decisión mueve su custodia fuera de la app. **Esto no es asesoramiento legal, y ahora menos que
antes**: conviene contrastar con quien lleve la protección de datos del entrenador —antes del
lanzamiento— tanto el texto de consentimiento como quién figura como responsable del tratamiento
de unos archivos que están en el Drive personal del entrenador.

---

## 10. Fuera de alcance (v1)

- **Cobro de pagos.** Se registra si una membresía está pagada; el dinero se mueve fuera de la app.
- **Mensajería y chat.** El feedback del entrenador es un vídeo enlazado y una nota, no una
  conversación.
- **Alojamiento de vídeo e imágenes.** El vídeo es siempre un enlace externo y las fotos viven en
  el Drive del entrenador (I20, §9). La app no guarda archivos.
- **2FA.** Post-MVP.
- **Bloques de entrenamiento.** Post-MVP.
- **Adherencia calculada.** Sin definición clara de la métrica, fuera de la UI.

El dominio no debe contener campos "preparados por si acaso" para ninguno de estos seis.

---

## 11. Huecos del diseño

La demo no cubre estas dos cosas y el MVP las necesita:

1. **Pantalla de tipos de medida.** El entrenador fija qué medidas se toman (§1.9), pero la demo
   solo tiene editor de cuestionario. Va un ítem "Medidas" en la barra lateral, junto a
   "Cuestionario", con la misma mecánica: lista ordenable, etiqueta, unidad, archivar.
2. **Envío del feedback.** El botón "Enviar feedback" existe pero no hay pantalla detrás. Mínimo:
   campo de URL de vídeo, nota de texto y confirmación que pasa la revisión a `revisada`.

---

## 12. Backend: Firebase para datos y auth, Drive para las imágenes

**Decidido el 29-09-2026.** Los datos y la autenticación van a Firebase. Las imágenes de las
revisiones **no** van a Firebase Storage: van al Drive del entrenador, una carpeta por cliente
compartida con la cuenta de Google del cliente (§9).

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
montando el adaptador en memoria. Las interfaces se diseñan sabiendo que detrás hay Firestore y un
Drive ajeno: en particular, **leer una imagen es una operación que puede fallar por ausencia y
tiene que poder decirlo** (§9), no una URL que siempre resuelve.

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

**Quién es cada cuenta.** Un documento `users/{uid}` con `role` (`trainer` o `client`), `trainerId` y
`clientId`. No es una entidad del dominio. Lo crea el propio cliente al aceptar la invitación, y las
reglas lo permiten solo con un correo verificado igual al del cliente invitado; el del entrenador lo
crea el propietario a mano en la consola, porque no hay alta de entrenadores en la app. No se usan
*custom claims* porque solo se asignan desde un servidor (SDK de administración, Cloud Functions) y
el proyecto no lo tiene; se revisará el día que lo tenga. La sesión lleva ese `role`, y es lo que
decide si se carga el panel del entrenador o el área de cliente.

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
