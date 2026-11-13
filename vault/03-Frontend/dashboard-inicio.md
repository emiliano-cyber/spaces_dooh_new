---
tipo: modulo
estado: verificado
actualizado: 2026-11-13
tags: [frontend, dashboard, inicio, dinero, comercial]
archivos:
  - apps/web/app/(app)/(shell)/inicio/page.tsx
  - apps/web/components/demo/inicio/pnl-del-mes.ts
  - apps/web/components/demo/inicio/indicadores.ts
  - apps/web/components/demo/inicio/indicadores.test.ts
  - apps/web/lib/alertas-visibles.ts
  - apps/web/lib/metricas-visibles.ts
  - apps/web/components/demo/ui/CardColapsable.tsx
---

# Dashboard (`/inicio`)

La primera pantalla de dirección y de ventas. Lo ven `DUENO`, `ADMINISTRADOR`,
`DIRECTOR_COMERCIAL`, `GERENTE_VENTAS` y `VENDEDOR`
(`components/demo/shell/nav.ts`, entrada `dashboard`).

Se rehízo el **2026-10-26** en dos tandas, a partir de una comparación con lo que
ponen en su inicio los programas del sector (Broadsign Ayuda, SignDash,
HighSign, AdQuick, Moving Walls) y los CRM generales (Salesforce, HubSpot,
Pipedrive, Zoho):

- **DASH-PERIODO** (rama `fix/dashboard-del-periodo`): el ingreso, los costos y el
  margen pasan a ser **del mes** y salen del motor de Reportes. Detalle en
  [[pantalla-reportes]], sección «El Dashboard también pide aquí su mes».
- **DASH-REF** (rama `feat/dashboard-referentes`): todo lo demás de esta nota.

## De dónde sale cada bloque

| Bloque | Fuente | Quién lo ve |
|---|---|---|
| Ingreso y margen del mes, costos, «Renta / ingreso» | `GET /api/reportes/rentabilidad`, dimensión `trimestre`, el mes en curso | Quien tiene `finanzas:ver` |
| «Tarifa publicada cobrada» | El mismo endpoint, dimensión `tarifa` | Quien tiene `finanzas:ver` |
| Pipeline abierto, tasa de cierre | `pipelineComercial` sobre `propuestas` del store | Ventas en los KPI, y todos en la tarjeta |
| Ganado en el mes, por vendedor | Igual, por `propuestas.aprobada_en` y `propuestas.usuario_id` | Todos |
| Ocupación de la red y su gráfica | `dashboardMetrics` / `ocupacionSerie` (sin cambios) | Todos |
| Alertas | `construirAlertas`, ordenadas con `ordenarAlertas` | Todos (cada quien las de sus módulos) |
| Huecos y renovaciones | `huecosProximos` sobre reservas, sitios y campañas | Todos |
| Por cobrar por antigüedad | `antiguedadCobranza` sobre cobranzas y facturas | Quien tiene `finanzas:ver` |
| Mapa | `tonoPinHoy` sobre las reservas | Todos |

## Las decisiones que no son de estilo

> [!note] 2026-11-11 · Alertas y Huecos y renovaciones, a la MISMA altura
> Pedido del dueño: «ambas están en el mismo nivel, hay que hacer que ocupen
> el mismo espacio en vertical, se pierde la naturalidad al haber huecos». Su
> fila pasó de `items-start` a `items-stretch` (`inicio/page.tsx`), así que la
> más corta se estira hasta la otra. Una tarjeta **plegada** no se estira:
> `CardColapsable` le pone `self-start` al cerrarse, para que no quede un
> recuadro vacío con la altura de la vecina. Visto en el navegador: 393/393 px
> con contenido desigual y 51 px la plegada. Y la fila de **Por cobrar + mapa**,
> igual, el mismo día y también a petición del dueño: 382/382 px.

**Por rol, no con ceros.** Un rol sin `finanzas:ver` recibe vacías de
`/api/estado` las cobranzas, las facturas y los contratos, y el motor de Reportes
le contesta 403. Antes veía «Por cobrar $0» y «margen 100 %» en verde. Ahora sus
KPI son los suyos —pipeline abierto, tasa de cierre, ganado del mes y
ocupación— y la tarjeta de cobranza no se pinta.

**«Ganado» por fecha de aprobación.** `aprobada_en` existe desde
`20261009_propuestas_fechas_estatus.sql`; una aprobada de antes no tiene fecha y
**no** se cuenta en el mes, porque suponerla de este mes inflaría lo ganado con
historia. Se mide lo **aprobado** (`netoAprobado`), no lo cotizado: con
aprobación sitio por sitio el cliente puede quedarse con una parte. La tasa de
cierre es la de los últimos 90 días, y sin decisiones es `—`, no 0 %.

**Hueco = la cara se queda vacía.** Una reserva confirmada que termina en los
próximos 30 días deja hueco salvo que haya **relevo**: otra reserva viva
(no cancelada) en la misma pantalla que empiece a más tardar el día
siguiente. En una fija vale cualquier campaña, porque la cara solo admite una;
en una digital solo una del **mismo cliente**, porque las demás campañas al aire
no ocupan los slots que se liberan. Digital aquí es `PANTALLA_DIGITAL`, la regla
de booking (S0-3). Una **propuesta abierta** que pide la cara no es relevo
(TENT-PROP, 26/10: puede no cerrarse, y lo tentativo solo avisa): el hueco sigue
y dice «En propuesta: PR-…», que es a quién llamar.

**Alertas rojas primero.** `construirAlertas` las genera agrupadas por tipo
—rentas, contratos, licencias, cobranza, incidencias, OT— y se cortaban en seis,
así que las de renta dejaban fuera una factura vencida o una OT fuera de plazo.
Ahora van las rojas primero, con un contador por tipo y «Ver todas». Y
`licencia` entró en `TIPOS_ALERTA`: se generaba desde el 29/07 y no se podía
ocultar.

**El pin por lo que pasa hoy.** `pinTono` lee `sitios.estatus_comercial`, una
columna guardada que no se recalcula cuando termina una reserva: un espectacular
cuya campaña acabó ayer seguía en rojo. `tonoPinHoy` mira la reserva que cubre
el día, con la regla de `sitiosOcupadosHoy`. El mapa bajó de 460 a 300 px.
Desde TENT-PROP (26/10) el ámbar es «En propuesta»: libre hoy, pero una
propuesta abierta la pide para hoy (antes era la reserva TENTATIVA, que nada
creaba). Y a quien no ve Finanzas ya no se le piden las cifras al motor de
Reportes: le contestaba 403 y ensuciaba su consola.

**Tarifa cobrada, no «rendimiento sobre el 100 %».** El rendimiento del sector
(ingreso contra la tarifa con toda la red llena) no se puede calcular honesto
hoy: la tarifa de una digital no tiene una unidad única. Lo que sí sabe el motor
es cuánto de la tarifa **publicada** se cobró en las ventas que nacieron de una
propuesta, y lo dice junto a cuántas ventas lo respaldan.

## Elegir qué métricas se ven (DASH-METRICAS, 12/11)

Pedido del dueño: «que del dashboard se puedan elegir qué métricas ver y cuáles
no». Botón **Personalizar** junto al título, con una casilla por bloque: los
indicadores (ingreso, margen, pipeline abierto, tasa, ganado, ocupación de la
red, costos del mes) y las tarjetas (ocupación, pipeline, alertas, huecos, por
cobrar, mapa). Solo ofrece lo que el rol puede ver (DASH-REF).

- Se guarda lo **oculto** en `localStorage` (`spaces:metricas-ocultas`),
  por navegador, como las alertas. Sin nada guardado sale todo, como antes.
- **El diseño aprobado no cambia**: se comprobó que el HTML congelado de
  `pantallas-inicio.test.ts` es idéntico salvo el encabezado con el botón.
- Si se oculta una tarjeta de una fila, su compañera ocupa la fila entera
  (`anchoDeFila`); con las dos visibles, los anchos son los de siempre.
- Probado en el navegador el 12/11 contra un build local: ocultar «Huecos» y
  «Mapa», recargar, y «Alertas» y «Por cobrar» quedan a todo lo ancho.

## Todo alineado, sin huecos (DASH-ALINEADO, 13/11)

Pedido del dueño: «que todo esté alineado para dejar el menor espacio
desperdiciado, pero manteniendo la separación entre cada renglón».

- **La línea entre columnas cae en el mismo sitio en las tres filas.** La
  angosta va a la izquierda en escritorio (`anchoDeFila` le da
  `lg:order-first`). Antes Ocupación (ancha) iba a la izquierda y Pipeline a
  la derecha, y en Alertas/Huecos y Por cobrar/Mapa al revés: la costura
  saltaba de 2/3 a 1/3. Se ordena con CSS, no moviendo el JSX, para que en el
  celular el orden de lectura no cambie.
- **Las dos tarjetas de cada fila, a la misma altura**: la fila de Ocupación y
  Pipeline pasa de `items-start` a `items-stretch`, como las otras dos desde el
  11/11.
- **La gráfica y el mapa llenan su tarjeta** cuando la vecina es más alta (con
  mínimos de 180 y 300 px, los de siempre). Van en un contenedor
  `absolute inset-0` dentro de uno `flex-1`: si su alto saliera de su propio
  contenido, la gráfica de Recharts y su caja se empujarían una a otra.
- **Los indicadores tienen tantas columnas como se ven** (`columnasIndicadores`):
  con la rejilla fija de 4, ocultar uno dejaba una casilla vacía.
- **La separación entre renglones no cambia** (`space-y-5`, 20 px); entre
  columnas pasa de 16 a 20 px (`gap-5`) para que los dos huecos midan igual.
- El HTML congelado de `pantallas-inicio.test.ts` cambió **solo en clases**,
  ningún texto. **Sin probar en navegador todavía** (13/11).

## Lo que no está, y por qué

- **Metas por vendedor** (meta contra real, cobertura del pipeline): es lo que
  más repiten Salesforce, SignDash, Broadsign Ayuda y monday, y necesita una
  tabla nueva. Es una migración, zona roja R3: la decide el dueño.
- **Cobrado en el mes**: los abonos tienen fecha en la base (ADR 0046) pero no
  viajan al store del navegador.

## Pruebas

`components/demo/inicio/indicadores.test.ts` y `pnl-del-mes.test.ts` (sin
jsdom, por eso la lógica vive fuera del `.tsx`); la §3 de
`lib/test/reportes-acceso.e2e.test.ts` con la URL exacta del Dashboard; y la
sección DASH-REF de `lib/test/vendedor-en-propuesta.e2e.test.ts`, que comprueba
que `vendedorId` viaja a `/api/estado` y **no** a la liga pública.

## Relacionadas
[[pantalla-reportes]] · [[modulos-internos]] · [[shell-y-navegacion]] ·
[[02-Backend/comercial-propuestas-campanas]] · [[02-Backend/finanzas-y-cobranza]] ·
[[02-Backend/reportes-rentabilidad]] · [[03-Frontend/_indice]] · [[MOC-Proyecto]]
