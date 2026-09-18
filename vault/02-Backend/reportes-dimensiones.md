---
tipo: modulo
estado: verificado
actualizado: 2026-09-18
tags: [backend, reportes, rentabilidad, finanzas, dinero, contratos, m2, operaciones, rojo]
archivos:
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/server/reportes-controller.ts
  - apps/web/lib/server/reportes-repo.ts
  - apps/web/lib/data/derive.ts
  - apps/web/lib/data/reportes.contrato-por-periodo.test.ts
  - apps/web/lib/data/reportes.dimensiones.test.ts
  - apps/web/lib/test/reportes-rentabilidad.e2e.test.ts
---

# Las cuatro dimensiones de rentabilidad

Complementa a [[02-Backend/reportes-rentabilidad]], que describe el **límite** —
el endpoint, sus capas, el prorrateo y el aislamiento. Esta nota cubre lo que
pasó el **2026-09-18**: el cierre de las **tres dimensiones que devolvían 501**
y, antes que eso, el arreglo del defecto que hacía **deshonesto** cualquier
reporte de un periodo pasado.

> [!warning] Esta nota CORRIGE tres afirmaciones de `reportes-rentabilidad.md`
> Esa nota es del 17/09 y en su apartado «Lo que esta primera versión NO hace»
> sigue diciendo que **el costo usa el contrato vigente HOY** (punto 1), que
> **`trimestre`, `operacion` y `m2` devuelven 501** (punto 3) y que **falta la
> e2e propia del endpoint**. Las tres dejaron de ser ciertas hoy. Lo que sigue
> vigente de ella es todo lo demás, incluido el punto 2: **no hay agregación en
> SQL**.

---

## 1 · El defecto que se arregló primero, porque sin él lo demás miente

El costo del espacio se resolvía con `contratoVigentePorSitio()`
(`derive.ts:1239`), que filtra por `contratoActivo()` (`derive.ts:1133`) — o sea
`VIGENTE`, `POR_VENCER` o `RENOVADO`: **el estatus de HOY**. Sobre un reporte con
eje de tiempo eso producía dos mentiras a la vez, y **ninguna daba error**:

1. **No veía el contrato que gobernaba el periodo y ya venció.** La pantalla
   salía a costo cero — o no salía, porque «no tuvo movimiento».
2. **Aplicaba el cambio de renta hacia atrás.** El contrato de hoy, con su
   importe de hoy, se cobraba en todo periodo anterior que su vigencia tocara.

La regla nueva: **el contrato que cuenta es el que SOLAPA el rango pedido**, con
independencia de su estatus de hoy.

> [!important] La cifra que lo mide, y está en el rojo de la prueba
> Una pantalla con dos contratos en relevo —8 000 al mes hasta junio, 12 000
> desde julio— pedida por trimestres de 2026 daba:
>
> ```
> expected [ 0, 0, 36000, 36000 ] to deeply equal [ 24000, 24000, 36000, 36000 ]
> ```
>
> **48 000 de renta realmente pagada que el reporte escondía**, en un reporte de
> dinero, sin un solo síntoma. El contrato de enero a junio ya está `VENCIDO`, y
> por eso no existía para el reporte de enero a junio.

### Qué estatus cuenta en su periodo, y por qué no sirve `contratoActivo()`

`NO_ACREDITAN_EN_SU_PERIODO` = **`INCOMPLETO`** y **`CANCELADO`**, y nada más:

| Estatus | ¿Cuenta en su periodo? | Por qué |
|---|---|---|
| `VIGENTE` · `POR_VENCER` · `RENOVADO` | Sí | Ya contaban |
| **`VENCIDO`** | **Sí** | Está **caducado, no falso**. Es el caso que da nombre a todo esto |
| `INCOMPLETO` | No | Pendiente de **captura** (ADR 0001): el acuerdo no está afirmado. Se excluye **aunque traiga importe** |
| `CANCELADO` | No | Pendiente **descartado**: nunca se pagó. Cobrarlo sería inventar un costo |

Es la **misma pareja** que el `NO_ACREDITAN` de `sitiosSinContratoCompleto()`
(`derive.ts`), y por el mismo motivo. Y es exactamente por lo que **no sirve
`contratoActivo()`**: además excluye `VENCIDO`.

### La atribución NO se copió — se le pregunta por otro momento

`rentaAtribuidaPorSitio()` y `contratoVigentePorSitio()` se siguen usando **tal
cual**, con su reparto de la renta del predio entre las caras y su precedencia
del contrato de predio sobre el propio de la pantalla. Lo único que cambia es
**qué contratos se les pasan**: los que ya seleccionó `contratosDelPeriodo()`,
con el estatus normalizado por `comoVigente()` para que su filtro de «hoy» no
vuelva a decidir lo que ya está decidido.

> [!note] `comoVigente()` es un adaptador, no una trampa
> Devuelve **una copia** con el estatus normalizado, como **argumento de una
> llamada**. No se escribe nada en la base ni en la respuesta. La alternativa era
> copiar la atribución al servidor, y este repo documenta esa clase de error como
> su error de raíz (`lib/server/tenant.ts:87-89`): dos implementaciones divergen,
> y aquí divergir significa que **el reporte y el dashboard darían dos costos
> distintos para la misma pantalla**. El guard de
> `reportes-repo.aislamiento.test.ts` ya lo vigilaba y sigue en verde.

### Los SEGMENTOS de vigencia — por qué un bucket se parte

Un relevo de contrato no espera al final del mes. Si el bucket no se partiera,
los dos contratos solaparían el mismo periodo y el desempate de
`contratoVigentePorSitio()` —la renta mayor, que es lo conservador **para una
foto de hoy**— se quedaría con el bucket entero y **perdería los días del otro**.

`segmentosDeVigencia()` corta el bucket por cada `fecha_inicio` y cada
`fecha_fin` que caiga dentro, y cada trozo se cobra con la atribución de **los
suyos**. Funciona porque **`mesesEquivalentes()` es aditiva**: la suma de los
trozos es exactamente el bucket, así que partirlo no descuadra el desglose.

Medido a mano en la prueba: relevo el 15 de julio, 8 000 a 12 000.
`8 000 × 15/31 + 12 000 × 16/31 = 312 000/31 =` **10 064.52**. Sin segmentos
saldría uno de los dos meses enteros.

---

## 2 · La matriz, y por qué las cuatro dimensiones no vuelven a sumar

`matriz(datos, opts)` calcula **una sola vez** la rejilla `sitio × periodo` con
el ingreso prorrateado por días, el costo del espacio por segmentos de vigencia
y las OT del bucket. Las cuatro dimensiones **pivotan** eso y ninguna recalcula:
si cada una sumara por su cuenta, **cuatro dimensiones darían cuatro cifras
distintas del mismo mes**.

| Dimensión | Pregunta | Filas | Orden |
|---|---|---|---|
| `sitio` | ¿qué pantallas pierden dinero? | una por pantalla | **peor margen** primero |
| `trimestre` | ¿cómo evoluciona el negocio? | una por trimestre natural | **CRONOLÓGICO** |
| `operacion` | ¿dónde se va el dinero en visitas? | una por pantalla | **más costo de operación** primero |
| `m2` | ¿qué superficie estática rinde? | una por estática con medidas | **peor margen/m²** primero |

El **501 desapareció**, y no por una rama que se borró: `MOTORES` en
`reportes-controller.ts` es un `Record` **exhaustivo** sobre el enum, así que
**añadir una dimensión sin escribir su motor ya no compila**. Lo que el tipo
garantiza no necesita un error en tiempo de ejecución.

Y `DIMENSIONES` se declara **una vez**, en el motor puro (`DIMENSIONES_REPORTE`),
y el controller la reexporta: dos listas dejarían un enum que acepta una
dimensión sin motor, o un motor que nadie puede pedir.

---

## 3 · `trimestre` — la única que no ordena por margen

Una fila por **trimestre natural**, sumando todas las pantallas. La granularidad
sigue mandando en el desglose: con `granularidad=mes`, cada trimestre trae sus
tres meses.

Dos decisiones que la separan de las otras tres, las dos por la misma razón —es
una **serie de tiempo**, no un ranking:

- **Orden cronológico.** Una serie ordenada por importe es ilegible.
- **Un trimestre sin movimiento SÍ aparece, en cero.** Un hueco en una serie se
  lee como «faltan datos»; un cero se lee como «no pasó nada», que es la verdad.
  Es lo contrario de la regla de `sitio`, donde una pantalla sin movimiento no
  ensucia el reporte.

`tieneContrato` en esta dimensión significa «**hubo renta en el trimestre**»: la
fila no es una pantalla. `arrendador` es nulo — son todos los del periodo. Y
`detalle` trae el rango **real** cubierto, porque un reporte que arranca el 10 de
febrero no cubre el T1 completo.

La etiqueta sale de `etiquetaBucket()` (`derive.ts:1551`), la misma que pinta la
gráfica de ocupación: dos etiquetados del mismo trimestre acabarían diciendo
«T1» en una pantalla y «1er trimestre» en la otra.

---

## 4 · `operacion` — el reporte que más le importa al dueño

Visitas a sitio contra el dinero que ese sitio produce. Nace de un ejemplo
textual suyo, y el reporte **tiene que poder enseñarlo**:

> «Tlalpan G500 es menos rentable que G500 Santa Mónica. Han tenido las mismas
> campañas, pero a una van a cada rato a arreglarla.»

Está reproducido literalmente en `reportes.dimensiones.test.ts`: dos pantallas
con **el mismo ingreso** y **la misma renta**, cuatro visitas contra una, y el
margen cae de 45 % a 30 %.

Las visitas son `ordenes_trabajo.sitio_id`. El costo de cada una sale **por
tipo** de `config_negocio.costos_ot` (ADR 0011) con respaldo — ver
[[02-Backend/operaciones-y-ot]]: montar una lona y hacer una inspección no
cuestan lo mismo, y hasta el 17/09 sí.

Columnas propias de esta dimensión:

| Campo | Qué es |
|---|---|
| `visitas` | OT del rango, ya sin canceladas |
| `visitasPorTipo` | cuántas de cada tipo — «van a arreglarla» no es lo mismo que «van a inspeccionarla» |
| `costoOperacionPct` | qué proporción del ingreso se comió la operación. Nulo sin ingreso, **no 0** |
| `horasEnSitio` | horas **reales**, de `fecha_inicio` a `fecha_completada`. Nulo si ninguna visita las tiene medidas |
| `visitasConDuracion` | sobre cuántas visitas se midieron esas horas |

> [!tip] La duración sale del SQL como un INTERVALO, no como dos fechas
> `extract(epoch from (fecha_completada - fecha_inicio))`. Restar dos
> `timestamptz` en Postgres da un intervalo, que **no tiene zona horaria**: así
> la cuenta no depende de en qué máquina corre el proceso. Traer las dos marcas y
> restarlas en Node es el camino por el que este repo ya se equivocó una vez
> (ver `diasHasta` en `derive.ts`).

> [!warning] Ordena por costo de operación, NO por peor margen
> Y el caso que lo demuestra está en la prueba: una pantalla con **−120 000** de
> margen por una renta carísima y **cero visitas**. Por peor margen saldría
> primera y taparía justamente a las que sí son un problema de operación. Un
> margen horrible por renta cara no se arregla yendo menos veces.

---

## 5 · `m2` — dos trampas que se respetan y una decisión que no toma el código

Solo **estáticas**, y las exclusiones **van contadas en la respuesta**.

### Trampa 1 · las digitales no entran, y se dice cuántas

Para una pantalla digital el denominador correcto son **spots**, no metros: una
LED de 9.6 × 5.4 que vende doce spots al día no se compara con una valla de la
misma superficie. Mezclarlas produce **un ranking sin sentido y sin error**.

Se usa la regla **de presentación** (`medioLabel`: el tipo de medio digital, **o**
`es_rotativo`, **o** la exhibición digital o rotativa) y **no** la de booking
(`esDigital`, que por S0-3 solo mira el tipo de medio). Las dos difieren a
propósito (`derive.ts:1373`) y aquí manda la primera porque la pregunta es **qué
vende** la pantalla: un rotativo sobre estructura estática vende rotación.

> [!danger] Hay un guard, y es por el modo de fallo
> `vendePorSpots()` vive en `reportes.ts` y `reportes.dimensiones.test.ts` la
> compara con `medioLabel` en **las 24 combinaciones** de tipo de medio ×
> rotativo × exhibición. Sin ese guard, el día que alguien toque una de las dos
> reglas **una digital entraría al ranking por m² sin dar ningún error**.

### Trampa 2 · `ancho` y `alto` son nullable

Son `numeric(8,2)` **nullable**. Dividir por un ancho que no está capturado **no
da un error: da una cifra**. Las estáticas sin medidas se excluyen y se cuentan
aparte.

> [!note] Solo se cuenta como excluida la que TENDRÍA fila
> Es decir, la que tuvo movimiento en el rango. Si no, un catálogo con
> trescientas digitales dormidas diría «excluí 300» en un reporte donde eso no
> significa nada. El recuento contesta «**cuántas filas te falta ver**».
>
> Y los `totales` son los de **las filas que se ven**: sumar también las
> excluidas daría un total que no cuadra con ninguna columna de la tabla.

### Trampa 3 · el precio por m² de la base significa OTRA COSA

`sitios.precio_m2` ya existe y es el **costo de impresión por m²**
(`lib/server/sitios-repo.ts`, de donde sale la tarifa de impresión como
`ancho × alto × precio por m²`). **No se reutiliza ni se le pone un nombre
parecido**, y ni siquiera se lee de la base: un reporte de rentabilidad que
hablara del proveedor de lonas se leería como si dijera algo del negocio.

Hay un guard que lee `reportes.ts` y `reportes-repo.ts` y falla si esos nombres
aparecen en el código. **Normaliza los finales de línea antes de mirar** — §7.

### La decisión de negocio que sigue ABIERTA

> [!danger] ¿Una pantalla de DOS caras de 3 × 6 son 18 m² o 36 m²?
> **No la decide el código, y no se ha decidido.** Las dos respuestas son
> defendibles y **cambian el ranking entero**:
>
> · **18** (una cara) → el m² mide la superficie del **soporte**.
> · **36** (todas) → el m² mide la superficie que se **vende**.
>
> Hoy se implementa **UNA CARA**, y cambiarlo cuando el dueño conteste es
> **literalmente una línea**: `MULTIPLICAR_M2_POR_CARAS` en `reportes.ts` pasa a
> `true`. `CONVENCION_M2` se deriva de ella y la respuesta la **declara** en
> `convencionM2`, porque **una cifra por metro cuadrado sin decir qué cuenta como
> metro cuadrado no se puede conciliar con nada**.
>
> No se eligió «lo razonable» para no perder tiempo: se eligió lo que **no
> inventa superficie**, se dejó **a la vista** y se dejó **reversible en una
> línea**. La prueba que fija la respuesta de hoy es
> «la superficie es la de UNA cara: 6 x 3 con dos caras son 18 m2, no 36».

---

## 6 · Lo que cambió en las capas

`route.ts` **no se tocó**: la dimensión ya era un parámetro de su contrato.

| Archivo | Cambio |
|---|---|
| `lib/data/reportes.ts` | `matriz()`, `contratosDelPeriodo()`, `segmentosDeVigencia()`, `comoVigente()`, los cuatro motores, `DIMENSIONES_REPORTE` |
| `lib/server/reportes-controller.ts` | `MOTORES` exhaustivo; fuera el 501 y la tabla de etiquetas que lo redactaba |
| `lib/server/reportes-repo.ts` | cinco columnas más de `sitios` (tipo de medio, rotativo, exhibición, ancho, alto) y la duración real de la OT |

> [!warning] `numeric` llega del driver como TEXTO
> `ancho` y `alto` se pasan por `Number()` en el repo. Sin eso la multiplicación
> de dos cadenas sí da el número —JavaScript coacciona—, pero una cadena por
> `null` da 0 y una comparación `> 0` sobre texto se comporta distinto según el
> valor. Se convierte **una vez**, en el borde.

El aislamiento **no cambió**: las seis consultas siguen con `q()` y su
`and tenant_id` explícito, nunca `qRaw`. Ver
[[02-Backend/reportes-rentabilidad]] y [[multi-tenancy-y-rls]].

---

## 7 · Pruebas

| Archivo | Qué ancla | Casos |
|---|---|---|
| `lib/data/reportes.contrato-por-periodo.test.ts` | el contrato del periodo, el relevo a mitad de mes, los estatus que no acreditan | 12 |
| `lib/data/reportes.dimensiones.test.ts` | las tres dimensiones, sus órdenes, las exclusiones del m² y los guards | 31 |
| `lib/test/reportes-rentabilidad.e2e.test.ts` | **la e2e que faltaba**: dos organizaciones con reservas en el mismo periodo, el 403 del rol sin `finanzas`, el 401, el agrupador inyectado | 15 |

Medido el 2026-09-18 en el worktree `dimensiones`: **1294 unitarias en 113
archivos** (desde 1250 en 111). Los recuentos caducan: si necesitas el número,
córrelo.

> [!danger] La e2e siembra las dos organizaciones con el MISMO importe a propósito
> 30 000 cada una, en el **mismo periodo**. Porque un fallo de aislamiento en un
> reporte **no da error**: da **un total al doble**, y un reporte con el dinero
> de otra empresa se lee perfectamente bien. Por eso la aserción que de verdad
> vigila es la del total en 30 000, y no la lista de nombres.
>
> Y comprueba el arreglo del §1 **contra Postgres**: con el contrato `VENCIDO` en
> la base, el reporte de su periodo devolvía cero filas.

> [!warning] Los guards que leen código fuente NORMALIZAN LOS FINALES DE LÍNEA
> Los nuevos empiezan por una normalización de CRLF a LF. Es la lección del
> 2026-09-18, el mismo día: el punto de una expresión regular de JavaScript **no
> cruza el retorno de carro**, así que el patrón de comentario no llega al final
> de una línea CRLF, el comentario no se quita y sobreviven **las propias
> advertencias que citan lo prohibido**. Verde en el árbol de quien lo escribió,
> **rojo en CI y en el de todos los demás**, y con el arreglo fácil a la vista:
> borrar la advertencia. Comprobado a mano aquí con las dos terminaciones antes
> de dar el guard por bueno.

---

## Relacionadas
[[02-Backend/reportes-rentabilidad]] · [[02-Backend/_indice]] ·
[[02-Backend/operaciones-y-ot]] · [[02-Backend/arrendadores-y-contratos]] ·
[[02-Backend/finanzas-y-cobranza]] · [[multi-tenancy-y-rls]] ·
[[zonas-de-riesgo]] · [[convenciones]] · [[MOC-Proyecto]]
