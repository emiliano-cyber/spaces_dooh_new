---
tipo: modulo
estado: verificado
actualizado: 2026-10-05
tags: [backend, operaciones, ot, reportes, rentabilidad, dinero, rojo]
archivos:
  - db/migrations/20260929_costo_real_ot.sql
  - apps/web/lib/server/ot-repo.ts
  - apps/web/lib/server/ot-controller.ts
  - apps/web/app/api/ot/[id]/costo/route.ts
  - apps/web/lib/costo-ot-captura.ts
  - apps/web/lib/costos-ot.ts
  - apps/web/lib/data/derive.ts
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/server/reportes-repo.ts
  - apps/web/components/demo/reportes/tabla.ts
  - apps/web/components/operaciones/OTVista.tsx
  - apps/web/lib/test/costo-real-ot.e2e.test.ts
  - db/migrations/20260929_roles_operaciones_costear.sql
---

# El costo REAL de una orden de trabajo (OT-COSTO-01)

Pedido del dueño el **2026-09-29**:

> «que las órdenes de trabajo tengan la opción de añadir costo, para que en el
> reporte el costo de operación se sume y tener los costos reales, y el margen
> debe ser margen bruto»

## 1 · Qué había antes, medido

`ordenes_trabajo` tenía **20 columnas y ninguna era un costo**. Y lo que el
reporte de rentabilidad llamaba «costo de operación» **no era un costo**: era
una **tarifa por tipo** que sale de `config_negocio.costos_ot` (ADR 0011, ver
[[02-Backend/operaciones-y-ot]]). Todas las órdenes del mismo tipo costaban lo
mismo — una herrería de $12,000 y otra de $800 entraban por el mismo importe.

## 2 · La decisión que gobierna todo: SUSTITUYE, no se suma

`costo_real` es el costo de la **orden entera**, el mismo hecho que la tarifa por
tipo estimaba. `lib/costos-ot.ts` lo dice de su propio valor —«el costo de UNA
orden de trabajo de este tipo»—: no es un componente del costo, **es** el costo.

Sumarlos cobraría **dos veces la misma visita**, y el error no se vería: daría un
costo de operación más alto y un margen más bajo, que es la dirección en la que
nadie sospecha de una cifra.

La regla:

```
hay costo_real  → vale ese
no hay          → vale la estimación por tipo, como hasta hoy
```

> [!danger] La regla se declara UNA vez, en `lib/costos-ot.ts`, y no es estilo
> `costoEfectivoDeOt(ot, costos)` y `tieneCostoReal(ot)` las usan **los TRES que
> calculan margen**: el motor de reportes, el **dashboard del dueño** y el **P&L
> por campaña** (`derive.ts:632` y `:752`; el del reporte, en
> `lib/data/reportes.ts:1380`).
>
> **Y ya divergió durante este mismo cambio.** Al meter `costo_real` solo en el
> motor de reportes, los otros dos siguieron cobrando la tarifa por tipo: con una
> OT de 12 000 capturada, **el reporte decía 12 000 y el dashboard 1 500 para la
> misma orden**, sin ningún error. No lo encontró una prueba —lo encontró releer
> el diff—, y es exactamente el fallo que la cabecera de `costos-ot.ts` dice que
> ese archivo existe para evitar, y el que `derive.ts:749-751` ya tenía escrito
> sobre la constante vieja:
>
> > «Si aquí se quedara la constante, el margen de una campaña y el del mes
> > dejarían de cuadrar entre sí sin que nada fallara.»
>
> Lo fija `lib/costo-efectivo-ot.test.ts`, que comprueba que los dos den la
> **misma cifra** para la misma OT.

> [!danger] `!= null`, NUNCA `||`
> `costo_real = 0` es un costo **real y válido**: una inspección que hace el
> propio dueño no paga cuadrilla. Con `||` el cero caería a la estimación y el
> reporte cobraría $1,500 por una visita que costó nada. Es el mismo criterio
> que `importeValido()` en `lib/costos-ot.ts`, que acepta el 0 a propósito.

## 3 · El esquema

`20260929_costo_real_ot.sql` — aditiva, idempotente, **sin sintaxis de
PostgreSQL 15** (g500 corre 14.24 y el guard del runner pararía su cola entera).

| | |
|---|---|
| Columna | `ordenes_trabajo.costo_real numeric(14,2)` |
| Nullable | **Sí, y sin DEFAULT** |
| CHECK | `costo_real is null or costo_real >= 0` |
| Índice | ninguno — el reporte ya lee todas las OT del rango, no filtra por esto |

**Por qué nullable y sin default.** `NULL` = «nadie lo ha capturado», y tiene que
poder distinguirse de `0`. Un `DEFAULT 0` convertiría «no se sabe» en la
afirmación «no costó nada» sobre **todas** las órdenes existentes de golpe: el
costo de operación del reporte se desplomaría y el margen se dispararía, sin un
solo error. Mismo criterio que el DEFAULT de tenant que retiró
`20260812_sin_default_tenant.sql` y que el `usuario_id` de
[[02-Backend/vendedor-en-propuesta]].

**Por qué el CHECK.** Un costo negativo **sube** el margen, porque entra
restando. El zod lo para en la ruta; el CHECK protege a la tabla de un `psql` o
de una corrección de datos a mano.

**Por qué un solo número y no un desglose** (materiales, mano de obra,
transporte): lo que sustituye es un número y el reporte suma un número. Un
desglose es una **tabla hija con filas**, no columnas, y se añade el día que
alguien pregunte «¿en qué se fue?» —pregunta que hoy nadie ha hecho— sin mover
este número ni el reporte.

## 4 · Cómo se captura

**`PATCH /api/ot/:id/costo`** con `{ costoReal: number | null }`.
`null` **borra** el costo capturado y la visita vuelve a la estimación.

> [!important] Es una ruta propia, y NO un campo de `cerrar`
> Lo natural parecía meterlo en el cierre de la OT. No se hizo, por tres motivos:
>
> 1. **El cierre lo hace un técnico en la calle, con el teléfono.** Si el costo
>    viajara en `cerrar`, esa ruta pasaría a ser de dinero y llevaría el candado
>    de cambios: el día que una organización encienda `exigir_reautenticacion`,
>    cerrar una OT con su foto testigo pediría contraseña en mitad de la calle.
> 2. **El costo se sabe DESPUÉS**, muchas veces días después: la cuadrilla pasa
>    su factura cuando pasa. Atarlo al cierre retrasaría la foto comprobatoria,
>    que destraba la facturación de la campaña.
> 3. **Las OT ya cerradas no podrían capturarlo nunca**, y el día del despliegue
>    lo están todas.

**Pasa por `exigirCambioSensible('operaciones', 'crear')`** — el candado de
dinero, igual que facturar una campaña o registrar un pago de renta. El permiso
sigue siendo `operaciones.crear` (hoy **DUENO** y **OPERACIONES**): esto **no
cambia quién entra al módulo**, añade la segunda puerta sobre un campo de dinero.

> [!important] 2026-10-05 · el permiso YA NO es `operaciones.crear`: es `operaciones.costear`
> El mismo 29/09, `c0ad8108` creó la acción **`operaciones.costear`** y la ruta
> la exige hoy: `exigirCambioSensible('operaciones', 'costear')`
> (`apps/web/app/api/ot/[id]/costo/route.ts:56`). La tienen **DUENO,
> ADMINISTRADOR, OPERACIONES y FINANZAS**
> (`db/migrations/20260929_roles_operaciones_costear.sql:97-105`): Finanzas
> porque **la factura de la cuadrilla le llega a ella**. La migración añade
> además `FINANZAS + operaciones.ver`, porque no se puede costear lo que no se
> puede abrir — y esa fila le abre también `GET /api/almacen` y
> `GET /api/energia/consumos`. Se descartó dar `operaciones.crear` a Finanzas
> porque eso es **crear y cerrar** OT. Sigue siendo cambio sensible. Ver
> [[roles-de-venta]].

La lógica de lo que el campo entiende de lo tecleado vive **fuera del `.tsx`**,
en `lib/costo-ot-captura.ts`, por el motivo de siempre en este repositorio:
`vitest.config.ts` no monta jsdom, así que una decisión escrita dentro de un
componente no la prueba nadie. Ahí se decide que **el campo vacío es BORRAR y no
cero**, y que no se manda lo que no cambió.

La tarjeta se pinta **solo en la vista de escritorio** (`OTVista` con
`embedded`), no en la vista móvil de la cuadrilla — por el mismo motivo 1 de
arriba.

## 5 · Lo que el reporte DICE

El reporte de rentabilidad trae una quinta nota de cobertura, `costosReales`
(`CoberturaCostoOt`), hermana de `ExclusionesM2`, `CoberturaEnergia`,
`AtribucionEntidad`, `CoberturaTarifa` y `CoberturaVendedor` — ver
[[02-Backend/reportes-dimensiones]].

Cuenta **cuántas visitas van con costo real y cuántas con la estimación**, con
sus dos importes por separado.

> [!danger] Aquí el hueco NO SE VE, y por eso el aviso importa más que los otros
> Una pantalla sin recibo de luz sale con un **cero** que llama la atención. Una
> venta sin tarifa publicada sale con una **raya**. Pero una visita sin costo
> capturado sale con **$1,500** —una cifra perfectamente creíble— y **nada en la
> tabla la distingue** de una que costó 1 500 de verdad. Sin el texto, un total
> mezclado se lee como una medición.

Vive en la dimensión **`operacion`** y no en las cinco que pintan margen, aunque
el costo de operación entre en el margen de todas. Es el **mismo criterio que
`CoberturaEnergia`**, que solo viaja en `luz` aunque la luz entre en el margen de
todas: el aviso pertenece a la dimensión que existe para contestar esa pregunta.

La nota la redacta el **motor** (`notaDeCostosOt`) y la pantalla la pinta
**verbatim**: reescribirla en `tabla.ts` sería la segunda implementación de la
misma frase. Y **sale también cuando todas las visitas tienen costo real** —en
gris—, porque su primera frase hace falta siempre: que la columna «Operación»
pueda ser una estimación no se deduce de ningún número de la pantalla.

Los recuentos se acumulan **dentro del bucle que suma `costoOperacion`**
(`Matriz.costosOt`) y no en una segunda pasada: una segunda pasada repetiría los
tres filtros que deciden qué OT cuenta —cancelada, sin pantalla, fuera de
bucket— y el día que uno cambiara, el aviso explicaría un total distinto del que
la tabla enseña. Así, por construcción,
`costoRealCapturado + costoEstimado === totales.costoOperacion`.

## 6 · El margen pasa a llamarse MARGEN BRUTO

`margen` → `margenBruto`, `margenPct` → `margenBrutoPct`, `margenPorM2` →
`margenBrutoPorM2`, en el motor, en los tipos, en las columnas y en la interfaz.

**El cálculo no cambia ni un peso**: sigue siendo
`ingreso − costoEspacio − costoOperacion − costoEnergia`. Lo que cambia es que
ahora se llama por su nombre.

> [!danger] Margen bruto NO es margen neto, y esto está escrito EN EL REPORTE
> Al neto le faltarían los **costos indirectos** —nómina, oficina, estructura— y
> **este sistema no modela ninguno**. El neto **no se calcula restando nada de lo
> que hay en la tabla**.
>
> Si alguien pide «el neto» después de ver esta columna, la respuesta **no es
> renombrarla otra vez**: es que faltan datos que nadie captura.
>
> La frase está en el aviso `margen-bruto-no-neto` (`tabla.ts`,
> `TEXTO_MARGEN_BRUTO`), en la pantalla y no solo en un comentario, porque la
> confusión la invita la **columna**.

> [!warning] Y ojo con «Operación y nómina», que NO es un costo de nómina
> `catalogo_roles_entidad` tiene el papel `OPERACION`, etiquetado **«Operación y
> nómina»** (`20260917_entidades_fiscales.sql:80`). Es lo que una razón social
> **hace** —qué sociedad lleva la nómina—, **no un importe**: en todo el esquema
> no hay una sola columna con el monto de una nómina, ni de oficina, ni de
> estructura. Medido el 2026-09-29 sobre `db/schema.sql` y las 95 migraciones.
>
> Conviene saberlo antes de contestar «pues súmale la nómina»: el dato con el que
> se sumaría **no existe**.

Ese aviso sale en **toda dimensión que pinte una columna de margen**, y la
condición se **deriva** de `COLUMNAS_POR_DIMENSION` en vez de una lista escrita a
mano: una lista se quedaría vieja el día que alguien añada el margen a otra
dimensión, y ese día la tabla enseñaría un margen bruto sin decir que lo es.

**`entidad`, `tarifa` y `vendedor` no lo llevan**, y no por omisión: ninguna de
las tres pinta margen, así que el aviso hablaría de una columna que no está.

## 7 · Lo que quedó probado

| Suite | Qué fija |
|---|---|
| `lib/data/reportes.costo-ot.test.ts` | 17 · sustitución, el cero, la cobertura, y que `entidad`/`tarifa` siguen sin heredar margen |
| `components/demo/reportes/tabla.costo-ot.test.ts` | 12 · que la PANTALLA enseñe el aviso, su tono, y que «bruto no es neto» siga a la columna |
| `lib/costo-ot-captura.test.ts` | 16 · vacío = borrar, cero ≠ vacío, no mandar lo que no cambió |
| `lib/server/ot-costo-controller.test.ts` | 7 · el zod: negativo, texto, NaN, cuerpo vacío |
| `lib/server/ot-repo.costo-aislamiento.test.ts` | 4 · que la escritura lleve su `and tenant_id` escrito |
| `lib/costo-efectivo-ot.test.ts` | 10 · que la regla se declare una vez, y que el dashboard y el P&L den **la misma cifra** que el reporte |
| `lib/test/costo-real-ot.e2e.test.ts` | 17 · el candado de dinero, el aislamiento entre organizaciones, el CHECK de la base y el reporte de punta a punta |

### Los mutantes que sobrevivieron, y qué enseñaron

**Trece** mutantes contra las unitarias. En la **primera** pasada sobrevivieron
**cuatro**, y los cuatro eran huecos reales:

| Mutante | Por qué sobrevivió |
|---|---|
| El aviso de cobertura **no se empuja** (`if (false && …)`) | El motor redactaba la nota y estaba probado, pero **que la pantalla la enseñara no lo miraba nadie** |
| El aviso sale **siempre en gris**, nunca en ámbar | Igual: el tono vive en `tabla.ts` y no tenía prueba |
| «bruto no es neto» se pinta en **todas** las dimensiones | Habría salido en `entidad`, `tarifa` y `vendedor`, que no tienen columna de margen |
| El `update` pierde su **`and tenant_id`** | Con la RLS activa **no cambia el comportamiento observable**, así que ni una e2e lo delataría. Eso *es* la segunda capa: si no se comprueba que está escrita, se borra sin que nada se queje |

De ahí salieron `tabla.costo-ot.test.ts` y `ot-repo.costo-aislamiento.test.ts`.
Después se añadieron dos mutantes más —el dashboard y el P&L volviendo a la
tarifa por tipo— al aparecer la divergencia de §2. Pasada final: **los trece
muertos**, y cada archivo restaurado y verificado por `sha256`.

> [!warning] Y uno dio «SOBREVIVE» en FALSO, por el motivo que este repo ya tenía escrito
> El mutante del `.nonnegative()` del zod se ancló al literal `.nonnegative(`,
> que **aparece DOS veces** en `ot-controller.ts`: una en el comentario que
> explica por qué está, y otra en el código. `String.replace` cambió **la del
> comentario**, así que la prueba pasó y el veredicto fue «sobrevive» sin que se
> hubiera mutado nada. Se ancló al mensaje de error, que es único, y murió.
>
> Segundo detalle de la misma familia: el archivo está en **CRLF** en el árbol de
> trabajo, así que un literal terminado en `\n` **no casa**. Los dos son la razón
> por la que el arnés imprime `ocurrencias=` en cada línea.

> [!warning] El candado de dinero se descubrió MIDIENDO, no leyendo
> La primera corrida de las e2e dio **403 `requiereDesbloqueo`** en ocho pruebas.
> No era un fallo: es que el entorno de integración tiene
> `exigir_reautenticacion` encendido y `exigirCambioSensible` **hizo su trabajo**.
> De ahí salió el bloque 2 de esa suite, que fija que una sesión bloqueada **no
> escribe nada** — sin él, cambiar la ruta a `exigir` a secas dejaría todo lo
> demás en verde.

## Enlaces

- [[02-Backend/operaciones-y-ot]] — la OT y la tarifa por tipo a la que esto sustituye
- [[02-Backend/reportes-rentabilidad]] — el endpoint y el límite servidor/navegador
- [[02-Backend/reportes-dimensiones]] — las ocho dimensiones y sus notas de cobertura
- [[02-Backend/vendedor-en-propuesta]] — el precedente del nullable sin DEFAULT
- [[04-Datos/esquema]] · [[04-Datos/migraciones]]
- [[06-Operacion/zonas-de-riesgo]] — esto es **R4 (dinero)**
