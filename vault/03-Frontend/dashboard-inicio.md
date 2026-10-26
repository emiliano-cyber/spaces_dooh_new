---
tipo: modulo
estado: verificado
actualizado: 2026-10-26
tags: [frontend, dashboard, inicio, dinero, comercial]
archivos:
  - apps/web/app/(app)/(shell)/inicio/page.tsx
  - apps/web/components/demo/inicio/pnl-del-mes.ts
  - apps/web/components/demo/inicio/indicadores.ts
  - apps/web/components/demo/inicio/indicadores.test.ts
  - apps/web/lib/alertas-visibles.ts
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
(confirmada o apartada) en la misma pantalla que empiece a más tardar el día
siguiente. En una fija vale cualquier campaña, porque la cara solo admite una;
en una digital solo una del **mismo cliente**, porque las demás campañas al aire
no ocupan los slots que se liberan. Digital aquí es `PANTALLA_DIGITAL`, la regla
de booking (S0-3).

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

**Tarifa cobrada, no «rendimiento sobre el 100 %».** El rendimiento del sector
(ingreso contra la tarifa con toda la red llena) no se puede calcular honesto
hoy: la tarifa de una digital no tiene una unidad única. Lo que sí sabe el motor
es cuánto de la tarifa **publicada** se cobró en las ventas que nacieron de una
propuesta, y lo dice junto a cuántas ventas lo respaldan.

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
