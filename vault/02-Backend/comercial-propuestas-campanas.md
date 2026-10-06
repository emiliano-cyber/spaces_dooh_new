---
tipo: modulo
estado: verificado
actualizado: 2026-10-06
tags: [backend, comercial, propuestas, campanas, amarillo, precio]
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
  - apps/web/lib/server/campanas-controller.ts
  - apps/web/lib/server/creativos-repo.ts
  - apps/web/lib/server/reservas-controller.ts
  - apps/web/lib/reparto-creativos.ts
  - apps/web/lib/periodos.ts
  - apps/web/lib/data/types.ts
  - apps/web/app/(app)/(shell)/propuestas/[id]/page.tsx
  - apps/web/app/(app)/(shell)/campanas/[id]/page.tsx
  - apps/web/components/demo/campanas/FranjaProgramadaCampana.tsx
  - apps/web/lib/server/programacion-repo.ts
---

# Comercial: propuestas, reservas y campañas

## El recorrido

```
Cliente → Propuesta (folio, ítems, comisión) → aprobada
       → Campaña (folio) → Reservas (sitio × fechas) → Creativos → publicación
```

## Archivos

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `campanas-repo.ts` | 1265 | Clientes, campañas, reservas, confirmar/extender |
| `propuestas-repo.ts` | 638 | Propuestas, ítems, liga pública, aceptación |
| `lib/descuento.ts` | 157 | Descuento válido **y bajo el tope**, y el texto de bitácora (puro, con tests) |
| `creativos-repo.ts` | 366 | Alta, validación y asignación de creativos |
| `propuestas-controller.ts` | 121 | Validación zod |
| `campanas-controller.ts` | 92 | Validación zod |
| `lib/reparto-creativos.ts` | — | Reparto puro (con tests) |

## El método del divisor

El precio **neto** sale de dividir el **bruto** entre `(1 − comisión)`
(`divisorDeComision`, `lib/data/derive.ts`). La **comisión de agencia** y el
**descuento comercial** son cosas distintas y viven en columnas distintas
(`propuestas.comision_pct` vs `propuestas.descuento_pct`). Confundirlos cambia
lo que se le cobra al cliente.

## Reglas codificadas

| Regla | Dónde |
|---|---|
| **No reservar con contrato incompleto** (ADR 0003) | `campanas-repo.ts` → `exigirContratoCompleto()` |
| **Propuesta inmutable** una vez enviada | `PropuestaError` → 409 (`propuestas-repo.ts:9`) |
| **Gate de negociación**: agencia con negociación sin validar bloquea crear/aprobar | `agenciaBloqueada()` (`propuestas-repo.ts:12-16`) |
| **Cupo de clientes por pantalla** (ADR 0008) | `campanas-repo.cupo-clientes.test.ts` |
| **Tope de descuento por organización** (TOPE-01) | `descuentoDentroDelTope()` (`lib/descuento.ts`) |
| **Generar campaña es idempotente** (hallazgo A5) | `flujo-critico.e2e.test.ts` |
| **No enviar a dominio sin creativo** (hallazgo M14) | `campanas-repo.ts` |
| Reserva `TENTATIVA` caduca sola por TTL | `reservas.expira_en` (`20260706_reserva_ttl.sql`) |

### El cupo global se lee con filtro de organización

`cupoGlobalClientes()` (`campanas-repo.ts:295-313`) lee
`config_negocio.max_clientes_pantalla` **filtrando por `tenant_id`** contra
`current_setting('app.tenant_id', true)`, no solo apoyándose en la RLS.

Hasta el 13/08 la consulta era un `select ... limit 1` **sin `where`**: hoy la
salvaba el único llamador (`reservar()`, `:427`), que corre dentro de una
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

## La liga pública de la propuesta

`propuestas.token_publico` habilita `/p/[id]` sin sesión. El cliente puede
**aceptar** desde ahí, y eso se registra como medio-contrato:
`aceptado_en`, `aceptado_por`, `aceptado_ip` (`db/schema.sql:358-360`).

El tenant de esas peticiones lo resuelve Postgres con
`propuesta_tenant_por_token()`, nunca el cliente. Ver [[multi-tenancy-y-rls]].

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
diaria · spot · hora), `cantidad`, `tarifa_unitaria` y `spots_por_dia`.

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
> `spots_reservados` en `null` y `reparto-creativos.ts:51-68` leía ese null como
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

## Portal del cliente

`campanas.portal_token` + `portal_activo` habilitan `/portal/[token]`.
`portal-repo.ts:10-12`: devuelve **solo** lo de esa campaña — nada de otros
clientes ni datos financieros.

## Relacionadas
[[flujo-propuesta-a-campana]] · [[finanzas-y-cobranza]] · [[operaciones-y-ot]] ·
[[inventario-y-sitios]] · [[paginas-publicas]] · [[esquema]] · [[MOC-Proyecto]] ·
[[tarifa-publicada-vs-neta]]
