---
tipo: contrato
estado: verificado
actualizado: 2026-10-05
tags: [backend, precios, paquetes, promociones, propuestas, dinero, snapshot, rls, reportes]
archivos:
  - db/migrations/20260928_paquete_cerrado.sql
  - apps/web/lib/paquete.ts
  - apps/web/lib/server/paquetes-repo.ts
  - apps/web/lib/server/paquetes-controller.ts
  - apps/web/app/api/paquetes/route.ts
  - apps/web/app/api/paquetes/[id]/route.ts
  - apps/web/app/api/propuestas/[id]/paquete/route.ts
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/campanas-repo.ts
  - apps/web/lib/server/reportes-repo.ts
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/data/paquetes-api.ts
  - apps/web/components/demo/paquetes/GestionPaquetes.tsx
---

# El paquete cerrado

**ADR 0039, Fase 4.** «Estas cinco pantallas, prime, un mes: **180 000**.» El
último escalón de la cadena de precio, y **el único que no es un factor**:

```
tarifa base = f(pantalla, unidad, franja, fecha)     ← Fase 1
      ×  descuento por volumen                       ← Fase 2
      │       …O BIEN PRECIO DE PAQUETE,             ← esta nota
      │          que SUSTITUYE la suma entera
      ×  descuento comercial (con su tope)
      ×  código promocional                          ← Fase 3
      ×  (1 − comisión de agencia)
      =  neto
```

Las fases 2 y 3 **modifican** un precio ya resuelto. Un paquete **lo sustituye**.
Por eso rompe la aritmética de todas las capas anteriores y por eso el ADR lo
puso el último.

> [!danger] LA MIGRACIÓN NO ESTÁ FUSIONADA
> `20260928_paquete_cerrado.sql` está escrita y probada contra bases desechables,
> pero **el dueño pidió el 2026-09-28 aprobar todo cambio de esquema antes de que
> aterrice**. Lo detenido es la fusión, no el código.
>
> **2026-10-05 · ya está FUSIONADA.** `8e913662` («paquete cerrado -- estas
> cinco pantallas, un mes, 180 000») es ancestro de `main`. El arreglo TOPE-PAQ
> de §4 (`b2d30d50`) **no** lo es todavía: vive en esta rama. El recuadro se
> conserva como historia.

> [!note] 2026-10-05 · dónde entra, en el código
> `armarPropuesta` (`apps/web/lib/server/propuestas-repo.ts:142`):
> `descuentoVolumenMonto = paquete ? 0 : …` (`:181`) y
> `brutoConVolumen = paquete ? paquete.precio : vol.brutoConVolumen` (`:182`).
> Sobre ese número se calcula después el comercial (`:196`) y, si el paquete lo
> admite, el cupón (`:215-219`). El presupuesto **aprobado** de un paquete es su
> precio entero aunque se acepten menos pantallas (`:237`). El congelado repite
> la misma cuenta (`:436`) y reparte con `repartirPaquete`
> (`apps/web/lib/paquete.ts:119`, llamado en `propuestas-repo.ts:441`).

---

## 1 · Qué es un paquete, y por qué es una entidad del catálogo

Un paquete es **una fila del catálogo de la organización**: un nombre, un
conjunto de pantallas y un precio del conjunto. No es un precio suelto tecleado
en una cotización.

**Por qué no el precio suelto: porque eso ya existe.** Quien quiere cerrar una
propuesta en 180 000 teclea el descuento comercial que haga falta. Una fase
entera para escribir el mismo número de otra forma no entrega nada — y lo
entregaría por el lado equivocado, porque ese precio saldría del navegador
(hallazgo **B40**) ampliado a la venta completa.

Con la entidad se ganan tres cosas de golpe:

| Se gana | Por qué importa |
|---|---|
| El precio sale de la **base**, bajo RLS | Mismo candado que la Fase 2 le puso al volumen. Por la API solo viaja el `paqueteId` |
| La bandera «admite código» es **por paquete** | Regla 2 del ADR. Una bandera solo puede colgar de algo que exista |
| «Paquete Periférico» es una frase del oficio | El mismo argumento con el que el ADR 0039 descartó los multiplicadores |

**Lo que cuesta:** hay que capturar el paquete antes de poder venderlo. Un trato
cerrado por teléfono no se cotiza sin pasar por el catálogo. Es deliberado: ese
es el mismo camino por el que se podía regalar el 90 % antes del tope del 28/09.

### El paquete aplica a la propuesta ENTERA

No hay líneas «dentro» y líneas «fuera». El ADR dice que el precio *sustituye la
suma entera*, y entera es entera. Una propuesta mixta obligaría a marcar línea
por línea, a repartir solo entre esas, y a que el tope, el volumen y el cupón
supieran distinguir las dos mitades: **cuatro sitios más donde una línea puede
quedar del lado que no era**, y ese fallo no da error, produce un importe
plausible. Un trato mixto se cotiza con dos propuestas, que además es como se
firma.

> [!question] Preguntado al dueño
> No se puede vender «el paquete más una pantalla suelta» en un solo documento.

---

## 2 · El esquema

Tres tablas nuevas, las tres con `tenant_id`, RLS `enable` + `force` y política
cerrada por los **dos** lados (regla 3 del ADR 0039).

| Tabla | Qué guarda |
|---|---|
| `paquetes` | El catálogo: nombre, `precio_cerrado`, `admite_codigo`, `activo` |
| `paquete_sitios` | De qué pantallas se compone cada uno |
| `paquete_aplicaciones` | El **enlace vivo** propuesta ↔ paquete: quién, cuándo, cuál |

Y **cinco columnas en `propuestas`** —el congelado— más una en `reservas`:

| Columna | Qué es |
|---|---|
| `propuestas.paquete_nombre` | Congelado al aplicar. `NULL` = sin paquete |
| `propuestas.paquete_precio` | **El precio de la venta.** Sustituye la suma de las listas |
| `propuestas.paquete_admite_codigo` | Regla 2, congelada. Nace en `false` |
| `propuestas.paquete_aplicado_en` | El momento |
| `propuestas.paquete_composicion` | `jsonb` con los `sitio_id` **del día en que se aplicó** |
| `reservas.paquete_parte` | La parte que le tocó a esa pantalla |

**Por qué el enlace vive aparte del precio**, exactamente como `canjes_codigo` en
la Fase 3: así **borrar un paquete se lleva el enlace y no mueve un peso de
ninguna venta**. El precio ya no está en el paquete, está en la propuesta.

Restricciones que **manda la base** y no la aplicación:

- `precio_cerrado > 0` **y entero de pesos** (`= trunc(...)`): el reparto es en
  pesos y un centavo repartido entre cinco no se puede explicar.
- `unique (tenant_id, lower(btrim(nombre)))`: «Periférico» y «PERIFERICO» serían
  dos precios para lo que quien vende lee como una sola cosa.
- `unique (propuesta_id)` en `paquete_aplicaciones`: **un solo paquete por
  propuesta**, y es lo único que sirve contra un doble clic.
- `propuestas_paquete_pareja_ck`: el bloque congelado **viaja junto o no viaja**.
  Un precio sin nombre es un importe que nadie puede auditar.
- FK **compuestas con el tenant** en las tres relaciones. Aquí la fuga de R2 no
  es de lectura: es ponerle a una venta propia el tarifario de otra empresa.

---

## 3 · El reparto — la parte difícil

El precio del paquete **hay que repartirlo** entre sus pantallas, aunque el
cliente compre un conjunto: el reporte de rentabilidad atribuye ingreso **por
pantalla** (`reservas.precio`) y el contrato del arrendador cuelga de cada una.
Un paquete cuyo precio se quedara en la cabecera dejaría cinco pantallas con
ingreso cero y una renta que pagar.

**A prorrata de la tarifa de lista**, no a partes iguales: a partes iguales, una
pantalla de prime de 500 000 y una de barrio de 5 000 recibirían lo mismo, y el
reporte diría que la de barrio es un negocio redondo **con un número que lo
inventó el reparto, no la venta**.

### Y la suma cuadra AL PESO, por construcción

Método del **mayor resto** (Hare), en `lib/paquete.ts`:

1. `exacto_i = total × peso_i / Σpesos`
2. `base_i = floor(exacto_i)`
3. `resto = total − Σbase_i`
4. ese `resto` se reparte **de uno en uno** entre las líneas de mayor fracción.

La suma es `Σbase + resto = total`, **exacta por construcción**, no por suerte.
Es lo que lo separa de la alternativa evidente —`Math.round` por línea—, que no
cuadra: 180 000 entre siete pantallas iguales da siete veces 25 714 y un total de
**179 998**. Dos pesos que faltan en el importe que el cliente aceptó.

El desempate es **determinista** (fracción mayor → peso mayor → orden): dos
lecturas de la misma venta tienen que dar el mismo reparto, porque una se congela
en el snapshot y otra alimenta la campaña.

| Borde | Qué hace | Por qué |
|---|---|---|
| Sin líneas | Reparto vacío | No hay dónde poner el dinero |
| `Σpesos ≤ 0` | **Partes iguales** | `0/0` daría `NaN`, y `numeric` lo propaga con 200 OK |
| Un peso ilegible | Cuenta **cero** | No contamina a los demás |
| Un total ilegible | Se lee **cero** | Nunca `NaN` |

---

## 4 · El paquete es PRECIO FINAL (regla 2 del ADR)

Por omisión **no admite nada encima**:

- **El volumen NUNCA**, ni con la bandera encendida: el precio del conjunto ya lo
  lleva dentro, y aplicarlo sería descontar dos veces lo mismo. Las líneas
  **conservan** su `descuento_volumen_pct` —no se borra nada—, solo se deja de
  aplicar: por eso quitar el paquete devuelve la venta exactamente a como estaba.
- **El código promocional solo si `admite_codigo`**, que **nace apagada**.
  Aplicar un paquete que no lo admite sobre una propuesta que ya tiene cupón se
  **rechaza con una frase**; y la aritmética lo anula además como segunda red.
- **El descuento comercial SÍ se sigue aplicando**, y está preguntado al dueño.
  Se queda porque es lo único que el vendedor negocia y ya está acotado por el
  tope de la organización.

**Y el volumen deja de contar contra el tope** cuando hay paquete: si contara, a
un vendedor le rechazarían un descuento por un volumen que el cliente nunca
recibió, con un mensaje que nombraría un porcentaje ausente de su cotización.

> [!danger] TOPE-PAQ · 2026-10-05 · **quitar el paquete se NIEGA si el volumen
> devuelto deja la venta por encima del tope**
> La regla de arriba tenía un reverso que nadie revisaba. Con paquete, el
> vendedor guarda un 15 % comercial contra un tope del 20 % aunque las líneas
> lleven un 10 % de volumen, porque el volumen no cuenta. **Al quitar el
> paquete el volumen vuelve** —es justo lo que promete «devuelve la venta a como
> estaba»— y la venta queda en `1 − 0,85 × 0,90 = 23,5 %` regalado contra un
> techo de 20. `quitarPaquete` solo limpiaba las cinco columnas, y **la
> aprobación (`cambiarEstatusPropuesta`) y la aceptación por liga pública
> (`aceptarPropuestaPublica`) no miran el tope**: se aprobaba y se congelaba en
> el snapshot por encima de lo autorizado.
>
> **Se cierra donde nace el estado malo, no en la aprobación.** Es el criterio
> de TOPE-01: *por encima del tope no se guarda nada*. Revalidar al aprobar
> habría dejado pasar la aceptación del cliente por la liga, que no pasa por
> ese camino, y habría dejado la propuesta enviada con un precio que luego no
> se puede firmar. `quitarPaquete` relee dentro de su transacción el descuento
> comercial y el volumen de las líneas y los pasa por la misma
> `descuentoDentroDelTope` que la edición; si no cabe, `PaqueteImposible`
> (409) con el mensaje del tope y la salida: **baja primero el descuento
> comercial**. Nada se toca: ni el enlace ni las columnas.
>
> **Con 0 % comercial siempre se deja quitar**, aunque el volumen solo pase el
> tope: no hay discreción del vendedor que acotar, la propuesta queda igual
> que una recién creada con esas líneas, y negarse dejaría el paquete pegado
> sin salida. Es el caso «tope por debajo de la escala propia» de
> [[02-Backend/descuento-por-volumen]] §3, y se arregla en Administración.
> Pruebas: `paquetes-aplicar.test.ts` bloque 4.
>
> *(Verificado el 05/10: `quitarPaquete` en `apps/web/lib/server/paquetes-repo.ts:368`,
> la comprobación en `:428`; commit `b2d30d50`, en esta rama y aún no en `main`.)*

---

## 5 · Quitar una pantalla de un paquete ya cotizado

La tercera pregunta de la fase. Tres respuestas posibles y se eligió la última:

| Respuesta | Por qué NO / SÍ |
|---|---|
| Se recalcula el precio hacia abajo | **No.** Es lo que «precio cerrado» significa que no pasa, y bajaría el importe en silencio |
| Se rompe (no se deja quitar) | **No.** Una cotización en borrador tiene que poder editarse |
| **Se avisa, y el precio NO se mueve** | **Sí.** El reparto se recalcula sobre las que quedan y la propuesta **lo dice** |

> [!danger] Lo que cuesta, con todas las letras
> **Quitar una pantalla de un paquete de 180 000 sigue costando 180 000.** Es lo
> correcto y es sorprendente, así que el sistema no puede callárselo:
> `avisoPaqueteIncompleto` produce la frase, se enseña en la propuesta y **se
> congela dentro del snapshot** (`paquete.avisoComposicion`).

Se comparan los **conjuntos**, no los tamaños: cambiar una pantalla por otra deja
el número igual y la venta distinta.

---

## 6 · El congelado (invariante 4 del ADR)

Al **aplicar** se copian a `propuestas` el nombre, el precio, la bandera, el
momento y la composición. Al **aprobar**, el snapshot los vuelve a congelar **sin
releer `paquetes`**. Dos redes, igual que el cupón y al revés que la franja, que
sí relee su catálogo para congelar su nombre.

El bloque `paquete` del snapshot lleva **seis cosas y ninguna sobra**: `nombre`,
`precio`, `admiteCodigo`, `aplicadoEn`, `composicion` —con qué pantallas se
cotizó— y `sitios` —**el reparto**, qué le tocó a cada una—.

**Medido en e2e:** se vende un paquete de 30 000 sobre dos pantallas de 45 000 y
15 000 de lista, se aprueba, el dueño sube el precio a 999 999 **y después lo
borra**, y ni el snapshot ni el precio de la propuesta se mueven un peso.

### `ESQUEMA_SNAPSHOT` sube a 3

Y no por añadir campos opcionales. En las formas 1 y 2, `porSitio[].neto`
**siempre** derivaba de `porSitio[].lista` multiplicándola por factores, y
`lib/data/reportes.ts` vive de esa garantía. Con un paquete deja de derivar de
ella. **Romper una invariante ES cambiar la forma**, aunque todos los campos
nuevos sean opcionales, y un lector escrito para la forma 2 no calcularía de
menos: calcularía mal.

---

## 7 · El reporte «publicada vs neta»: el paquete sale con RAYA

`porSitio[]` lleva `paquete: true` cuando la venta vino de un paquete, y
`lib/data/reportes.ts` **deja esas reservas fuera de la comparación**, con el
mismo centinela `null` que ya usaba para la ambigüedad (`dePaquete`, declarado
en `apps/web/lib/data/reportes.ts:429-435`; el centinela `DE_PAQUETE = null`, en
`:1194`).

**Por qué sacarlas y no es una rendición:** el reporte llama a la diferencia «el
descuento comercial MÁS la comisión de agencia», y con un paquete esa frase es
falsa — el neto salió de repartir un precio de conjunto. Y hay un caso que lo
cierra sin discusión: **un paquete se puede vender POR ENCIMA de la suma de las
listas** (un conjunto premium), y ahí la diferencia saldría **negativa**, que se
lee como haber cobrado por encima de la tarifa publicada.

La consecuencia se dice: el ingreso del paquete cuenta en `ingresoSinTarifa`, así
que **la cobertura baja cuando se venden paquetes**. Es correcto: hay menos venta
comparable. La **dimensión por vendedor** hereda el mismo guard, y ahí importa
igual: a nadie se le mide la mano con un descuento que decidió el dueño.

---

## 8 · Los permisos, y por qué son dos

| Operación | Ruta | Permiso |
|---|---|---|
| Crear/editar/borrar un paquete | `/api/paquetes` | `exigirCambioSensible('precios','crear')` |
| Aplicarlo o quitarlo de una propuesta | `/api/propuestas/:id/paquete` | `comercial.crear` |

> [!note] 2026-10-05 · el módulo ya no es `inventario`
> Esta tabla decía `exigirCambioSensible('inventario','crear')`. Verificado hoy:
> `app/api/paquetes/route.ts:44` y `app/api/paquetes/[id]/route.ts:32,49` exigen
> `exigirCambioSensible('precios','crear')`, y la lista `exigir('precios','ver')`
> (`route.ts:34`). Pasó a `comercial` con `bd08f388` (29/09) y a `precios` con
> `276c7237` ([[roles-de-venta]]). Aplicar y quitar siguen en `comercial.crear`
> (`app/api/propuestas/[id]/paquete/route.ts:40,59`). El comentario de esa misma
> ruta (`:36`) todavía dice `inventario`: es viejo, el código manda. La
> separación en dos permisos —lo que defiende esta sección— sigue en pie.

Si fueran el mismo, quien vende se crearía su propio paquete al precio que
quisiera y se lo aplicaría — **el tope de descuento del 28/09 evadido por
completo**, y sin disparar ninguna alarma de descuento, porque un paquete no ES
un descuento.

---

## 9 · Lo que NO hace esta fase

- **No arregla B40** (la cadena de precio que vive en el navegador): es la
  decisión D11, del dueño. Pero **tampoco lo amplía** — aquí solo viaja el
  `paqueteId`. *(El 2026-10-01 PRECIO-01 lo cerró para la tarifa BASE de cada
  línea. El paquete no cambia: sigue sustituyendo la suma de las listas, y
  aplicarlo no reescribe ninguna línea — ver [[comercial-propuestas-campanas]].)*
- **No arregla el defecto del volumen en el respaldo de presupuesto** de
  `campanas-repo` (el camino sin snapshot), que viene de la Fase 2 y sigue
  señalado. El **paquete sí entra** en ese respaldo, porque dejarlo fuera habría
  hecho el defecto cualitativamente peor: no una desviación porcentual, sino un
  número entero distinto. *(Sigue así el 05/10: `apps/web/lib/server/campanas-repo.ts:958-982`
  —el aviso y el `paquete ? … : items.reduce(…)`—. Ojo con lo que dice el
  código ahí: sin paquete ese respaldo ignora **volumen y cupón**.)*
- **No admite propuestas mixtas** (paquete + pantallas sueltas).

---

## Enlaces

- [[02-Backend/_indice]] · [[02-Backend/comercial-propuestas-campanas]]
- [[02-Backend/descuento-por-volumen]] · [[02-Backend/codigo-promocional]]
- [[02-Backend/rejilla-franja-y-temporada]]
- [[04-Datos/esquema]] · [[04-Datos/migraciones]]
- [[05-Flujos/flujo-propuesta-a-campana]]
- [[06-Operacion/zonas-de-riesgo]]
