# Validación independiente · lote de inglés «servidor» (ola 4)

- **Rama:** `feat/ingles-servidor`. Son 5 commits sobre `integra/ingles` `0ceacb0b`: `b7c51332`, `f64f65d4`,
  `50f1ccc2`, `a892ec99` y `e6a1682f`.
- **Validador:** agente independiente, 2026-11-02. No he corregido nada. Este archivo no está commiteado.
- **Método:** todo lo de abajo lo medí en este worktree. Escribí dos pruebas temporales
  (`lib/i18n/zz-validador*-tmp.test.ts`) y ya las borré. Los mutantes se restauraron con
  `git checkout -- .`. Al terminar, `git status` muestra solo este informe.
- **No corrí** `next start` ni las e2e, por orden del coordinador. Las cifras de e2e son las del autor:
  1186 en verde y `grants-rol-app` en rojo porque falta Docker.

## Veredicto: **VERDE**

El español no cambia en ningún mensaje ni en ninguna pantalla. Los 53 patrones reconocen solo su
mensaje dentro del árbol real. Lo que el lote no conoce cae al español sin romperse. Lo que es
REGISTRO sigue en español. No encontré nada que bloquee.

Dejo dos hallazgos de severidad baja (un hueco de prueba y un caso adverso improbable) y cinco
observaciones informativas. Se pueden atender en la próxima ola.

---

## Hallazgos

| # | Sitio | Severidad | Escenario |
|---|---|---|---|
| H1 | `lib/i18n/errores-servidor.ts:861` y la prueba `errores-servidor-plantillas.test.ts` | Baja (hueco de prueba) | **Sobrevive el mutante que quita el ancla `$`** al patrón corto «Son N archivos y el maximo por tanda es M.». Como va antes que el largo (`:865`), se come «… Subelos en varias veces.» y el inglés **pierde la segunda frase**. Ninguna prueba lo ve: la guardia busca rastro de español y cuenta los `7`, y un texto truncado en inglés pasa las dos. El código actual está bien. Arreglo: afirmar el inglés exacto del mensaje largo, o que ningún patrón case con el ejemplo de otro. |
| H2 | `lib/i18n/errores-servidor.ts:930` (patrón de `contratos-sitio.ts:182`) | Baja | Si el **nombre de la pantalla contiene « está a »**, el grupo perezoso corta mal. `"Pantalla que está a la vuelta" está a 1.2 km de el predio "Centro"…` sale como `"Pantalla que is la vuelta" está a 1.2 km from the property “Centro”…`, una mezcla de los dos idiomas. Hace falta que el nombre lleve ese texto exacto, así que es improbable. No lanza ningún error. |
| O1 | `errores-servidor.ts:698` (`curvas`) | Info | Un nombre con comillas rectas dentro (`"Doble ""comilla"""`) sale con las curvas alternadas mal (`“Doble ”“comilla”“”`). Las «» que el usuario escriba en un valor se conservan. Es cosmético. |
| O2 | `errores-servidor.ts:637` (`CATALOGO_LIB`) | Info | Entran los fragmentos sin huecos, como `servidor.franja.otra` («otra franja»). Un mensaje que fuera exactamente «otra franja» se traduciría. No existe ninguno, así que no hace daño, pero el catálogo de errores lleva una pieza que no es un error. |
| O3 | `errores-servidor.ts:861/865` | Info | «There are 1 files…» no lleva plural. Es inalcanzable: solo se lanza cuando se pasa el máximo, que es mayor que 1. |
| O4 | `errores-servidor.ts:845,849` (ADR 0042, **anterior al lote**) | Info | Esos patrones dicen «promo codes». El dueño decidió «negotiation code» y este lote sí lo usa (`servidor.codigo.aprobar-con-pendiente`). Hay que alinearlo en otra ola. |
| O5 | `vault/**/desktop.ini` (14 archivos) | Info | **Ya estaban en `main` y en `0ceacb0b`.** Este diff no añade ninguno. Conviene sacarlos del índice en una tarea aparte. |

---

## 1 · El español de todas las respuestas de error queda idéntico

**Estructural.** `traducirError` devuelve el mensaje tal cual si el idioma es `es`. Esa línea no cambió.
`lib/server/errores.ts`, el embudo `respuestaError()`, tampoco aparece en el diff.

**Medido.** Escribí mi propio extractor, sin reutilizar el del autor. Recorre todo `apps/web` salvo las
pruebas, saca el primer argumento de cada `new AppError(` y arma cada mensaje.

- **219 literales** y **49 plantillas**. Las plantillas incluyen `validar()` y un comentario de
  `errores-servidor.ts`. El autor cuenta 45 porque él tacha los comentarios.
- Cada plantilla se armó con **10 valores**: `0`, `1`, `2`, `7`, `Reforma: Norte` (dos puntos),
  `Ñandú «Sur» "Uno"` (acentos y comillas), `$1 $& {1|a|b}`, un salto de línea, `Logo` y la cadena
  vacía. Los ternarios de plural toman la rama que toca: singular con 1 y plural con lo demás.
- Resultado: **`esMal=0`**. En los 219 + 49×10 casos, `traducirError(m,'es') === m`.

**Archivos de prueba con el español exacto.** El diff toca tres archivos de prueba que ya existían:

- `errores-servidor.test.ts`: cambia **solo la línea de comentario** declarada (`:273`).
- `costura.test.ts`: añade el lote `servidor` a la lista.
- `pantallas-comercial.test.ts`: **añade** una frase esperada en español y otra en inglés para el aviso
  de la ficha. No quita ni cambia ninguna expectativa en español.

No se tocó ninguna afirmación existente.

## 2 · Los patrones nuevos (de 15 a 53)

- **53 patrones**, todos anclados con `^…$`. Lo comprobé recorriéndolos en tiempo de ejecución.
- **Ensanchamiento contra el árbol.** Probé los 53 contra **9919 literales**: todas las cadenas de
  8 caracteres o más de todos los `.ts`/`.tsx`, todo `CATALOGO_ERRORES`, todo `CATALOGO_LIB` y los
  219 literales de `AppError`. Solo hay **un** literal reconocido por un patrón: «Debe ser mayor que 0».
  Lo reconoce el patrón de zod de I18N-05, que es justo el suyo.
- **Solapes.** A partir de cada regex armé un ejemplo sintético y lo probé contra los otros 52.
  Ninguno casa con otro. El único solape posible es el de H1, y aparece solo si se quita un ancla.
- **El exacto gana.** Los 9 motivos de ubicación están en `CATALOGO_ERRORES` y también en `CATALOGO_LIB`,
  y tienen **el mismo inglés** en los dos.
- **Tablas cerradas con un valor que no está en ellas.** En todos los casos el valor queda tal cual y
  nada se rompe:
  - Periodicidad `quinquenal` → «billed quinquenal».
  - Etapa `archivado` → «it is archivado».
  - Una pieza de bloqueo `1 cosa rara` se conserva.
  - Etiqueta de firma `Etiqueta nueva` se conserva, y la conocida sale traducida en la misma lista.
  - Faltante `algo nuevo` se conserva.
- **Casos adversos.**
  - Un valor con `$1 $& {1|a|b}` se copia literal: `armar` sustituye con una función, así que el
    valor no se vuelve a interpretar.
  - Las comillas y los dos puntos se conservan.
  - Los saltos de línea no casan con `.+` y el mensaje queda en español, sin error.
  - Un valor no numérico en un hueco `\d+` también cae al español.
  - Una franja con coma («Tarde, noche») sale bien.
  - Con campo conocido (`Logo:`/`Nombre:`), desconocido (`arte:`) o sin campo, las subidas salen bien.
  - El único caso adverso que mezcla idiomas es H2.
- **Plurales 0/1/2.** Salen bien en predios/contratos del arrendador, contratos de la razón social,
  páginas del PDF, datos para firmar, «Pides N espacios» y los bloqueos del cliente.

## 3 · Sentido en inglés

- **Términos.** Revisé las 31 claves `servidor.*`, las 38 plantillas nuevas y las tablas de huecos:
  - responsable legal → *legal representative*
  - búsqueda del responsable → *finding the decision-maker*
  - predio → *property*
  - recibo de CFE → *CFE bill*
  - tanda → *batch*
  - sin fecha → *no date*
  - ninguna → *none*
  - franja → *daypart*
  - ficha → *spec sheet*, como en Comercial negociación (`comercial.ts:44`)
  - Click, no Tap
  - comillas curvas y apóstrofo tipográfico (lo exige `servidor.test.ts`)
- **La calculadora dice lo mismo en el servidor y en la pantalla.** Comparé a mano los 13
  `compartidos.calc.motivo.*` (`compartidos.ts:196-211`) con el catálogo y los patrones de
  `errores-servidor.ts`: coinciden. Lo vigila `servidor.test.ts` («pantalla y servidor dicen el mismo
  inglés»), y el mutante M5 lo confirma.
- El «negotiation code» del cupón pendiente sigue la decisión del dueño. Ver O4 para lo anterior al lote.

## 4 · Lo que es REGISTRO no se tradujo

El diff no añade ni cambia ninguna línea `console.*`. Tampoco toca `textoReactivacion`, `textoAprobacion`
ni `textoRechazo` (`lib/codigo-aprobacion.ts:152-158`), ni `textoAccionProgramacion`
(`lib/franja-programada.ts:125`), que el controlador sigue usando para la bitácora en español
(`programacion-controller.ts:68`). No hay cambios en correos ni en CSV: la única coincidencia de «correo»
en el diff es la frase «un teléfono o un correo de contacto» de la tabla de faltantes. Además,
`avisos` solo viaja en la respuesta (`lib/data/programacion-api.ts:30`) y no se guarda.

## 5 · Lo que cae fuera del lote

- **`ComercialOpex.tsx`.** `idioma` sale de `useIdioma()` en cada componente que lo usa (`:233`, `:375`,
  `:916`). Las llamadas que solo preguntan si algo es nulo (`:659`, `:929-930`) siguen en español, y da
  igual porque solo se usa la nulidad.
- **`ProgramacionDoohmain.tsx`.** Ahora pasa `idioma`.
- **`estado-api.ts`.** `CodigoPendienteApiError` hereda de `Error` y conserva el texto del servidor. Si no
  llega la bandera, el error se lanza como antes. Lo cubre `servidor.test.ts`.
- **Páginas de propuestas.** La rama nueva va después de `ConfirmacionCeroError` y antes del caso genérico.
- **`programacion-controller.ts`.** `idiomaDeLaPeticion()` está protegido:
  - con el inglés apagado devuelve `es` sin leer nada;
  - si no, cada lectura de `cookies()` y `headers()` va envuelta en `leerSeguro` (`lib/i18n/servidor.ts`),
    así que fuera de una petición cae al español sin lanzar.
  - El único llamador es la ruta `campanas/franja-programada`.

Typecheck y unitarias en verde (§8). No veo nada roto.

## 6 · El español de las pantallas

Volqué el HTML en español de los estados de las cuatro pruebas de pantallas (`I18N_VOLCAR` / `VOLCAR_HTML`):
propuestas 23, comercial 24, campañas y finanzas 56 y compartidos 6, **109 estados** y 1 140 836 bytes.

Lo hice dos veces:

1. con HEAD;
2. con los 12 archivos de código del diff (las dos páginas, los dos componentes, `estado-api`,
   `doohmain-programacion`, `franja-programada`, `diccionario`, `errores-servidor`,
   `interpretar-ubicacion`, `negociacion` y `programacion-controller`) puestos con su versión de
   `0ceacb0b` mediante `git show`, y restaurados después.

`diff -r`: **IDÉNTICO**. En la pasada vieja, `pantallas-comercial` dio **1 rojo de 152**: la expectativa
en inglés nueva del aviso de la ficha. Eso confirma que esa prueba no es vacía.

## 7 · Reglas

- El diff no toca `lib/server/errores.ts`, `middleware.ts`, `nav.ts`, `db/schema.sql`, las migraciones
  ni ningún archivo de sesión o auth.
- No hay dinero en el diccionario: las claves `servidor.*` no llevan importes ni símbolos.
- El diff no añade ningún `desktop.ini` (ver O5).

## 8 · Pruebas

- `cd apps/web && npm run typecheck`: **exit 0**.
- `npx vitest run --testTimeout=60000`, que es `npm test` con el timeout alto porque la máquina estaba
  cargada: **337 archivos, 5086 pruebas, todas en verde** (68,8 s).

**Mutantes.** Corrí cada uno contra las 8 suites relevantes (606 pruebas) y restauré después de cada uno:

| # | Mutante | Resultado |
|---|---|---|
| M1 | Quitar el ancla `$` del patrón «Son N archivos…» (`:861`) | **SOBREVIVE**, ver H1 |
| M2 | Tabla `PERIODICIDAD_EN` con `catorsenal` | Muere (2 rojos en `errores-servidor-plantillas`) |
| M3 | `textoAccionProgramacion` en inglés | Muere (2 rojos en `franja-programada.test`) |
| M4 | `motivoHorarioInvalido(horario)` sin `idioma` en `ProgramacionDoohmain.tsx` | Muere (`servidor.test`) |
| M5 | El inglés del Roadblock en el servidor distinto del de la pantalla | Muere (paridad pantalla/servidor) |
| M6 | El aviso de la franja sin `idioma` en el controlador | Muere (`servidor.test`) |
| M7 | `textoReactivacion` en inglés | Muere (`codigo-aprobacion.test`) |
| M8 | Cambiar el inglés de `servidor.negociacion.perdido` | Muere (instantánea y `pantallas-comercial`) |

Mueren 7 de 8. El superviviente es un hueco de la prueba, no un defecto del código.

---

## Lo que el autor dejó para otra ola

**Las 7 rutas que responden `e.message` a mano** (`arrendadores/route.ts:27`, `clientes/route.ts:28`,
`clientes/[id]/route.ts:84`, `propuestas/publica/[id]/route.ts:40`,
`propuestas/[id]/generar-campana/route.ts:45`, `propuestas/[id]/route.ts:163,168,174,195` y
`sitios/route.ts:33`) **no rompen nada**: llegan en español, que es el comportamiento de hoy. La más
visible es `propuestas/[id]/route.ts:163/174`. La confirmación de aprobar en $0 y la del descuento sobre
el tope pintan `e.message` en un `window.confirm` (`propuestas/[id]/page.tsx:319`). Así que en la
aprobación de propuestas, un flujo central, la persona en inglés ve una pregunta en español con un botón
en inglés. Es la mezcla más llamativa que queda. El cupón pendiente ya se resolvió por bandera, y el mismo
patrón sirve para las otras dos.

**Las ~108 frases de dominio que viajan por variable.** Por ejemplo, `motivoTransicion` y
`motivoDecisionInvalida` de `lib/captacion.ts:96,103`, y las clases de error de dominio. Caen al español,
y eso es seguro.

**¿Es grave para encender el inglés?** No es un riesgo de corrección: nada lanza, nada queda con un hueco
crudo y el español no cambia. Es un riesgo de **acabado**: en errores menos frecuentes la persona en inglés
verá frases en español.

- Para un encendido en beta o para clientes concretos, lo veo **aceptable**.
- Para declararlo terminado, haría antes las dos confirmaciones de `propuestas/[id]` (los
  `requiereConfirmacionCero` y `descuentoSobreTope`), porque salen en el flujo principal de venta.
- El resto puede seguir en la ola siguiente.
