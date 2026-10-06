---
tipo: contrato
estado: verificado
actualizado: 2026-10-05
tags: [backend, reportes, rentabilidad, tarifas, propuestas, dinero, snapshot]
archivos:
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/server/reportes-repo.ts
  - apps/web/lib/server/reportes-controller.ts
  - apps/web/components/demo/reportes/tabla.ts
  - apps/web/components/demo/reportes/consulta.ts
  - apps/web/lib/data/reportes.tarifa.test.ts
  - apps/web/components/demo/reportes/tabla.tarifa.test.ts
  - db/migrations/20260708_snapshot_economico.sql
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/campanas-repo.ts
---

# La séptima dimensión: `tarifa` — publicada contra neta

`GET /api/reportes/rentabilidad?dimension=tarifa` — una fila por pantalla:
**qué tarifa se publicó y qué entró de ella.**

La pregunta es literal de un dueño (P6 de
`docs/Plan_Seis_Preguntas_De_Dueno.md`). Las dos cifras **ya estaban escritas**,
congeladas y por pantalla, en `propuestas.snapshot_economico` desde el 08/07:

```
{version, bruto, descuentoPct, descuentoMonto, base, comisionPct, neto, ivaPct,
 iva, total, porSitio: [{sitioId, lista, neto}]}
```

El reporte de rentabilidad **no las miraba**: leía de `reservas` seis columnas
—`sitio_id, campana_id, precio, estatus, fecha_inicio, fecha_fin`— y ninguna era
la tarifa de lista.

> [!note] Y de paso, una afirmación vieja que hoy se vuelve verdad
> La cabecera de `db/migrations/20260708_snapshot_economico.sql:6` dice desde el
> 08/07 que «campaña, factura, **rentabilidad** y comisiones leen de este
> snapshot». Rentabilidad **no lo leía**. Desde hoy sí — para esta dimensión.

---

## 1 · El camino del dato

**`reservas → campanas.propuesta_id → propuestas.snapshot_economico`**
(`db/schema.sql:392`, con el índice `idx_campanas_propuesta` en `:407`).

La consulta vive en `reportes-repo.ts` (`:265` al 05/10; hoy son once
consultas en total), y **no se acota
por rango** — por lo mismo que `facturas`: lo que hace falta es el mapa de las
campañas que tocan el periodo, y son dos columnas por campaña nacida de
propuesta, que es el orden de magnitud de las campañas y no el de las reservas.

### Se lee del SNAPSHOT, no de `sitio_modalidades`

Es la decisión que hace honesta la dimensión. El snapshot es **inmutable**: se
escribe una vez al aceptar y renegociar genera otro, versionado. La tarifa de la
modalidad **de hoy** puede ser otra, y compararla con un ingreso de hace seis
meses daría un descuento que nadie concedió.

---

## 2 · LAS DOS TRAMPAS, y cómo se resuelven

### Trampa 1 · Hay ventas sin tarifa publicada, y no se inventa ninguna

Una campaña creada desde **Comercial** no tiene `propuesta_id`, así que no tiene
snapshot. Para esas no existe tarifa de lista congelada.

**Se pinta una RAYA, nunca un cero.** `ingresoLista`, `ingresoComparable`,
`descuentoYComision` y `descuentoYComisionPct` salen en `null`, y `formatoCelda`
los pinta como `—`. Un 0 en «Tarifa publicada» afirmaría que la tarifa de lista
era cero o —peor— que se regaló entera.

Es la misma regla que ya obliga a `margenBrutoPct` y a `costoPorKwh` a ser `null` y no
cero. Y la fila **sigue saliendo**: un hueco se ve y se rellena; una fila que
desaparece hace creer que esa pantalla no vendió.

### Trampa 2 · Las DOS convenciones de precio, y el guard exacto

> [!danger] `reservas.precio` guarda DOS cosas distintas, y no da error
> - Reserva desde **Comercial** → guarda la **tarifa de lista**
>   (`campanas-repo.ts:443`, `tarifa_mensual`, sin descuento ni comisión).
> - Reserva desde **propuesta** → guarda el **neto**
>   (`campanas-repo.ts:701`, tras `factorDesc × divisor`).
>
> *(2026-10-05: las citas corrieron. Hoy la lista está en
> `apps/web/lib/server/campanas-repo.ts:462` y el neto en `:766-768`
> (`netoSitio`: el del snapshot si lo hay; si no,
> `round(base × volumen × comercial × cupón × divisor)`, donde la base es la
> parte del paquete o el precio de la línea). El comentario de
> `apps/web/lib/data/reportes.ts:1209-1210` repite las citas viejas.)*
>
> Es un defecto conocido. **Esta dimensión NO lo arregla**: arreglarlo toca cómo
> se ESCRIBE un precio, y eso es zona roja y va después del Summit.

Pintar «lista vs neta» sobre una reserva de Comercial compararía **una cifra
contra sí misma** y daría un descuento del 0 % que nadie concedió.

El guard es exacto y medible: **una reserva entra en la comparación solo si su
`precio` coincide con el `neto` que el snapshot congeló para esa pantalla.** Si
no coincide, no se sabe qué convención lleva → se declara. (Verificado el 05/10:
`if (e && e.neto === r.precio)`, `apps/web/lib/data/reportes.ts:1225`.)

### Y el cuarto, desde la Fase 4: la pantalla vendida en PAQUETE

Una pantalla cuyo `porSitio[]` lleva `paquete: true` **queda fuera de la
comparación** aunque su precio cuadre: su neto salió de repartir un precio de
conjunto, no de descontar su lista, y un paquete premium daría una brecha
negativa. `reportes-repo.ts:406` lo lee como `dePaquete`, y `matriz()` le pone
el centinela `DE_PAQUETE = null` (`apps/web/lib/data/reportes.ts:1194`, aplicado
en `:1199`) — el mismo `null` que la ambigüedad. Cuenta en `sinTarifa`. Detalle
en [[paquete-cerrado]] §7.

Eso cubre de paso el caso que **no se ve leyendo**: una campaña que sí nació de
una propuesta y a la que luego se le añadieron pantallas desde Comercial, a
tarifa de lista.

### Y el tercero, que apareció midiendo: la pantalla REPETIDA

Una propuesta puede traer **dos ítems de la misma pantalla** (dos periodos), y
entonces `porSitio` la lleva dos veces con dos tarifas de lista distintas. Cuál
corresponde a cuál reserva **no lo dice el dato**, así que esa pantalla queda
fuera de la comparación en esa campaña.

No es teórico: `campanas-repo` construye su `netoDeSnap` como un Map por
pantalla, así que con la pantalla repetida **gana la última** y las dos reservas
se guardan con el neto del segundo ítem. Sin el centinela de ambigüedad las dos
casarían con esa última entrada y la tarifa publicada saldría a la mitad.

> Este caso apareció **matando mutantes**, no leyendo: la primera versión de su
> prueba pasaba con el centinela y sin él, porque el guard del precio ya la
> rechazaba por otro motivo. La aserción hubo que estrecharla.

---

## 3 · La aritmética, y por qué `ingresoComparable` existe

La tarifa publicada se **prorratea por días con la MISMA fracción que el
ingreso**, en el mismo bucle de `matriz()`. No es una elección de estilo: el
prorrateo es delicado, y repetirlo en otra función daría dos cifras distintas del
mismo periodo el día que una de las dos cambie. Es el mismo argumento que ya
había puesto `porEntidad` dentro del bucle.

| Campo | Qué es |
|---|---|
| `ingreso` | **Todo** lo que entró en la fila, comparable o no. Igual que en las otras seis dimensiones |
| `ingresoLista` | La tarifa publicada de las reservas **comparables**, prorrateada |
| `ingresoComparable` | El neto de **esas mismas** reservas |
| `descuentoYComision` | `ingresoLista − ingresoComparable` |
| `descuentoYComisionPct` | Sobre la **publicada**, que es sobre lo que se concede un descuento |

> [!important] La resta es contra `ingresoComparable`, NUNCA contra `ingreso`
> Una pantalla puede tener en el mismo periodo una reserva de propuesta y otra
> de Comercial. Restar la publicada al `ingreso` daría un descuento **negativo**
> —que se leería como haber cobrado por encima de la tarifa— sin dar error.
>
> Y por eso la columna `Ingreso` se queda en la tabla: es la **única señal en
> pantalla** de que una fila está comparada solo a medias. Cuando `Ingreso` es
> mayor que `Neto comparable`, esa pantalla tuvo además ventas sin publicada.

### La columna NO se llama «Descuento»

`neto = lista × (1 − descuento) × (1 − comisión)`, y el snapshot **no las separa
por pantalla**.

> [!warning] 2026-10-05 · esa fórmula es la de julio; la de HOY tiene más capas
> El neto por pantalla que congela `congelarSnapshotEconomico`
> (`apps/web/lib/server/propuestas-repo.ts:497-499`) es:
>
> ```
> sin paquete:  round(lista × (1−volumen_línea) × (1−comercial) × (1−cupón) × (1−comisión))
> con paquete:  round(parte_del_paquete × (1−comercial) × (1−cupón) × (1−comisión))
> ```
>
> con `factorVol` por línea (`:477`), `factorDesc` (`:408`), `factorCodigo`
> (`:462`, 1 si el paquete no admite cupón) y el divisor de comisión
> (`divisorDeComision`, `apps/web/lib/data/derive.ts:402`: `1 − comisión/100`,
> o 1 si no hay). Es **un solo redondeo al final**, no uno por capa como en la
> cabecera: la suma de los `porSitio[].neto` puede diferir del `neto` de la
> propuesta en algún peso.
>
> Así que la brecha que este reporte llama **«Descuento y comisión»** lleva
> dentro también el **volumen** y el **cupón**. El nombre no miente —son
> descuentos—, pero la nota de cobertura (`notaDeTarifas`) solo nombra el
> comercial y la comisión. Y el paquete no está en la brecha porque esas
> pantallas ya no entran (arriba). Se llama **«Descuento y comisión»**, y el nombre es la mitad del
trabajo de la columna: llamarla «Descuento» haría leer la comisión de la agencia
como una rebaja que alguien concedió. Mismo criterio que `saldoAtribuido` en
[[reportes-por-razon-social]].

---

## 4 · Por qué una dimensión propia y no columnas en `sitio`

`sitio` ya trae ocho columnas. Añadir cuatro daría **once columnas de cifras a
13 px**, que «a tres metros (proyector)» no se leen —y ese es el sitio donde esto
se presenta—. Y ninguna de las ocho contesta la pregunta: `tarifa` no habla de
**costo**, habla de **precio**.

Por eso es la segunda dimensión que **no parte de `COMUNES`**, junto a `entidad`,
y por un motivo distinto que conviene no confundir: en `entidad` la luz y la
operación **no se pueden atribuir**; en `tarifa` sí se podrían, pero no vienen a
cuento.

**Columnas:** `Pantalla · Ingreso · Tarifa publicada · Neto comparable ·
Descuento y comisión · % sobre publicada`. Ni costos, ni margen, ni costo total.

**Orden de apertura:** por `descuentoYComision` descendente — por el **dinero**,
no por el porcentaje. Un 50 % sobre una pantalla de 2 000 no es el problema del
negocio; 80 000 regalados en una grande sí. Las filas sin comparación quedan al
final solas, porque su valor es `null` y `ordenarFilas` ya manda los nulos al
final en las dos direcciones.

**Totales:** los del **negocio completo**, idénticos a los de `sitio`. Cambiar de
agrupador no puede cambiar las cifras grandes de arriba, y hay una prueba que
compara los dos objetos enteros.

---

## 5 · Lo que se DECLARA encima de la tabla

`CoberturaTarifa`, hermana de `ExclusionesM2`, `CoberturaEnergia` y
`AtribucionEntidad`. La nota la redacta el **motor** (`notaDeTarifas`) y la
pantalla la pinta **verbatim**: reescribirla en el `.tsx` sería la segunda
implementación de la misma frase.

Dice dos cosas, y la primera **va siempre**:

1. Que la brecha es el descuento comercial **más** la comisión de agencia.
2. Cuántas reservas del periodo no tienen publicada, **con su importe** y con el
   motivo — nacieron en Comercial, o su precio no coincide con el neto congelado.

**Ámbar cuando falta algo, gris cuando no**: un ámbar que saliera siempre no lo
leería nadie, que es la lección del ámbar que dejó de avisar por salir en todo.

---

## 6 · Lo que esta dimensión NO hace

- **No arregla las dos convenciones de precio.** Se niega a comparar lo que no
  sabe que es comparable, y lo dice. Unificarlas toca dinero.
- **No separa el descuento de la comisión.** El snapshot guarda `descuentoPct` y
  `comisionPct` a nivel de propuesta, pero `porSitio` solo trae `lista` y `neto`:
  por pantalla, la brecha viene junta.
- **No sabe quién concedió el descuento.** Ninguna propuesta tiene dueño
  (`usuario_id` solo existe en `sesiones` y en la bitácora).
  *(2026-10-05: superado el mismo 28/09 por VEND-01 — `propuestas.usuario_id`
  y la dimensión `vendedor`, que reutiliza este mismo camino. Ver
  [[vendedor-en-propuesta]].)*
- **No se ha visto en un navegador.** Lo verificado es typecheck, unitarias y
  e2e. Este repositorio tiene precedente de algo que se leía bien en el código y
  se veía mal en pantalla — las columnas por dimensión, encontradas el 18/09 con
  un navegador delante.

---

## Enlaces

- [[02-Backend/reportes-rentabilidad]] — el límite del endpoint y el prorrateo
- [[02-Backend/reportes-dimensiones]] — las dimensiones de costo
- [[02-Backend/reportes-por-razon-social]] — la sexta, y el criterio de nombrar
- [[02-Backend/comercial-propuestas-campanas]] — de dónde sale el snapshot
- [[06-Operacion/zonas-de-riesgo]] — por qué la escritura del precio no se toca
