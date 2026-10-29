---
tipo: modulo
estado: verificado
actualizado: 2026-10-29
tags: [backend, comercial, propuestas, campanas, amarillo, precio, extension, contrato]
archivos:
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/server/propuestas-controller.ts
  - apps/web/lib/tarifa-calculada.ts
  - apps/web/lib/calculadora-spots.ts
  - apps/web/lib/server/tarifas-repo.ts
  - db/migrations/20261007_calculadora_spots.sql
  - apps/web/app/api/propuestas/route.ts
  - apps/web/app/(app)/(shell)/propuestas/page.tsx
  - db/migrations/20261006_precio_ajustado_por_gerente.sql
  - apps/web/lib/descuento.ts
  - apps/web/lib/server/config-repo.ts
  - apps/web/app/api/propuestas/[id]/route.ts
  - db/migrations/20260928_tope_descuento_propuestas.sql
  - apps/web/lib/server/campanas-repo.ts
  - apps/web/lib/neto-de-linea.ts
  - apps/web/lib/server/campanas-controller.ts
  - apps/web/lib/server/creativos-repo.ts
  - apps/web/lib/server/reservas-controller.ts
  - apps/web/lib/reparto-creativos.ts
  - apps/web/lib/periodos.ts
  - apps/web/lib/folio-venta.ts
  - apps/web/lib/modalidades.ts
  - apps/web/app/api/campanas/[id]/extender/route.ts
  - db/migrations/20261029_campana_extensiones.sql
  - apps/web/components/demo/campanas/ExtenderCampanaDialog.tsx
  - apps/web/components/demo/campanas/ExtensionesCampana.tsx
  - apps/web/lib/data/types.ts
  - apps/web/app/(app)/(shell)/propuestas/[id]/page.tsx
  - apps/web/app/(app)/(shell)/campanas/[id]/page.tsx
  - apps/web/app/(app)/(shell)/campanas/page.tsx
  - apps/web/app/(app)/(shell)/creativos/page.tsx
  - apps/web/components/demo/campanas/FranjaProgramadaCampana.tsx
  - apps/web/components/demo/campanas/IndicadoresCampanas.tsx
  - apps/web/components/demo/campanas/ResumenCampana.tsx
  - apps/web/components/demo/campanas/ListasCampana.tsx
  - apps/web/components/demo/campanas/CandadoPanel.tsx
  - apps/web/lib/server/programacion-repo.ts
  - apps/web/lib/server/contratos-sitio.ts
  - apps/web/lib/server/portal-repo.ts
  - apps/web/lib/server/paquetes-repo.ts
  - db/migrations/20261029_propuestas_condiciones_vigencia_vendedor.sql
  - apps/web/lib/propuesta-vigencia.ts
  - apps/web/components/demo/propuestas/BloqueCondicionesVigencia.tsx
  - apps/web/app/(app)/p/[id]/page.tsx
  - apps/web/app/(app)/propuesta/[id]/page.tsx
  - apps/web/components/demo/propuestas/DocumentoPropuestaCliente.tsx
  - apps/web/app/api/propuestas/[id]/route.ts
---

# Comercial: propuestas, reservas y campañas

## El recorrido

```
Cliente → Propuesta (folio, ítems, comisión) → aprobada
       → Campaña (folio) → Reservas (sitio × fechas) → Creativos → publicación
```

Desde el 07/10 la campaña nacida de una propuesta lleva **el folio de la
propuesta** (`PR-2026-0042`), y cada extensión le suma un tramo: `.1`, `.2`…
Ver «CPS, CPM y el folio de venta» más abajo.

## Archivos

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `campanas-repo.ts` | 1541 | Clientes, campañas, reservas, confirmar/extender (con contrato) |
| `propuestas-repo.ts` | 1461 | Propuestas, ítems, liga pública, aceptación |
| `lib/descuento.ts` | 321 | Descuento válido **y bajo el tope**, y el texto de bitácora (puro, con tests) |
| `creativos-repo.ts` | 366 | Alta, validación y asignación de creativos |
| `propuestas-controller.ts` | 428 | Validación zod |
| `campanas-controller.ts` | 92 | Validación zod |
| `lib/reparto-creativos.ts` | 72 | Reparto puro (con tests) |

> Líneas medidas con `wc -l` el 2026-10-05. `propuestas-repo.ts` y
> `propuestas-controller.ts` más que duplicaron desde la tabla anterior
> (638 y 121) con la cadena de precio del ADR 0039, PRECIO-01 y la calculadora.

## El método del divisor

El precio **neto** sale de dividir el **bruto** entre `(1 − comisión)`
(`divisorDeComision`, `lib/data/derive.ts`). La **comisión de agencia** y el
**descuento comercial** son cosas distintas y viven en columnas distintas
(`propuestas.comision_pct` vs `propuestas.descuento_pct`). Confundirlos cambia
lo que se le cobra al cliente.

En la ficha de la propuesta el descuento comercial se muestra **siempre con dos
decimales y por omisión «0.00»** (pedido del dueño, 06/10): el campo vacío o un
«0» a secas hacían dudar de si faltaba el dato. Admite centésimas (`step 0.01`),
que es lo que guarda la columna `numeric(5,2)`; si se borra el campo vuelve a
0.00. Formato en `pctConDosDecimales` (`lib/descuento-comercial.ts`).

## Reglas codificadas

| Regla | Dónde |
|---|---|
| **No reservar con contrato incompleto** (ADR 0003) | `exigirContratoCompleto()` (`contratos-sitio.ts:234`), llamada desde `campanas-repo.ts:467` y `:915` |
| **Propuesta inmutable** una vez enviada | `PropuestaError` → 409 (`propuestas-repo.ts:63`) |
| **Gate de negociación**: agencia con negociación sin validar bloquea crear/aprobar | `agenciaBloqueada()` (`propuestas-repo.ts:67`) |
| **Cupo de clientes por pantalla** (ADR 0008) | `campanas-repo.cupo-clientes.test.ts` |
| **Tope de descuento por organización** (TOPE-01) | `descuentoDentroDelTope()` (`lib/descuento.ts`) |
| **Generar campaña es idempotente** (hallazgo A5) | `flujo-critico.e2e.test.ts` |
| **No enviar a dominio sin creativo** (hallazgo M14) | `campanas-repo.ts` |
| Reserva `TENTATIVA` caduca sola por TTL | `reservas.expira_en` (`20260706_reserva_ttl.sql`) |

### El cupo global se lee con filtro de organización

`cupoGlobalClientes()` (`campanas-repo.ts:317-335`, comentario y función) lee
`config_negocio.max_clientes_pantalla` **filtrando por `tenant_id`** contra
`current_setting('app.tenant_id', true)`, no solo apoyándose en la RLS.

Hasta el 13/08 la consulta era un `select ... limit 1` **sin `where`**: hoy la
salvaba el único llamador (`reservar()`, `:357`; la llamada está en `:449`), que corre dentro de una
transacción con el tenant ya fijado. Es la segunda capa que el resto del repo sí
aplica, y aquí faltaba — un `limit 1` sin `where` devuelve la fila de
**cualquier** organización en cuanto alguien llame a la función desde otra
transacción, y ese fallo no da error: contesta en silencio ([[multi-tenancy-y-rls]], R2).

Sin GUC la consulta devuelve `null` = «sin límite», que es como nace la
instalación según el ADR 0008. La firma no cambió: las tres unitarias que la
llaman con un cliente falso siguen intactas.

### El descuento tiene un techo, y es de cada organización (TOPE-01)

Hasta el **2026-09-28** el único límite del descuento era
`Math.max(0, Math.min(100, n))` en `lib/descuento.ts`. Consecuencias medidas ese
día, y las tres a la vez:

- **el 90 % pasaba liso** — el único freno era el 100 % *exacto*, y ése no mira
  el porcentaje: es `PropuestaCeroError`, que mira el **total**;
- lo podía hacer **cualquier rol COMERCIAL** (`app/api/propuestas/[id]/route.ts`
  pide `exigir('comercial','crear')`);
- **sin contraseña**: propuestas no está entre las rutas con
  `exigirCambioSensible`. Cambiar la renta de una pantalla sí la pedía; regalar
  el 80 % de una venta, no.

Ahora `config_negocio.tope_descuento_pct` —una fila por tenant, ADR 0011— guarda
el techo, y `actualizarPropuesta()` lo aplica con
`descuentoDentroDelTope(valor, await topeDescuentoDelTenant())`.

**Tres decisiones que conviene no deshacer sin leer esto:**

1. **El valor por omisión es 100**, o sea «sin tope». Es el comportamiento
   exacto de antes, así que la migración no invalida ni una propuesta viva.
   Mismo criterio que el cupo de clientes del ADR 0008: la regla **nace
   apagada**. Sembrar un 20 o un 30 «prudente» habría convertido de golpe en
   inválidas las propuestas que ya lo superan, y ésa es una decisión de cada
   dueño.
2. **La validación es para lo que se ESCRIBE, no para lo ya escrito.** Bajar el
   tope al 10 deja intactas las propuestas al 40 y se pueden seguir editando;
   lo que ya no se puede es volver a teclear ese 40. Es la misma regla que
   CFG-01 con un plazo de cobranza retirado.
3. **Recortar y rechazar son verbos distintos.** `descuentoValido` recorta
   (250 → 100) y el tope **rechaza**: guardar en silencio un 40 % cuando se
   pidió un 70 % dejaría en la base un número que nadie tecleó, sobre dinero y
   con 200 OK.

**El tope se lee CON contexto de tenant** — `topeDescuentoDelTenant()`
(`config-repo.ts`) va por `obtenerConfigRow()` para heredar su
`where tenant_id = $1`, igual que `plazosCobranzaDelTenant()` y
`costosOtDelTenant()`. Un `qRaw` aquí haría que el techo de una empresa lo
decidiera la configuración de otra, **sin dar ningún error** ([[multi-tenancy-y-rls]], R2).
Lo prueban las **dos direcciones** en `lib/test/tope-descuento.e2e.test.ts`: el
40 % es legal en beta e ilegal en alfa, a la vez y contra el mismo Postgres.

**Cambiar el tope pide la contraseña; poner descuento no.** El candado
(`exigirDesbloqueo`, ADR 0009) se aplica **solo a ese campo** dentro de
`PATCH /api/config`, no a la ruta entera: el tope es el *control*, y sin esto
quien administra lo sube con un clic y a continuación regala la venta —el
candado sobre el descuento no serviría de nada—. El resto de la pantalla de
Administración (loop, IVA, plazos…) sigue guardándose sin fricción.

**Y la bitácora dice cuánto (TOPE-02).** `PATCH /api/propuestas/[id]` escribía
`Actualizó propuesta (v2)` sin decir qué descuento se puso; al **aprobar** sí
queda el importe, pero para entonces ya no se sabe quién lo puso.
`textoBitacoraPropuesta()` escribe ahora «Puso 22 % de descuento en la propuesta
(v2)» — y **solo cuando el descuento cambió de verdad**, no en cada guardado,
porque anotarlo siempre haría inútil el filtro por persona de Actividad.

> [!note] 2026-10-05 · quitar un paquete también pasa por el tope
> Con paquete aplicado el volumen no cuenta contra el tope (PAQ-01); al quitarlo
> volvía a sumarse y nadie lo revisaba. Desde `b2d30d50`, `quitarPaquete`
> (`paquetes-repo.ts:376`) recalcula y pasa por el mismo `descuentoDentroDelTope`;
> si no cabe, 409 y no se guarda nada. Detalle en [[paquete-cerrado]].

## La liga pública de la propuesta

`propuestas.token_publico` habilita `/p/[id]` sin sesión. El cliente puede
**aceptar** desde ahí, y eso se registra como medio-contrato:
`aceptado_en`, `aceptado_por`, `aceptado_ip` (`db/schema.sql:358-360`).

El tenant de esas peticiones lo resuelve Postgres con
`propuesta_tenant_por_token()`, nunca el cliente. Ver [[multi-tenancy-y-rls]].

**DASH-REF (26/10).** `armarPropuesta` devuelve además `aprobadaEn`,
`rechazadaEn` y `vendedorId` (de `usuario_id`), que el Dashboard usa para lo
ganado en el mes y por vendedor ([[03-Frontend/dashboard-inicio]]). La liga
pública arma su respuesta **campo por campo** en `obtenerPropuestaPublica`, así
que no los lleva; lo fija la sección DASH-REF de
`lib/test/vendedor-en-propuesta.e2e.test.ts`.

## Creativos

Un creativo puede ser **imagen** o **código HTML** (`creatividades.codigo`).

> [!danger] 2026-09-30 · subir una imagen fallaba con casi cualquier foto
> El dueño: *«en campaña está el error de fetch para subir imágenes»*. Las dos
> pantallas que suben imágenes (Creativos y la ficha de campaña) la envuelven
> con `imagenAHtml()` —el player DOOH necesita HTML adaptable— y la envoltura
> lleva la imagen **dos veces** en base64 (fondo difuminado y frente). Viaja por
> `codigo`, cuyo límite era 2 MB: la foto más grande que entraba rondaba los
> **700 KB**, aunque la pantalla prometía 5 MB. Y en producción nginx corta en
> **12 MB** (`client_max_body_size 12M`): una de 5 MB envuelta (~14 MB) moría
> antes de llegar a la app, como un error de red.
>
> **Ahora** (`creativos-controller.ts`): si el HTML es EXACTAMENTE la envoltura
> de la app —se regenera con `imagenAHtml()` y se compara byte a byte—, la
> imagen de dentro se valida **como imagen** (tipo real por magic bytes) con
> tope `IMAGEN_CREATIVO_MAX_MB` = **4 MB** (`lib/creativo-html.ts`), y el HTML
> puede llegar a 11 MB, por debajo de nginx. Un HTML escrito a mano, o una
> envoltura retocada, sigue con 2 MB. Las dos pantallas avisan con el mismo
> tope. Pruebas: `lib/server/creativos-imagen-envuelta.test.ts`.

> [!note] 2026-09-30 · la pantalla de Creativos es solo de pantallas DIGITALES
> Pedido del dueño: *«en creativos no deben de salir ninguna campaña de
> pantalla fija»*. `soloDigitales()` (`lib/creativos-digitales.ts`, con
> pruebas): digital es `tipoMedio === 'PANTALLA_DIGITAL'` —la regla de
> `esDigital()` en `lib/data/derive.ts`—, NO `spotsReservados != null` (una
> digital sin slots capturados lo tiene a null). Una campaña toda fija no sale;
> una mixta sale con solo sus reservas digitales; una sin reservas se queda. El
> creativo de una lona se sigue gestionando desde la ficha de su campaña.

> [!warning] Tres formas de guardar lo mismo conviven en los datos reales
> La UI decidía si un creativo era código o imagen **mirando el principio del
> archivo**. Al dejar de mandar el arte en el payload, eso dejó de funcionar y
> aparecieron tres representaciones distintas; ocho creativos se habrían dejado
> de ver. Ahora la decisión se toma por el **tipo declarado**
> (`docs/Registro_Cambios.md`, entrada del 06/08). `lib/creativo-html.ts` tiene
> las dos mitades de la convención — `imagenAHtml()` y `imagenDeHtml()` — juntas
> a propósito.

El **reparto** a todas las pantallas está en `lib/reparto-creativos.ts` (puro,
con tests) y se invoca desde `POST /api/campanas/[id]/creativos/repartir`.

## Qué se vendió, no solo cuánto — `unidad`, `cantidad` y `spots_por_dia`

`propuesta_items` y `reservas` guardan CÓMO se contrató desde
`20260721_propuesta_unidad_spots.sql`: `unidad` (mensual · catorcenal · semanal ·
diaria · spot · hora · cpm), `cantidad`, `tarifa_unitaria` y `spots_por_dia`.
Desde el 07/10 «Por spot» se lee **CPS · costo por salida** y su cantidad
**salidas**; la clave guardada sigue siendo `spot`.

Se pueden vender **50 spots** —en Propuestas eliges «Por spot», tecleas 50 y el
precio sale `tarifa_spot × 50`, recalculado en el servidor— y hasta el
**2026-09-28** ese 50 **moría en la base**: el detalle de la propuesta enseñaba
sitio, renta y precio, `rowToReserva` no exponía los cuatro campos y la ficha de
campaña pintaba `{precio}/mes` para TODA reserva, incluidas las vendidas por
spot. Un importe sin su unidad no dice nada: «$60,000» puede ser un mes o
cincuenta spots.

> [!danger] `cantidad` y `spots_por_dia` son DOS NÚMEROS DISTINTOS
> - **`cantidad`** → cuántas unidades se contratan. Es lo que MULTIPLICA la
>   tarifa. Es **precio**.
> - **`spots_por_dia`** → cuántas veces al día se muestra la pieza. Es
>   **programación**, y no entra en ningún precio.
>
> Confundirlos fue **DATA-02** (auditoría del 26/08): se escribía el mismo valor
> en las dos columnas, así que una propuesta mensual normal dejaba
> `spots_reservados` en `null` y `reparto-creativos.ts:56-72` (`asignacionDePantalla`) leía ese null como
> «es una lona» — una pantalla digital repartida como si fuera impresa. El
> arreglo de la ESCRITURA vive en `campanas-repo.ts` (inserción desde propuesta);
> el de la LECTURA es de hoy.

Y hay un **tercero** que se confunde con los dos: **`spots_reservados`** son los
SLOTS que la reserva retiene, que tampoco es ninguno de los otros.

### Cómo se etiquetan, y por qué con vocabularios distintos

Los textos los arma `lib/periodos.ts`, que es puro y **sí se prueba** — sin jsdom,
una decisión escrita dentro de un `.tsx` no la ve nadie:

| Función | Da | Dónde |
|---|---|---|
| `etiquetaCantidad(unidad, cantidad)` | `50 spots` · `1 mes` | el QUÉ, sin precio |
| `resumenContratacion({unidad, cantidad, tarifaUnitaria})` | `50 spots × $ 1,200.00` | detalle de propuesta |
| `resumenReserva({unidad, cantidad, precio})` | `50 spots · $ 54,000.00` | ficha de campaña |
| `etiquetaFrecuencia(spotsPorDia)` | `12 pases al día`, o `null` | debajo, en las dos |

**«Pases al día» y no «spots»**, deliberadamente: es lo único que impide que
«50 spots» y «12 spots» convivan en la misma ficha significando cosas distintas.

> [!warning] En la CAMPAÑA la multiplicación ya no cuadra, y por eso hay dos funciones
> En `propuesta_items` el precio **es** `tarifa_unitaria × cantidad`
> (`periodos.ts` → `precioItem`), así que escribir la multiplicación cuadra con
> el importe de al lado.
>
> En `reservas` **no**: la reserva nacida de una propuesta guarda el **neto**
> —`lista × (1−descuento) × (1−comisión)`— mientras `tarifa_unitaria` se copió
> tal cual de la propuesta, que es la de **lista**. Un «50 spots × $ 1,200.00»
> junto a «$ 54,000.00» enseñaría una cuenta que no da, y se leería como un
> defecto del sistema cuando es el descuento haciendo su trabajo. `resumenReserva`
> pone un `·` y no un `×`, y hay una prueba que lo vigila.

**Sin capturar no se pinta**: `tarifaUnitaria` en 0 y `spotsPorDia` en `null` o 0
se omiten. Un «× $ 0.00» afirma que la unidad es gratis; un «0 pases al día»
afirma que la pieza no sale nunca. Y `spots_por_dia` está en NULL en toda la
producción de hoy.

**Fuera de alcance:** los conceptos en la factura. Sigue siendo **un importe
único sin desglose**; darle conceptos es tabla nueva, migración y dinero.

## Los meses son de CALENDARIO (02/10)

Decisión del dueño, a raíz de «elijo mes 2 y se los resta en vez de sumar» en
Nueva propuesta. Hasta el 2026-10-02 `lib/periodos.ts` contaba **1 mes = 30
días** en DOS sitios a la vez:

- `fechaFinDesde` (la fecha «Hasta» de «Duración de la campaña»): 05/10 + 2 meses
  terminaba el **03/12**. El día de fin retrocedía con cada mes, y eso es lo que
  el dueño leyó como una resta.
- `periodosEnRango` (los meses que se cobran): días ÷ 30 **hacia arriba**, así que
  01/10–31/10 (31 días) se cobraba como **2 meses**, y 01/11–30/04 como 7.

Ahora las dos usan `finDeMeses`: un mes acaba el día anterior al mismo número de
día del mes siguiente (05/10 → 04/11), y si ese día no existe, el último del mes
(31/01 + 1 → 28/02). Cambian **juntas** a propósito: si solo cambiara la fecha,
05/10–04/12 (61 días) se habría seguido cobrando como 3 meses. Semanas (7),
catorcenas (14) y días no cambian. Las fechas se tratan como texto en UTC, sin
hora local.

**Efecto en dinero:** solo para propuestas NUEVAS —las guardadas tienen su
`cantidad` escrita—. Un rango de calendario completo deja de cobrar un mes de
más. Pruebas: `lib/periodos.meses.test.ts` (rojo con la regla de 30 días); y
`propuestas-volumen.test.ts`, que afirmaba «181 días = 7 meses» para
noviembre–abril, ahora dice 6.

## La franja CONTRATADA y la PROGRAMADA no son la misma (PROG-01, 30/09)

`reservas.franja_id` es lo **vendido**: se hereda del ítem al generar la
campaña y **no se elige aquí**. `campanas.franja_programada_id` es en qué
horario **se transmite**, y la escribe solo
`PUT /api/campanas/franja-programada` (`comercial.aprobar`, en bloque y atómico).
Programar no toca precio, snapshot ni reservas; si difiere de lo contratado,
se **avisa** y no se bloquea (decisión pendiente del dueño). En la ficha lo
enseña `FranjaProgramadaCampana`, montado con una línea bajo el Pipeline.
**Sin fusionar**: la columna espera la aprobación del dueño. Detalle completo en
[[rejilla-franja-y-temporada]].

## El cupón aplicado necesita aprobación (COD-03, 30/09)

Todo código promocional aplicado a una propuesta nace **PENDIENTE**
(`propuestas.codigo_estado`). Mientras lo esté:

- la **liga pública** no lo enseña —ni la línea ni el total con él— porque
  `obtenerPropuestaPublica` filtra la fila con `filaParaCliente` antes de armar;
- el cliente **puede aceptar**, y acepta **sin** cupón: la aceptación lo quita y
  devuelve su uso dentro de su transacción, antes del snapshot;
- **no se puede aprobar por dentro** (`cambiarEstatusPropuesta` → 409
  «Primero aprueba o rechaza el código promocional»);
- por dentro, los importes lo **siguen contando** y la lista marca «Cupón
  pendiente».

Lo decide `POST /api/propuestas/[id]/codigo/decision` con `comercial.aprobar`
(los cuatro roles de mando, no el VENDEDOR). Y aplicar un cupón a una
**RECHAZADA** la devuelve a **BORRADOR**. Decisiones y reglas derivadas en
[[codigo-promocional]] §8.

## La tarifa la calcula el servidor; solo un gerente la cambia (PRECIO-01, 01/10)

Decisión del dueño del 2026-10-01: «en propuestas aparte de ser calculado el
gerente será el único que podrá poner otro precio diferente al de la tarifa e
igual usuarios superiores». **Cierra el hallazgo B40 para la tarifa BASE**:
hasta ese día `propuestas-controller.ts` copiaba la `tarifaUnitaria` que
mandaba el navegador y se podía cerrar un prime a 1 peso con un `curl`.

- **Una sola cuenta para los dos lados.** `lib/tarifa-calculada.ts`
  (`modalidadesDeSitio`, `tarifaCalculada`) es la regla que vivía en
  `propuestas/page.tsx` (`tarifaDe`), movida sin tocar una coma. La pantalla y
  el servidor la llaman igual; `tarifa-calculada.test.ts` la compara contra una
  copia literal de la regla vieja en una matriz unidad × franja × fecha.
- **El servidor la recalcula** en `crearPropuestaCtrl` con los datos de ESTA
  organización (`lib/server/tarifas-repo.ts`: pantallas, `sitio_modalidades`,
  `sitio_tarifas` y temporadas activas, bajo RLS **y** con `and tenant_id`).
  *(2026-10-29, B43: el congelado del snapshot usa también estas dos piezas
  —`datosParaTarifar`, que acepta el tenant de la liga pública, y
  `tarifaCalculada().temporadaQuePuso`— para nombrar la temporada solo si fue
  la que puso el precio; ver [[rejilla-franja-y-temporada]].)*
  Compara **al centavo** (`centavos`) y decide con `decidirPrecioItem`:

| Precio enviado | Sin `comercial.aprobar` (VENDEDOR) | Con `comercial.aprobar` (GERENTE_VENTAS y superiores) |
|---|---|---|
| = tarifa calculada | 201, `precio_ajustado_por` null | 201, `precio_ajustado_por` null |
| ≠ tarifa calculada | **403** «Solo un gerente o superior puede cambiar la tarifa de una pantalla.» — no se guarda NADA | 201, `tarifa_calculada` + `precio_ajustado_por` = la sesión, y una línea en Actividad |
| pantalla sin tarifa (0, unidad que no ofrece, pantalla de otra organización) | **403** «…Pide a un gerente o superior que le ponga precio.» | 201, `tarifa_calculada` null, ajuste anotado |

- **403 y no 409**: reintentar lo mismo daría lo mismo; no es un conflicto de
  estado sino una acción que a esa persona no le toca. Mismo código que decidir
  un cupón sin el permiso.
- **El único camino que escribe precios de línea es `POST /api/propuestas`**
  (`crearPropuesta`). Ni `PATCH /api/propuestas/[id]` (descuento, nombre,
  notas), ni `PATCH /api/propuestas/items/[id]` (solo `aprobado`), ni la
  renegociación (sube versión por el descuento), ni el paquete (sustituye el
  bruto, no toca líneas) reescriben `precio` ni `tarifa_unitaria`.
- **Quién ajustó sale de la sesión**, nunca del cuerpo: el controller marca
  `precioAjustado: true` y el repo estampa `usuarioActual().id`, el mismo
  candado que el vendedor de VEND-01 (`PropuestaInput` sigue sin campo de
  usuario).
- **El cliente ve solo el precio final.** `obtenerPropuestaPublica` arma su
  objeto campo por campo y no copia `tarifaCalculada` ni
  `precioAjustadoPor*`; la e2e lo comprueba sobre el JSON crudo.
- **El detalle interno** (`/propuestas/[id]`) enseña «Tarifa calculada $X ·
  ajustada por {nombre}» en la línea ajustada. En la alta, el campo de tarifa
  solo es editable con `usePuede('comercial','aprobar')`; para el vendedor es
  texto.
- **Lo que no cambia**: volumen, descuento comercial, cupón, paquete y snapshot
  se componen encima del precio de la línea igual que antes.
- **Lo histórico** queda con las dos columnas en `null`: no se rellena, porque
  la tarifa de HOY no es la de entonces.

Columnas en [[esquema]] · migración `20261006_precio_ajustado_por_gerente.sql`
en [[migraciones]] · roles en [[roles-de-venta]].

## La cantidad de spots también la calcula el servidor (ADR 0042, 01/10)

Una línea de pantalla **digital** vendida **por spot** puede traer los
parámetros de la calculadora: `espaciosComprados`, `horasDia`, `roadblock` y
`primaRoadblockPct`. Con ellos, `crearPropuestaCtrl` **recalcula la cantidad**
(`resolverCalculadora`, `lib/calculadora-spots.ts`) sobre el loop de ESTA
organización (`datosDelLoop`, `tarifas-repo.ts`: RLS + `and tenant_id`) y:

| Caso | Respuesta |
|---|---|
| Parámetros mal, o `cantidad` que no cuadra | **400**, con la cuenta escrita; no se guarda nada |
| Más espacios que los libres, o Roadblock sin el loop entero libre | **409** |
| Prima de Roadblock > 0 sin `comercial.aprobar` | **403** «Solo un gerente o superior puede poner prima a un Roadblock.» |
| Prima con permiso | Se guarda; tarifa esperada = calculada × (1+prima), `tarifa_calculada` = la base sin prima, `precio_ajustado_por` = la sesión, y una línea en Actividad «… por Roadblock con prima del N %» |

- **ADR 0043 (06/10): el PRECIO de esa línea también lo pone la calculadora.**
  La tarifa esperada ya no es la modalidad `spot`: es la tarifa mensual
  repartida entre los spots del loop (`tarifaBaseCalculadora`), y el loop es la
  ocupación de hoy (`campanasActivas`) más la línea, como la calculadora HTML
  del dueño. Una pantalla sin tarifa mensual → 403 `sin-tarifa`, como PRECIO-01.
- La prima entra en la regla de PRECIO-01 por `decidirPrecioCalculadora`, que
  aplica la prima **una vez** y marca la línea como ajuste. Las líneas sin
  calculadora siguen por `decidirPrecioItem`, sin cambio.
- Con calculadora, `spots_por_dia` = los spots al día de la cuenta: lo cotizado
  y lo programado en el CMS son el mismo número.
- **Al generar la campaña**, `spots_reservados` = `espacios_comprados` (todos en
  un Roadblock) por `spotsDeLaReserva`, acotado a lo libre como siempre. Va
  **antes** que `spots_por_dia` en `pedidos`: en una línea de calculadora ese
  campo vale cientos (los pases al día) y retendría cientos de slots.
- El volumen se resuelve sobre la cantidad de la calculadora, como sobre
  cualquier otra; la prima va dentro de la tarifa unitaria, así que el volumen
  y la prima conmutan (son dos factores) salvo el redondeo al peso.
- La liga pública no lleva ninguno de los cuatro campos.

Detalle y decisiones en [[calculadora-de-spots]].

## Tablero de propuestas por periodo (PROP-PER, 06/10)

Arriba de la lista de Propuestas, con el mismo selector que Finanzas (este mes,
mes pasado, trimestre, trimestre pasado, año, rango): **generadas**,
**aprobadas** (y su venta), **rechazadas**, **tasa de cierre**, **ganancia** y
**ganancia por aprobada**, el desglose **por vendedor** y las aprobadas del
periodo de mayor a menor ganancia.

- **Cada cosa por su fecha.** Generada por `creado_en`, aprobada por
  `aprobada_en`, rechazada por `rechazada_en`: columnas nuevas
  (`20261009_propuestas_fechas_estatus.sql`) que pone `cambiarEstatusPropuesta`
  y la aceptación por la liga. Cambiar de estatus borra la fecha del que se
  deja. Las aprobadas viejas se fecharon con `snapshot_en` (se congela al
  aprobar); **las rechazadas viejas quedan sin fecha** y no caen en ningún
  periodo.
- **Ganancia = venta − renta de las pantallas** (decisión del dueño). Venta =
  `snapshot_economico.neto` (sin IVA, después de comisión). Renta = la del
  **contrato** vigente de cada pantalla aprobada (`rentaAtribuidaPorSitio`, la
  misma que `margenCampana` y los reportes) por sus meses de calendario
  (`periodosEnRango('mensual')`). Una pantalla sin contrato deja la propuesta
  **sin costo**: cuenta en la venta, no en la ganancia, y la pantalla lo avisa.
- **Quién ve qué.** El tablero pide `comercial.ver`; el costo y la ganancia,
  además `finanzas.ver` (Dueño, Administrador, Director comercial). A un
  Gerente o Vendedor no le llegan del servidor.

Las cuentas, puras, en `lib/propuestas-periodo.ts`; la ruta,
`GET /api/propuestas/resumen`. Cobertura: `lib/propuestas-periodo.test.ts`
(con 4 mutantes muertos) y `lib/test/propuestas-tablero.e2e.test.ts` (fechas
al aprobar/rechazar —con un mutante contra build reconstruido—, renta del
contrato, permisos, migración).

## CPS, CPM y el folio de venta (07/10)

Pedido de ventas del 06/10: «cps y cpm» y «asociar el id con el no. de venta; si
se alarga la campaña, añadir un .1». Decisiones del dueño, el 07/10:

- **CPS es «Por spot» renombrado**, no una unidad nueva. Solo cambia lo que se
  lee (`lib/periodos.ts`, `UNIDADES`): «CPS · costo por salida», «50 salidas».
  La clave `spot` se queda porque es la que guardan las propuestas, reservas y
  tarifas de antes; cambiarla les habría cambiado el significado sin migrarlas.
- **CPM es una unidad nueva, `cpm`, y su cantidad son MILLARES de impactos**,
  que captura quien vende. 85 por millar × 2 500 millares (2.5 millones de
  impactos) = 212 500. Se eligió millares y no impactos para que el importe
  siga siendo `tarifa × cantidad` en todas partes —volumen, snapshot, PDF,
  reserva—: con impactos habría que dividir entre 1000 en cada sitio que
  multiplica, y el que se olvidara cobraría mil veces de más. La pantalla
  escribe al lado a cuántos impactos equivale lo tecleado. Como la unidad es
  texto libre en la base, **no hizo falta migración**.
- CPM se publica como modalidad **solo en digitales**, igual que spot y hora
  (`lib/modalidades.ts`): una fija sigue vendiéndose por periodo. Su tarifa
  sale de la modalidad `cpm` de la pantalla; sin ella, solo un gerente le pone
  precio (la regla de PRECIO-01, sin cambios).
- Las unidades de cantidad manual están en UNA lista, `esCantidadManual()`.
  Antes eran tres comparaciones sueltas `spot || hora`, y añadir CPM a dos de
  las tres habría derivado sus millares de las fechas en la tercera.
- **El folio de la campaña es el de su propuesta** (`campanas-repo.ts`,
  `generarCampanaDesdePropuesta`). No choca: `propuestas.folio` es único y una
  propuesta da una sola campaña. Una campaña creada sin propuesta conserva su
  folio propio (`folioCampana`).
- **Extender le suma un tramo** en el MISMO `update` que alarga la fecha,
  calculado por la base con la fecha que la fila tiene al escribir. Repetir la
  misma fecha no sube el tramo (y desde EXT-CONTRATO, 29/10, se rechaza con
  400). La bitácora deja «Extendió campaña PR-2026-0042.1 hasta 2026-12-31 con
  contrato»: leídas en orden, las entradas dicen qué cubre cada tramo.
- **Lo que apareció al hacerlo:** `extenderCampana` leía la fecha y escribía en
  dos pasos, así que dos extensiones a la vez podían **acortar** la campaña (la
  de 60 días pisando a la de 90). El `update` ahora exige `fecha_fin <= nueva`;
  si otra la llevó más lejos, responde **409** y no toca las reservas.
- **La lista del CMS lleva el folio SIN tramo** (`folioBase`, en
  `doohmain.ts`): una campaña extendida sigue siendo la misma lista en el
  reproductor, no una nueva junto a la vieja.

Probado en `lib/periodos.cps-cpm.test.ts`, `lib/folio-venta.test.ts`,
`lib/server/propuestas-precio.test.ts`,
`lib/server/campanas-repo.extender.test.ts` y, contra Postgres,
`lib/test/folio-venta-cpm.e2e.test.ts` (folio heredado, .1/.2, la carrera, la
bitácora, CPM hasta la reserva y CPM rechazado en una fija). Ocho mutantes,
todos muertos; el del folio heredado, contra build reconstruido.

## Cómo se ven la lista y la ficha de campaña (rediseño del 26/10)

Solo presentación, con el lenguaje del Dashboard (`inicio/page.tsx`). Ningún
dato nuevo: todo sale de los hooks que las pantallas ya usaban.

**Lista `/campanas`.** Abre con cuatro indicadores (`IndicadoresCampanas`):
activas, por validar publicación, listas para facturar (candado abierto y ni
completada ni cancelada) y contratado vigente (suma de `presupuestoBruto` de las
activas; **«—» si ninguna tiene presupuesto**, nunca $0). La cola «Por validar»
enseña 5 y «Ver todas (N)». El filtro de estado dice cuántas hay en cada uno.
Cada tarjeta lleva la etapa en un chip («Confirmada · 2/9») y el candado
**con texto** («Lista para facturar»); la línea «Etapa actual» sobre el pipeline
se quitó porque repetía el chip. El presupuesto que falta es «—» con su motivo
en `title`. `useVistaCampanas` (compacta, minimizar, ocultar) no cambió de
significado.

**Ficha `/campanas/[id]`.** Bajo el encabezado, una franja (`ResumenCampana`)
con total, margen, % entregado, candado, OT abiertas de N y evidencias (solo si
hay medio fijo). Es componente aparte y entra en la página con **una línea**,
porque otra rama (la «Validación de publicación» siempre abierta, decisión del
23/10) toca el mismo archivo. Las listas de Imprenta y OT de sus secciones son
`ListasCampana` (`divide-y`, fecha compromiso y «Vencida» con `estadoSLAOT`,
«Ver todas (N)» pasadas 5). `CandadoPanel` ya no pinta borde ni título propios
—vive dentro de la sección «Candado de facturación», que los pone— y dice «se
abre cuando se cumplen estas condiciones» en vez de «las tres». Las migas: en
escritorio solo `Breadcrumbs`; el «← volver» queda para el teléfono.

**`/creativos`.** Cuatro indicadores (por aprobar, aprobados, rechazados, spots
sin creativo). Si hay campañas pero **ninguna digital**, el vacío lo dice y manda
a Imprenta, en vez de pedir que se reserven sitios. El estado de cada creativo es
el mismo chip (`StatusBadge` + `CREATIVIDAD_TONO`) que en la ficha, con el motivo
del rechazo a la vista; las acciones caben en una fila (Reemplazar y Eliminar
como iconos con `aria-label`); los spots son una lista con la pastilla «Sin
creativo». El vacío con filtro trae «Limpiar filtros».

> [!warning] Las clases `border-warning/40`, `bg-warning/10` y similares NO existen
> Los colores del tema son `var(--warning)` sin canales, y Tailwind 3 no sabe
> aplicarles opacidad: esas clases **no se generan** (medido en
> `.next/static/css` el 26/10: cero apariciones). Para un tinte se usan los
> `*-soft` (`bg-warning-soft`, `bg-success-soft`, `bg-error-soft`).

## Lo tentativo es lo que está en una propuesta abierta (TENT-PROP, 26/10)

> [!important] Regla del dueño, 2026-10-26
> «Lo tentativo debe ser un spot o una pantalla fija que está en veremos en una
> propuesta, es decir, solo es propuesta: aún no está aprobada ni creada la
> campaña.» Y **solo avisa**: una pantalla en propuesta se puede seguir
> cotizando y vendiendo a otro cliente; varias propuestas pueden competir por
> ella. Bloquea solo lo confirmado.

**Antes** «tentativo» era un estado de la reserva (`TENTATIVA`, con caducidad de
7 días y botones Confirmar/Extender en Comercial). **Ningún flujo lo creaba**:
reservar desde Comercial y generar la campaña insertan `CONFIRMADA`
(`campanas-repo.ts`). Solo nacían tentativas por el `default 'TENTATIVA'` de la
columna, y aun así el motor de Reportes las contaba como ingreso mientras la
ocupación del Dashboard no.

**Ahora:**

- La regla vive una vez en `apps/web/lib/data/en-propuesta.ts`
  (`itemsEnPropuesta`, `enPropuestaEntre`, `agruparPorPropuesta`): ítems de
  propuestas en `BORRADOR` o `ENVIADA`, con folio, cliente, fechas y, en una
  digital, los spots pedidos (`espacios_comprados ?? spots_por_dia`, la misma
  precedencia con la que una aprobada reserva slots).
- Disponibilidad: cada celda trae `enPropuesta` (no cambia `estado` ni los
  conteos). Una libre que alguien pide sale «En propuesta» en ámbar punteado.
- Comercial: la tarjeta «Reservas tentativas» pasó a «En propuesta» (una fila
  por propuesta abierta con algo por delante, con enlace a la propuesta). El
  indicador «Tentativas por confirmar» pasó a «En propuesta».
- Ficha del sitio: el calendario pinta en ámbar los rangos de propuestas
  abiertas.
- Dashboard: el pin ámbar es «en propuesta hoy», y un hueco avisa los folios que
  piden la cara.
- Reportes: solo `CONFIRMADA` es venta (`cuentaComoVenta`, `lib/data/reportes.ts`).
- `20261026_reserva_estatus_por_omision.sql`: la columna nace `CONFIRMADA` por
  omisión. No toca filas ni el enum.
- `sitios.estatus_comercial = 'RESERVADO'` **no es tentativo**: lo pone el
  servidor al generar la campaña, «hasta la OC». Su etiqueta pasó de «Reservado ·
  tentativo» a «Reservado · sin OC».

> [!note] «Extender campaña» quedó sin entrada en la interfaz (26/10) — resuelto el 29/10
> El diálogo vivía en la tarjeta de tentativas, que solo aparecía con reservas
> TENTATIVA, así que **ya era inalcanzable**. El dueño decidió el 29/10 dónde
> ofrecerlo y con qué condición: ver la sección siguiente.

## Extender solo con contrato nuevo (EXT-CONTRATO, 29/10)

Regla del dueño: **una campaña no se extiende sin un contrato nuevo.** Es ROJO
R4 (cambia la fecha fin y lo que se factura) y R3 (tabla nueva), los dos
aprobados por el dueño el 29/10.

- **El contrato es obligatorio en el mismo paso.** `POST
  /api/campanas/[id]/extender` pide `{ fechaFin, contratoUrl }`. Sin
  `contratoUrl` (o vacío) responde **422** «Para extender la campaña adjunta el
  contrato firmado de la extensión», con su traducción en
  `lib/i18n/errores-servidor.ts`. El archivo pasa por el mismo validador que el
  contrato del cliente (`LIMITES.contratoPdf`: PDF de hasta 10 MB, bytes
  verificados). El chequeo vive en `extenderCampanaCtrl`
  (`campanas-controller.ts`), antes de zod para que el mensaje no lleve el
  nombre del campo delante.
- **Dónde vive el contrato: `campana_extensiones`, no `campanas.contrato_url`.**
  Esa columna es UNA por campaña y `guardarContratoCampana` la sobrescribe:
  escribir ahí el de la extensión borraba el original. `acciones` es texto y
  `ordenes_compra` son OC con folio y monto (finanzas). La tabla nueva
  (`20261029_campana_extensiones.sql`) guarda una fila por extensión: folio del
  tramo que abrió, fecha de y hasta, el PDF y quién. **Solo inserción** (sin
  update ni delete para el rol de la app), RLS forzada, y `campana_id` **on
  delete restrict**: una campaña con extensiones no se puede borrar, los
  contratos no se pierden nunca (decisión del dueño).
- **Una sola transacción.** `extenderCampana` hacía tres `q()` sueltos; ahora
  lee con `for update`, escribe fecha y tramo, inserta la extensión, alarga las
  reservas y recalcula el presupuesto dentro del mismo `begin … commit`. Si algo
  falla no queda una campaña extendida (que factura más) sin su contrato.
- **La misma fecha ya no es una extensión**: antes pasaba sin subir el tramo;
  ahora es 400, porque dejaría un contrato firmado que no alarga nada. El
  `where` del update pasó de `fecha_fin <= $2` a `fecha_fin < $2`.
- **La ficha** (`campanas/[id]/page.tsx`) monta la tarjeta «Extensiones»
  (`ExtensionesCampana.tsx`): el botón «Extender campaña» (quien tiene
  `comercial:crear`, y no en una cancelada) abre `ExtenderCampanaDialog` con la
  fecha y el PDF obligatorios —la subida es la de «Contrato del cliente»: data
  URL leída en el navegador—, y debajo la lista de extensiones con su contrato,
  de `GET /api/campanas/[id]/extender` (`comercial:ver`).
- Las extensiones de antes del 29/10 no tienen fila: no pedían contrato, y su
  rastro está solo en la bitácora.

Probado en `lib/server/campanas-extender.test.ts` (422 sin contrato, vacío o
imagen; el mensaje traducido) y `lib/server/campanas-repo.extender.test.ts`
(la fila con sus datos, el orden dentro de la transacción, `for update`,
rollback sin fila en el 409). Contra Postgres, la §2b de
`lib/test/folio-venta-cpm.e2e.test.ts` (sin contrato nada cambia; con contrato
la fila y el original intacto; restrict; permisos de solo inserción) —
**escrita y no corrida aquí**: en esta máquina no hay Postgres, la corre el CI.

## Cada reserva hereda el neto de SU línea (B56, 29/10, R4 aprobado por el dueño)

Al generar la campaña de una propuesta aprobada, el precio de cada reserva sale
del neto congelado en `snapshot_economico.porSitio`. Hasta el 29/10
`generarCampanaDesdePropuesta` (`lib/server/campanas-repo.ts`) lo buscaba en un
`Map` **por pantalla**. Con la misma pantalla dos veces —dos franjas o dos
periodos— ganaba la última entrada, y **las dos reservas se cobraban con ese
neto** (prime 27 000 + madrugada 7 200 salían 7 200 + 7 200).

Ahora lo empareja `netosDelSnapshot` (`lib/neto-de-linea.ts`, puro):

- **Snapshots desde el 29/10:** por `porSitio[].itemId`, el id del ítem que
  `congelarSnapshotEconomico` guarda en cada línea. Es lo que identifica la
  línea de verdad.
- **Snapshots anteriores** (inmutables, no se reescriben): pantalla única → su
  neto, como siempre. Pantalla repetida → se desempata por `franja.id` y por la
  lista (= `precio` del ítem). Si queda un solo neto, ése; si no, `null`.
- `null` → el **cálculo de respaldo** de siempre (lista × volumen × descuento ×
  código × comisión, o la parte del paquete). **Nunca el neto de otra línea.**

Las campañas ya generadas **no se tocan**. Para encontrar las afectadas está el
diagnóstico de solo lectura `docs/datos/20261029_diagnostico_neto_linea_repetida.sql`.
Pruebas: `lib/neto-de-linea.test.ts`.

## Vigencia y condiciones (PROP-COMPLETA, 29/10)

Decisiones del dueño del 29/10. Migración
`20261029_propuestas_condiciones_vigencia_vendedor.sql`.

- **Vigencia.** `propuestas.vigente_hasta` la pone `cambiarEstatusPropuesta`
  al pasar a **ENVIADA**: `current_date + config_negocio.vigencia_propuesta_dias`
  (30 por omisión, 1–365, en Administración → «Propuestas: vigencia y
  condiciones»). Una fecha vigente se respeta; **reenviar una vencida la
  renueva**. Se edita por dentro con `PATCH /api/propuestas/[id]`
  `{ vigenteHasta }` (fecha validada; no sube versión).
- **Vencida, la liga no acepta.** `aceptarPropuestaPublica` lo decide en la
  base (`vigente_hasta < current_date`), después del idempotente (una ya
  aceptada sigue diciendo que se aceptó) → `PropuestaVencidaError`, 409. **El
  último día todavía vale.** `null` = sin vigencia: todo lo enviado antes del
  29/10 se sigue aceptando como siempre. La liga y la ficha lo avisan con
  `lib/propuesta-vigencia.ts`, la misma regla.
- **Condiciones.** `config_negocio.condiciones_propuesta` es una PLANTILLA que
  `crearPropuesta` **copia** a `propuestas.condiciones`: cambiarla no toca las ya
  creadas. Se editan por propuesta en la ficha («Condiciones y vigencia») y
  salen en la liga pública antes del botón de aceptar. Vaciarlas las quita.
- Pruebas: `lib/propuesta-vigencia.test.ts` y
  `lib/test/propuesta-vigencia.e2e.test.ts` (incluye R2: la plantilla y los días
  de una organización no se cuelan en otra).

## El documento imprimible: «Generar PDF» (PROP-COMPLETA, 29/10)

«Generar PDF» abre `app/(app)/propuesta/[id]` en otra pestaña: fuera de
(shell), como el contrato, y se guarda como PDF desde el diálogo de impresión
(sin librería en el servidor). Se arma con la **vista del cliente**
(`obtenerPropuestaPublica(token, { conFotos: true })`): sin tarifas internas y
**sin el cupón pendiente** (COD-03). Lleva membrete, pantallas con su primera
foto, mapa (`MapView imprimible`: `preserveDrawingBuffer`, sin él el lienzo
WebGL sale en blanco), la misma escalera de importes que la liga, condiciones,
la liga con QR y el espacio de aceptación (o el sello si ya se aceptó). La liga
pública NO carga fotos (pesan). R2: el token se busca con el tenant de la
sesión; otra organización recibe 404. Pruebas en
`lib/test/propuestas-gestion.e2e.test.ts`. Revisado en el navegador el 29/10
(Chrome, `next start` contra Postgres local): foto, mapa con mosaicos, QR,
condiciones y escalera. **No se revisó la salida impresa** (vista previa de
impresión ni PDF guardado): el lienzo del mapa depende de
`preserveDrawingBuffer` y eso solo se ve imprimiendo.

## Agregar, quitar y duplicar (PROP-COMPLETA, 29/10)

- **Agregar sitios** — `POST /api/propuestas/[id]/items` → `agregarSitiosCtrl`.
  BORRADOR o ENVIADA (en ENVIADA **sube la versión**). Las líneas usan el
  periodo de la propuesta (`rangoDePropuesta`) y pasan por `prepararLineas`, la
  MISMA función del alta (franja, volumen, calculadora, tarifa del servidor y
  permiso de `comercial.aprobar`): un sitio agregado no es otra puerta para B40.
  El INSERT de la línea es uno (`insertarItem`), compartido con el alta.
- **Quitar** — `DELETE /api/propuestas/items/[id]` → `quitarItem`. Mismos
  estatus, sube versión en ENVIADA, **nunca el último sitio** (409). Con la fila
  de la propuesta bloqueada para que dos no quiten a la vez el penúltimo.
- Ni agregar ni quitar recalculan el paquete aplicado: su precio no se mueve y
  `avisoPaqueteIncompleto` avisa (PAQ-01).
- **Duplicar** — solo del lado de la pantalla: la ficha abre
  `/propuestas?duplicar=<id>` y el formulario de alta se precarga (cliente,
  agencia, comisión, periodo, notas y, por pantalla, unidad, franja,
  programación y calculadora). **No** copia tarifa manual, prima de Roadblock ni
  cupón: la copia se cotiza a la tarifa de hoy. Una pantalla repetida en la
  original entra una vez. «Agregar sitios» usa el mismo formulario
  (`?agregar=<id>`), con nombre, cliente, fechas y comisión fijos.
- Pruebas: `lib/test/propuestas-gestion.e2e.test.ts` (incluye la vendedora a
  1 peso por la puerta nueva → 403, y R2).

## Borrar un borrador (PROP-COMPLETA, 29/10 · R5 aprobado)

`DELETE /api/propuestas/[id]` → `borrarPropuestaBorrador`. **Solo BORRADOR**:
una enviada se rechaza (el cliente ya tiene la liga) y una aprobada no se toca
(409 con esa frase). En una transacción con la fila bloqueada y `estatus` en el
`delete` como segunda red. Se van por `cascade` las líneas, el canje del cupón
—y con él **el uso vuelve**: los usos son `count(*)` de `canjes_codigo`— y la
aplicación del paquete. El folio no se reutiliza (queda un hueco en la serie).
Pruebas: `lib/test/propuestas-gestion.e2e.test.ts`.

## Enviar por correo (PROP-COMPLETA, 29/10)

«Enviar» ya no es solo un cambio de estatus: abre un diálogo con el correo del
contacto del cliente y un mensaje opcional, y `POST /api/propuestas/[id]/enviar`
(`lib/server/propuestas-envio.ts`) manda **la liga, no los importes** —los
importes viven en la liga, que sabe si el cupón está pendiente y si venció—
por el canal de OPERACIÓN, con copia a quien envía. **El orden es la regla:**
primero el correo, después ENVIADA; un Resend caído da 502 y la propuesta no
cambia. Sin correo configurado solo cambia el estatus y la pantalla copia la
liga. En una ENVIADA el botón es «Reenviar» (renueva la vigencia si venció).
Pruebas: `lib/server/propuestas-envio.test.ts` (el 502 se comprobó por mutación).

## Portal del cliente

`campanas.portal_token` + `portal_activo` habilitan `/portal/[token]`.
`portal-repo.ts:9-12`: devuelve **solo** lo de esa campaña — nada de otros
clientes ni datos financieros.

## Relacionadas
[[flujo-propuesta-a-campana]] · [[finanzas-y-cobranza]] · [[operaciones-y-ot]] ·
[[inventario-y-sitios]] · [[paginas-publicas]] · [[esquema]] · [[MOC-Proyecto]] ·
[[tarifa-publicada-vs-neta]]
