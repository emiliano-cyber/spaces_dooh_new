# Tabla de revisión · lote piloto de inglés «propuestas»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/propuestas.ts` y de
los usos en el código (búsqueda literal de la clave). **437 claves.**

- **español** es la copia literal de lo que decía el componente antes del lote
  (comprobado comparando el HTML rendido de 20 estados de pantalla antes y
  después: idéntico byte a byte; ver `lib/i18n/pantallas-propuestas.test.ts`).
- Los huecos `{nombre}` se rellenan en tiempo de ejecución con datos o con
  importes ya formateados (`formatMonto`); ninguna cifra vive en el diccionario.
- `␣` marca un espacio al principio o al final del texto: es intencional, el
  texto va pegado a otro nodo.
- «qué es» lo asignó una heurística sobre la línea de uso; si discrepa de lo que
  se ve en pantalla, manda la pantalla.
- Las claves globales que el lote reutiliza (`comun.cancelar`, `comun.guardar`,
  `validacion.email`) ya estaban traducidas y no salen en esta tabla.

| clave | archivo:línea donde se usa | qué es | español | inglés |
|---|---|---|---|---|
| `propuestas.estatus.borrador` | `components/demo/propuestas/estatus.ts:33` | chip de estatus | Borrador | Draft |
| `propuestas.estatus.enviada` | `components/demo/propuestas/estatus.ts:34` | chip de estatus | Enviada | Sent |
| `propuestas.estatus.aprobada` | `components/demo/propuestas/estatus.ts:35` | chip de estatus | Aprobada | Approved |
| `propuestas.estatus.rechazada` | `components/demo/propuestas/estatus.ts:36` | chip de estatus | Rechazada | Rejected |
| `propuestas.unidad.sitio` | `app/(app)/(shell)/propuestas/page.tsx:362`<br>`app/(app)/(shell)/propuestas/page.tsx:1197`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:93` | palabra para conteo (singular/plural) | sitio | site |
| `propuestas.unidad.sitios` | `app/(app)/(shell)/propuestas/page.tsx:362`<br>`app/(app)/(shell)/propuestas/page.tsx:1197`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:93` | palabra para conteo (singular/plural) | sitios | sites |
| `propuestas.unidad.pantalla` | `app/(app)/(shell)/propuestas/[id]/page.tsx:1029` | palabra para conteo (singular/plural) | pantalla | screen |
| `propuestas.unidad.pantallas` | `app/(app)/(shell)/propuestas/[id]/page.tsx:1029` | palabra para conteo (singular/plural) | pantallas | screens |
| `propuestas.unidad.propuesta` | `app/(app)/(shell)/propuestas/page.tsx:194`<br>`app/(app)/(shell)/propuestas/page.tsx:251` | palabra para conteo (singular/plural) | propuesta | proposal |
| `propuestas.unidad.propuestas` | `app/(app)/(shell)/propuestas/page.tsx:195`<br>`app/(app)/(shell)/propuestas/page.tsx:251` | palabra para conteo (singular/plural) | propuestas | proposals |
| `propuestas.unidad.aprobada` | `app/(app)/(shell)/propuestas/page.tsx:212` | palabra para conteo (singular/plural) | aprobada | approved |
| `propuestas.unidad.aprobadas` | `app/(app)/(shell)/propuestas/page.tsx:212` | palabra para conteo (singular/plural) | aprobadas | approved |
| `propuestas.unidad.rechazada` | `app/(app)/(shell)/propuestas/page.tsx:214` | palabra para conteo (singular/plural) | rechazada | rejected |
| `propuestas.unidad.rechazadas` | `app/(app)/(shell)/propuestas/page.tsx:214` | palabra para conteo (singular/plural) | rechazadas | rejected |
| `propuestas.comun.error` | `app/(app)/(shell)/propuestas/page.tsx:413`<br>`app/(app)/(shell)/propuestas/page.tsx:427`<br>`app/(app)/(shell)/propuestas/page.tsx:431`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:162`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:195`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:209`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:320`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:332`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:344`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:348`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:361`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:140`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:154`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:167`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:186`<br>`components/demo/propuestas/BloqueCondicionesVigencia.tsx:62` | aviso emergente (error) | Error | Error |
| `propuestas.comun.aprobar-igual` | `app/(app)/(shell)/propuestas/page.tsx:410`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:317` | confirmación (diálogo del navegador) | ¿Aprobar de todas formas? | Approve anyway? |
| `propuestas.comun.sin-cliente` | `app/(app)/(shell)/propuestas/page.tsx:481`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:486` | texto / aviso en pantalla | Sin cliente | No client |
| `propuestas.comun.cliente` | `app/(app)/(shell)/propuestas/page.tsx:270`<br>`app/(app)/(shell)/propuestas/page.tsx:1297`<br>`components/demo/propuestas/ElegirClienteDialog.tsx:74` | etiqueta accesible (aria-label) | Cliente | Client |
| `propuestas.comun.agencia` | `app/(app)/(shell)/propuestas/page.tsx:1316`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:487` | rótulo de campo | Agencia | Agency |
| `propuestas.comun.via` | `app/(app)/(shell)/propuestas/page.tsx:483`<br>`app/(app)/propuesta/[id]/page.tsx:92` | texto / aviso en pantalla | ␣· vía {agencia} | ␣· via {agencia} |
| `propuestas.comun.total-con-iva` | `app/(app)/(shell)/propuestas/page.tsx:493` | texto / aviso en pantalla | total c/IVA | total incl. VAT |
| `propuestas.comun.iva` | `app/(app)/(shell)/propuestas/page.tsx:518`<br>`app/(app)/(shell)/propuestas/page.tsx:1785`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:607`<br>`app/(app)/propuesta/[id]/page.tsx:190` | rótulo de cifra | IVA {pct}% | VAT {pct}% |
| `propuestas.comun.bruto` | `app/(app)/(shell)/propuestas/page.tsx:1782` | rótulo de cifra | Bruto | Gross |
| `propuestas.comun.neto` | `app/(app)/(shell)/propuestas/page.tsx:1784`<br>`app/(app)/propuesta/[id]/page.tsx:189` | rótulo de cifra | Neto | Net |
| `propuestas.comun.total` | `app/(app)/propuesta/[id]/page.tsx:191` | rótulo de cifra | Total | Total |
| `propuestas.comun.bruto-lista` | `app/(app)/(shell)/propuestas/[id]/page.tsx:560`<br>`app/(app)/propuesta/[id]/page.tsx:169` | rótulo de cifra | Bruto (tarifa de lista) | Gross (list rate) |
| `propuestas.comun.paquete-conjunto` | `app/(app)/(shell)/propuestas/[id]/page.tsx:572`<br>`app/(app)/propuesta/[id]/page.tsx:171` | rótulo de cifra | Paquete "{nombre}" — precio del conjunto | Bundle "{nombre}" — price for the set |
| `propuestas.comun.descuento-volumen` | `app/(app)/(shell)/propuestas/[id]/page.tsx:582`<br>`app/(app)/propuesta/[id]/page.tsx:175` | rótulo de cifra | Descuento por volumen ({pct}%) | Volume discount ({pct}%) |
| `propuestas.comun.codigo-pct` | `app/(app)/(shell)/propuestas/[id]/page.tsx:594`<br>`app/(app)/propuesta/[id]/page.tsx:184` | rótulo de cifra | Código {codigo} ({pct}%) | Promo code {codigo} ({pct}%) |
| `propuestas.comun.enviar` | `app/(app)/(shell)/propuestas/page.tsx:585`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:442`<br>`components/demo/propuestas/EnviarPropuestaDialog.tsx:92` | botón | Enviar | Send |
| `propuestas.comun.reenviar` | `app/(app)/(shell)/propuestas/[id]/page.tsx:442`<br>`components/demo/propuestas/EnviarPropuestaDialog.tsx:91` | botón | Reenviar | Resend |
| `propuestas.comun.enviando` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:89` | botón | Enviando… | Sending… |
| `propuestas.comun.aprobar` | `app/(app)/(shell)/propuestas/page.tsx:589`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:447` | botón | Aprobar | Approve |
| `propuestas.comun.rechazar` | `app/(app)/(shell)/propuestas/page.tsx:590`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:448` | botón | Rechazar | Reject |
| `propuestas.comun.aplicar` | `app/(app)/(shell)/propuestas/[id]/page.tsx:676`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:768`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:324` | botón | Aplicar | Apply |
| `propuestas.comun.aplicando` | `app/(app)/(shell)/propuestas/[id]/page.tsx:768`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:324` | botón | Aplicando… | Applying… |
| `propuestas.comun.guardando` | `app/(app)/(shell)/propuestas/page.tsx:1273`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:676`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:232`<br>`components/demo/propuestas/BloqueCondicionesVigencia.tsx:112` | botón | Guardando… | Saving… |
| `propuestas.comun.quitando` | `app/(app)/(shell)/propuestas/[id]/page.tsx:728`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:260` | botón | Quitando… | Removing… |
| `propuestas.comun.generando` | `app/(app)/(shell)/propuestas/page.tsx:606`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:459`<br>`components/demo/propuestas/ElegirClienteDialog.tsx:64` | botón | Generando… | Generating… |
| `propuestas.comun.generar-campana` | `app/(app)/(shell)/propuestas/page.tsx:606`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:459` | botón | Generar campaña | Generate campaign |
| `propuestas.comun.campana-generada` | `app/(app)/(shell)/propuestas/page.tsx:597`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:1073` | botón | Campaña generada | Campaign generated |
| `propuestas.comun.agregar-sitios` | `app/(app)/(shell)/propuestas/page.tsx:1275`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:816` | botón | Agregar sitios | Add sites |
| `propuestas.comun.digital` | `app/(app)/(shell)/propuestas/page.tsx:1449`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:869` | texto / aviso en pantalla | Digital | Digital |
| `propuestas.comun.fija` | `app/(app)/(shell)/propuestas/page.tsx:1449`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:869` | texto / aviso en pantalla | Fija | Static |
| `propuestas.comun.desde` | `app/(app)/(shell)/propuestas/page.tsx:1345`<br>`components/demo/propuestas/TableroPropuestas.tsx:122` | rótulo de campo | Desde | From |
| `propuestas.comun.hasta` | `components/demo/propuestas/TableroPropuestas.tsx:124` | etiqueta accesible (aria-label) | Hasta | To |
| `propuestas.lista.titulo` | `app/(app)/(shell)/propuestas/page.tsx:163`<br>`app/(app)/(shell)/propuestas/page.tsx:496`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:248`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:251` | título | Propuestas | Proposals |
| `propuestas.lista.subtitulo` | `app/(app)/(shell)/propuestas/page.tsx:164` | título | Cotizaciones con método del divisor (bruto / neto) | Quotes using the divisor method (gross / net) |
| `propuestas.lista.nueva` | `app/(app)/(shell)/propuestas/page.tsx:168` | botón | Nueva propuesta | New proposal |
| `propuestas.lista.no-encontrada` | `app/(app)/(shell)/propuestas/page.tsx:121` | aviso emergente (error) | No se encontró la propuesta | The proposal was not found |
| `propuestas.lista.kpi.pipeline` | `app/(app)/(shell)/propuestas/page.tsx:189` | título de tarjeta KPI | En pipeline | In pipeline |
| `propuestas.lista.kpi.pipeline.sub` | `app/(app)/(shell)/propuestas/page.tsx:191` | subtítulo de tarjeta KPI | {propuestas} en borrador o enviadas · total c/IVA | {propuestas} in draft or sent · total incl. VAT |
| `propuestas.lista.kpi.enviadas` | `app/(app)/(shell)/propuestas/page.tsx:202` | título de tarjeta KPI | Enviadas sin respuesta | Sent, awaiting reply |
| `propuestas.lista.kpi.enviadas.sub` | `app/(app)/(shell)/propuestas/page.tsx:204` | subtítulo de tarjeta KPI | esperan que el cliente apruebe o rechace | waiting for the client to approve or reject |
| `propuestas.lista.kpi.ganado` | `app/(app)/(shell)/propuestas/page.tsx:209` | título de tarjeta KPI | Ganado (histórico) | Won (all time) |
| `propuestas.lista.kpi.ganado.sub` | `app/(app)/(shell)/propuestas/page.tsx:211` | subtítulo de tarjeta KPI | {aprobadas} · perdido {perdido} en {rechazadas} | {aprobadas} · lost {perdido} across {rechazadas} |
| `propuestas.lista.kpi.tasa` | `app/(app)/(shell)/propuestas/page.tsx:220` | título de tarjeta KPI | Tasa de cierre histórica | All-time close rate |
| `propuestas.lista.kpi.tasa.sub` | `app/(app)/(shell)/propuestas/page.tsx:224` | subtítulo de tarjeta KPI | aprobadas sobre {n} cerradas, desde siempre | approved out of {n} closed, all time |
| `propuestas.lista.kpi.tasa.sin-cierres` | `app/(app)/(shell)/propuestas/page.tsx:225` | subtítulo de tarjeta KPI | sin cierres aún | no closed proposals yet |
| `propuestas.lista.vacia` | `app/(app)/(shell)/propuestas/page.tsx:237` | texto / aviso en pantalla | Aún no hay propuestas. | No proposals yet. |
| `propuestas.lista.vacia.arma` | `app/(app)/(shell)/propuestas/page.tsx:238` | texto / aviso en pantalla | ␣Arma la primera con «Nueva propuesta». | ␣Create the first one with “New proposal”. |
| `propuestas.lista.tarjeta` | `app/(app)/(shell)/propuestas/page.tsx:245` | título | Lista de propuestas | Proposal list |
| `propuestas.lista.resumen` | `app/(app)/(shell)/propuestas/page.tsx:248` | texto / aviso en pantalla | {total} {propuestas} | {total} {propuestas} |
| `propuestas.lista.resumen.filtrado` | `app/(app)/(shell)/propuestas/page.tsx:248` | texto / aviso en pantalla | {n} de {total} {propuestas} | {n} of {total} {propuestas} |
| `propuestas.lista.filtro.estatus` | `app/(app)/(shell)/propuestas/page.tsx:258` | etiqueta accesible (aria-label) | Estatus | Status |
| `propuestas.lista.filtro.todas` | `app/(app)/(shell)/propuestas/page.tsx:260` | texto / aviso en pantalla | Todas | All |
| `propuestas.lista.filtro.todos-clientes` | `app/(app)/(shell)/propuestas/page.tsx:275` | opción de un selector | Todos los clientes | All clients |
| `propuestas.lista.filtro.buscar` | `app/(app)/(shell)/propuestas/page.tsx:283` | etiqueta accesible (aria-label) | Buscar propuesta | Search proposals |
| `propuestas.lista.filtro.buscar.ejemplo` | `app/(app)/(shell)/propuestas/page.tsx:286` | texto de ejemplo del campo (placeholder) | Folio o nombre… | Reference or name… |
| `propuestas.lista.sin-resultados` | `app/(app)/(shell)/propuestas/page.tsx:300` | texto / aviso en pantalla | Ninguna propuesta{estatus}{cliente}{busqueda}. Quita el filtro para ver las {n}. | No{estatus} proposals{cliente}{busqueda}. Clear the filter to see all {n}. |
| `propuestas.lista.sin-resultados.cliente` | `app/(app)/(shell)/propuestas/page.tsx:303` | texto / aviso en pantalla | ␣de {cliente} | ␣for {cliente} |
| `propuestas.lista.sin-resultados.ese-cliente` | `app/(app)/(shell)/propuestas/page.tsx:306` | texto / aviso en pantalla | ese cliente | that client |
| `propuestas.lista.sin-resultados.busqueda` | `app/(app)/(shell)/propuestas/page.tsx:309` | texto / aviso en pantalla | ␣que coincida con «{q}» | ␣matching “{q}” |
| `propuestas.fila.cupon-pendiente` | `app/(app)/(shell)/propuestas/page.tsx:475` | texto / aviso en pantalla | Cupón pendiente | Promo code pending |
| `propuestas.fila.cupon-pendiente.titulo` | `app/(app)/(shell)/propuestas/page.tsx:472` | tooltip (title) | El código {codigo} espera aprobación; el cliente todavía no lo ve | Promo code {codigo} is awaiting approval; the client can't see it yet |
| `propuestas.fila.abrir` | `app/(app)/(shell)/propuestas/page.tsx:499` | texto / aviso en pantalla | Abrir | Open |
| `propuestas.fila.bruto-lista` | `app/(app)/(shell)/propuestas/page.tsx:512` | rótulo de cifra | Bruto (lista) | Gross (list) |
| `propuestas.fila.comision` | `app/(app)/(shell)/propuestas/page.tsx:514` | rótulo de cifra | Comisión {pct}% · divisor {divisor} | Commission {pct}% · divisor {divisor} |
| `propuestas.fila.neto-propuesto` | `app/(app)/(shell)/propuestas/page.tsx:517` | rótulo de cifra | Neto propuesto | Proposed net |
| `propuestas.fila.aprobado` | `app/(app)/(shell)/propuestas/page.tsx:524` | texto / aviso en pantalla | Aprobado · {aprobados}/{sitios} | Approved · {aprobados}/{sitios} |
| `propuestas.fila.ninguno-aprobado` | `app/(app)/(shell)/propuestas/page.tsx:528` | texto / aviso en pantalla | —, aún no se aprueba ningún sitio{marca} | —, no site approved yet{marca} |
| `propuestas.fila.ninguno-aprobado.marca` | `app/(app)/(shell)/propuestas/page.tsx:529` | texto / aviso en pantalla | : marca las casillas de abajo | : tick the boxes below |
| `propuestas.fila.neto-aprobado` | `app/(app)/(shell)/propuestas/page.tsx:534` | texto / aviso en pantalla | Neto aprobado {aprobado} de {neto} · Total {total} | Approved net {aprobado} of {neto} · Total {total} |
| `propuestas.fila.chip-aprobado` | `app/(app)/(shell)/propuestas/page.tsx:560` | texto / aviso en pantalla | aprobado | approved |
| `propuestas.fila.cupo-lleno` | `app/(app)/(shell)/propuestas/page.tsx:572` | texto / aviso en pantalla | cupo lleno | quota full |
| `propuestas.fila.cupo-lleno.titulo` | `app/(app)/(shell)/propuestas/page.tsx:570` | tooltip (title) | La pantalla ya tiene su cupo de clientes en estas fechas ({clientes}). Al reservar se rechazará salvo que se libere o se suba el cupo. | This screen already has its full client quota for these dates ({clientes}). Booking it will be rejected unless a slot frees up or the quota is raised. |
| `propuestas.fila.ya-generada` | `app/(app)/(shell)/propuestas/page.tsx:596` | tooltip (title) | Esta propuesta ya generó su campaña | This proposal already generated its campaign |
| `propuestas.fila.ver-campana` | `app/(app)/(shell)/propuestas/page.tsx:600` | botón | Ver campaña | View campaign |
| `propuestas.alta.nombre-copia` | `app/(app)/(shell)/propuestas/page.tsx:657` | texto / aviso en pantalla | {nombre} (copia) | {nombre} (copy) |
| `propuestas.alta.titulo.agregar` | `app/(app)/(shell)/propuestas/page.tsx:1231` | título | Agregar sitios a «{nombre}» | Add sites to “{nombre}” |
| `propuestas.alta.titulo.duplicar` | `app/(app)/(shell)/propuestas/page.tsx:1233` | título | Duplicar propuesta | Duplicate proposal |
| `propuestas.alta.titulo.nueva` | `app/(app)/(shell)/propuestas/page.tsx:1234` | título | Nueva propuesta | New proposal |
| `propuestas.alta.subtitulo.agregar-enviada` | `app/(app)/(shell)/propuestas/page.tsx:1239` | título | Ya está enviada: agregar sitios sube la versión (renegociación). | Already sent: adding sites bumps the version (renegotiation). |
| `propuestas.alta.subtitulo.agregar` | `app/(app)/(shell)/propuestas/page.tsx:1240` | título | Se cotizan con el periodo de la propuesta. | They are quoted for the proposal's period. |
| `propuestas.alta.subtitulo.duplicar` | `app/(app)/(shell)/propuestas/page.tsx:1242` | título | Mismos sitios y contratación; los precios se calculan con la tarifa de hoy. | Same sites and booking; prices are calculated at today's rate. |
| `propuestas.alta.subtitulo.nueva` | `app/(app)/(shell)/propuestas/page.tsx:1243` | título | Selecciona sitios; el método del divisor calcula bruto → neto | Select sites; the divisor method calculates gross → net |
| `propuestas.alta.error.comision-vacia` | `app/(app)/(shell)/propuestas/page.tsx:1088` | mensaje de error | Escribe un porcentaje de comisión (0 si no hay). | Enter a commission percentage (0 if none). |
| `propuestas.alta.error.comision-negativa` | `app/(app)/(shell)/propuestas/page.tsx:1090` | mensaje de error | La comisión no puede ser negativa. | The commission cannot be negative. |
| `propuestas.alta.error.comision-cien` | `app/(app)/(shell)/propuestas/page.tsx:1092` | texto / aviso en pantalla | La comisión debe ser menor que 100%: al 100% el neto de la propuesta sería cero. | The commission must be less than 100%: at 100% the proposal's net would be zero. |
| `propuestas.alta.error.duracion` | `app/(app)/(shell)/propuestas/page.tsx:1096` | mensaje de error | La duración debe ser de al menos 1 periodo. | The duration must be at least 1 period. |
| `propuestas.alta.error.fechas` | `app/(app)/(shell)/propuestas/page.tsx:1099` | mensaje de error | La fecha de fin no puede ser anterior a la de inicio. | The end date cannot be earlier than the start date. |
| `propuestas.alta.error.tarifa` | `app/(app)/(shell)/propuestas/page.tsx:1122` | mensaje de error | {sitio}: la tarifa no se entiende. Corrígela antes de guardar. | {sitio}: the rate can't be read. Fix it before saving. |
| `propuestas.alta.error.renta` | `app/(app)/(shell)/propuestas/page.tsx:1123` | mensaje de error | {sitio}: la renta no se entiende. Corrígela antes de guardar. | {sitio}: the rent can't be read. Fix it before saving. |
| `propuestas.alta.error.spots` | `app/(app)/(shell)/propuestas/page.tsx:1124` | mensaje de error | {sitio}: los spots por día no se entienden. Corrígelos antes de guardar. | {sitio}: the spots per day can't be read. Fix them before saving. |
| `propuestas.alta.error.crear` | `app/(app)/(shell)/propuestas/page.tsx:1217` | texto / aviso en pantalla | No se pudo crear la propuesta | The proposal could not be created |
| `propuestas.alta.agregados.uno` | `app/(app)/(shell)/propuestas/page.tsx:1196` | aviso emergente (éxito) | {sitios} agregado | {sitios} added |
| `propuestas.alta.agregados.otros` | `app/(app)/(shell)/propuestas/page.tsx:1196` | aviso emergente (éxito) | {sitios} agregados | {sitios} added |
| `propuestas.alta.pie.volumen` | `app/(app)/(shell)/propuestas/page.tsx:1258` | texto / aviso en pantalla | Volumen: {monto} | Volume: {monto} |
| `propuestas.alta.pie.total` | `app/(app)/(shell)/propuestas/page.tsx:1264` | texto / aviso en pantalla | Total c/IVA: {total} | Total incl. VAT: {total} |
| `propuestas.alta.crear` | `app/(app)/(shell)/propuestas/page.tsx:1276` | texto / aviso en pantalla | Crear propuesta | Create proposal |
| `propuestas.alta.periodo` | `app/(app)/(shell)/propuestas/page.tsx:1287` | texto / aviso en pantalla | Periodo de la propuesta: {periodo}. Los sitios nuevos se cotizan con esas fechas y con la tarifa de hoy. | Proposal period: {periodo}. New sites are quoted for those dates and at today's rate. |
| `propuestas.alta.nombre` | `app/(app)/(shell)/propuestas/page.tsx:1293` | rótulo de campo | Nombre de la propuesta | Proposal name |
| `propuestas.alta.sin-cliente` | `app/(app)/(shell)/propuestas/page.tsx:1309` | opción de un selector | — Sin cliente — | — No client — |
| `propuestas.alta.sin-agencias` | `app/(app)/(shell)/propuestas/page.tsx:1319` | texto / aviso en pantalla | Crea un cliente tipo «Agencia» para asociarla | Create a client of type “Agency” to link one |
| `propuestas.alta.sin-agencia` | `app/(app)/(shell)/propuestas/page.tsx:1323` | opción de un selector | — Sin agencia (directo) — | — No agency (direct) — |
| `propuestas.alta.negociacion.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1335` | título | La negociación con «{agencia}» no está validada | The negotiation with “{agencia}” is not validated |
| `propuestas.alta.negociacion.texto` | `app/(app)/(shell)/propuestas/page.tsx:1338` | texto / aviso en pantalla | Valida la negociación de la agencia en Clientes para poder crear la propuesta. | Validate the agency's negotiation in Clients to be able to create the proposal. |
| `propuestas.alta.duracion` | `app/(app)/(shell)/propuestas/page.tsx:1346` | rótulo de campo | Duración de la campaña | Campaign duration |
| `propuestas.alta.hasta` | `app/(app)/(shell)/propuestas/page.tsx:1369` | rótulo de campo | Hasta (se calcula de la duración, o escríbela) | To (calculated from the duration, or type it) |
| `propuestas.alta.comision` | `app/(app)/(shell)/propuestas/page.tsx:1391` | rótulo de campo | Comisión de la agencia (%) | Agency commission (%) |
| `propuestas.alta.sitios` | `app/(app)/(shell)/propuestas/page.tsx:1400` | texto / aviso en pantalla | Sitios ({n}) | Sites ({n}) |
| `propuestas.alta.vista.lista` | `app/(app)/(shell)/propuestas/page.tsx:1411` | texto / aviso en pantalla | Lista | List |
| `propuestas.alta.vista.mapa` | `app/(app)/(shell)/propuestas/page.tsx:1420` | texto / aviso en pantalla | Mapa | Map |
| `propuestas.alta.ya-en-propuesta` | `app/(app)/(shell)/propuestas/page.tsx:1439` | texto / aviso en pantalla | ya en la propuesta | already in the proposal |
| `propuestas.alta.mapa.ayuda` | `app/(app)/(shell)/propuestas/page.tsx:1481` | texto / aviso en pantalla | Toca un punto para agregar o quitar el sitio. O usa {dibujar} para quedarte solo con las pantallas de esa área (se descartan las demás). | Tap a point to add or remove the site. Or use {dibujar} to keep only the screens in that area (the rest are dropped). |
| `propuestas.alta.mapa.dibujar` | `app/(app)/(shell)/propuestas/page.tsx:1482` | texto / aviso en pantalla | Dibujar zona | Draw area |
| `propuestas.alta.contratacion` | `app/(app)/(shell)/propuestas/page.tsx:1492` | texto / aviso en pantalla | Contratación por sitio | Per-site booking |
| `propuestas.alta.franja.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1539` | tooltip (title) | Franja horaria contratada. Es un compromiso comercial: no se envía al CMS. | Booked daypart. It is a commercial commitment: it is not sent to the CMS. |
| `propuestas.alta.franja.todo-el-dia` | `app/(app)/(shell)/propuestas/page.tsx:1541` | opción de un selector | Todo el día | All day |
| `propuestas.alta.salidas.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1552` | tooltip (title) | Salidas que salen de la calculadora de abajo | Plays from the calculator below |
| `propuestas.alta.salidas` | `app/(app)/(shell)/propuestas/page.tsx:1553` | texto / aviso en pantalla | {n} salidas | {n} plays |
| `propuestas.alta.cpm.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1573` | título | Millares de impactos contratados (1 millar = {mil} impactos) | Thousands of impressions booked (1 thousand = {mil} impressions) |
| `propuestas.alta.cantidad.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1574` | título | Nº de {unidad} | No. of {unidad} |
| `propuestas.alta.periodos.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1578` | tooltip (title) | Periodos calculados del rango de fechas | Periods calculated from the date range |
| `propuestas.alta.cpm.equivale` | `app/(app)/(shell)/propuestas/page.tsx:1587` | texto / aviso en pantalla | millares = {n} impactos | thousands = {n} impressions |
| `propuestas.alta.programacion.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1593` | tooltip (title) | Programación que sale de la calculadora | Schedule from the calculator |
| `propuestas.alta.pases-dia` | `app/(app)/(shell)/propuestas/page.tsx:1596` | texto / aviso en pantalla | {n} pases/día | {n} plays/day |
| `propuestas.alta.spots-dia.ejemplo` | `app/(app)/(shell)/propuestas/page.tsx:1603` | texto de ejemplo del campo (placeholder) | spots/día | spots/day |
| `propuestas.alta.spots-dia.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1607` | tooltip (title) | Programación: cuántas veces al día se muestra (opcional) | Schedule: how many times a day it plays (optional) |
| `propuestas.alta.fija.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1610` | tooltip (title) | Las pantallas fijas no manejan spots | Static screens don't use spots |
| `propuestas.alta.fija.sin-spots` | `app/(app)/(shell)/propuestas/page.tsx:1611` | texto / aviso en pantalla | Fija · sin spots | Static · no spots |
| `propuestas.alta.tarifa.ayuda` | `app/(app)/(shell)/propuestas/page.tsx:1623` | tooltip (title) | Tarifa por unidad. Déjala vacía para usar la calculada. | Rate per unit. Leave it empty to use the calculated one. |
| `propuestas.alta.tarifa` | `app/(app)/(shell)/propuestas/page.tsx:1624` | texto / aviso en pantalla | Tarifa | Rate |
| `propuestas.alta.tarifa.aria` | `app/(app)/(shell)/propuestas/page.tsx:1626` | etiqueta accesible (aria-label) | Tarifa por unidad de {sitio} | Rate per unit for {sitio} |
| `propuestas.alta.tarifa.sin` | `app/(app)/(shell)/propuestas/page.tsx:1627` | texto de ejemplo del campo (placeholder) | sin tarifa | no rate |
| `propuestas.alta.tarifa.calculada` | `app/(app)/(shell)/propuestas/page.tsx:1637` | texto / aviso en pantalla | calculada {monto} | calculated {monto} |
| `propuestas.alta.tarifa.sistema` | `app/(app)/(shell)/propuestas/page.tsx:1644` | tooltip (title) | Tarifa calculada por el sistema. Solo un gerente o superior puede cambiarla. | Rate calculated by the system. Only a manager or above can change it. |
| `propuestas.alta.tarifa.monto` | `app/(app)/(shell)/propuestas/page.tsx:1647` | texto / aviso en pantalla | Tarifa {monto} | Rate {monto} |
| `propuestas.alta.tarifa.pide-gerente` | `app/(app)/(shell)/propuestas/page.tsx:1648` | texto / aviso en pantalla | Sin tarifa · pide a un gerente | No rate · ask a manager |
| `propuestas.alta.renta.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1688`<br>`app/(app)/(shell)/propuestas/page.tsx:1710` | título | Renta al arrendador | Rent to landlord |
| `propuestas.alta.renta.pactada` | `app/(app)/(shell)/propuestas/page.tsx:1693` | texto / aviso en pantalla | ya pactada en el contrato{predio} · costo {costo}/mes | already agreed in the{predio} contract · cost {costo}/month |
| `propuestas.alta.renta.pactada.predio` | `app/(app)/(shell)/propuestas/page.tsx:1694` | texto / aviso en pantalla | ␣del predio | ␣property |
| `propuestas.alta.propia` | `app/(app)/(shell)/propuestas/page.tsx:1704` | texto / aviso en pantalla | Pantalla propia | Owned screen |
| `propuestas.alta.propia.texto` | `app/(app)/(shell)/propuestas/page.tsx:1705` | texto / aviso en pantalla | sin renta · su costo es luz y operación | no rent · its cost is power and operation |
| `propuestas.alta.renta.a-quien` | `app/(app)/(shell)/propuestas/page.tsx:1715` | tooltip (title) | A quién se le paga | Who gets paid |
| `propuestas.alta.renta.arrendador` | `app/(app)/(shell)/propuestas/page.tsx:1717` | opción de un selector | Arrendador… | Landlord… |
| `propuestas.alta.renta.importe` | `app/(app)/(shell)/propuestas/page.tsx:1723` | texto de ejemplo del campo (placeholder) | importe | amount |
| `propuestas.alta.renta.cada-cuando` | `app/(app)/(shell)/propuestas/page.tsx:1733` | tooltip (title) | Cada cuándo se paga | How often it is paid |
| `propuestas.alta.renta.sospechosa` | `app/(app)/(shell)/propuestas/page.tsx:1747` | texto / aviso en pantalla | ⚠ La renta ({renta}) iguala o supera lo que le cobras al cliente ({precio}): la campaña saldría a pérdida. Aquí va lo que le pagas al PROPIETARIO, no el precio de venta. | ⚠ The rent ({renta}) equals or exceeds what you charge the client ({precio}): the campaign would run at a loss. This is what you pay the LANDLORD, not the sale price. |
| `propuestas.alta.renta.falta-propietario` | `app/(app)/(shell)/propuestas/page.tsx:1755` | texto / aviso en pantalla | ⚠ Falta elegir el propietario: el contrato nacerá pendiente y no se generará el calendario de pagos. | ⚠ Choose the landlord: otherwise the contract will be created as pending and no payment schedule will be generated. |
| `propuestas.alta.renta.falta-importe` | `app/(app)/(shell)/propuestas/page.tsx:1756` | texto / aviso en pantalla | ⚠ Falta el importe: el contrato nacerá pendiente y no se generará el calendario de pagos. | ⚠ The amount is missing: the contract will be created as pending and no payment schedule will be generated. |
| `propuestas.alta.renta.completo` | `app/(app)/(shell)/propuestas/page.tsx:1760` | texto / aviso en pantalla | Costo {costo}/mes · el contrato nacerá completo y con su calendario de pagos | Cost {costo}/month · the contract will be created complete, with its payment schedule |
| `propuestas.alta.renta.opcional` | `app/(app)/(shell)/propuestas/page.tsx:1764` | texto / aviso en pantalla | Opcional · sin esto el contrato nace pendiente y habrá que capturarlo después en Arrendadores | Optional · without this the contract is created as pending and must be filled in later under Landlords |
| `propuestas.alta.elige-fechas` | `app/(app)/(shell)/propuestas/page.tsx:1775` | texto / aviso en pantalla | Elige las fechas para calcular los periodos y el precio. | Choose the dates to calculate the periods and the price. |
| `propuestas.alta.divisor` | `app/(app)/(shell)/propuestas/page.tsx:1783` | rótulo de cifra | Divisor ({pct}%) | Divisor ({pct}%) |
| `propuestas.calc.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1865` | título | Calculadora de spots | Spot calculator |
| `propuestas.calc.apagada` | `app/(app)/(shell)/propuestas/page.tsx:1868` | texto / aviso en pantalla | Apagada: la cantidad de spots se captura a mano. | Off: the number of spots is entered by hand. |
| `propuestas.calc.espacios.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1872` | tooltip (title) | Cuántos espacios del loop compra esta línea | How many loop slots this line buys |
| `propuestas.calc.espacios` | `app/(app)/(shell)/propuestas/page.tsx:1873` | texto / aviso en pantalla | Espacios del loop | Loop slots |
| `propuestas.calc.espacios.aria` | `app/(app)/(shell)/propuestas/page.tsx:1879` | etiqueta accesible (aria-label) | Espacios del loop de {sitio} | Loop slots for {sitio} |
| `propuestas.calc.de-total` | `app/(app)/(shell)/propuestas/page.tsx:1886` | texto / aviso en pantalla | de {total} · {libres} | of {total} · {libres} |
| `propuestas.calc.libres` | `app/(app)/(shell)/propuestas/page.tsx:1888` | texto / aviso en pantalla | {n} libres | {n} free |
| `propuestas.calc.libres-sin-dato` | `app/(app)/(shell)/propuestas/page.tsx:1888` | texto / aviso en pantalla | libres sin dato | free slots unknown |
| `propuestas.calc.horas.franja` | `app/(app)/(shell)/propuestas/page.tsx:1896` | texto / aviso en pantalla | Las horas de la franja {franja}; se pueden bajar | The hours of the {franja} daypart; they can be lowered |
| `propuestas.calc.horas.horario` | `app/(app)/(shell)/propuestas/page.tsx:1897` | texto / aviso en pantalla | Las horas del horario de la pantalla; se pueden bajar | The hours of the screen's schedule; they can be lowered |
| `propuestas.calc.horas` | `app/(app)/(shell)/propuestas/page.tsx:1900` | texto / aviso en pantalla | Horas al día | Hours per day |
| `propuestas.calc.horas.aria` | `app/(app)/(shell)/propuestas/page.tsx:1906` | etiqueta accesible (aria-label) | Horas al día de {sitio} | Hours per day for {sitio} |
| `propuestas.calc.roadblock.titulo` | `app/(app)/(shell)/propuestas/page.tsx:1915` | tooltip (title) | Compra TODOS los espacios del loop; exige que estén libres | Buys ALL the loop slots; requires them to be free |
| `propuestas.calc.prima.puede` | `app/(app)/(shell)/propuestas/page.tsx:1928` | texto / aviso en pantalla | Porcentaje encima de la tarifa por spot. Queda como ajuste a tu nombre. | Percentage on top of the per-spot rate. It is recorded as an adjustment under your name. |
| `propuestas.calc.prima.no-puede` | `app/(app)/(shell)/propuestas/page.tsx:1929` | texto / aviso en pantalla | Solo un gerente o superior puede poner prima a un Roadblock. | Only a manager or above can add a premium to a Roadblock. |
| `propuestas.calc.prima` | `app/(app)/(shell)/propuestas/page.tsx:1932` | texto / aviso en pantalla | Prima % | Premium % |
| `propuestas.calc.prima.aria` | `app/(app)/(shell)/propuestas/page.tsx:1938` | etiqueta accesible (aria-label) | Prima de Roadblock de {sitio} | Roadblock premium for {sitio} |
| `propuestas.calc.loop` | `app/(app)/(shell)/propuestas/page.tsx:1950` | texto / aviso en pantalla | Loop de {n} {anunciantes} | Loop of {n} {anunciantes} |
| `propuestas.calc.anunciante` | `app/(app)/(shell)/propuestas/page.tsx:1952` | texto / aviso en pantalla | anunciante | advertiser |
| `propuestas.calc.anunciantes` | `app/(app)/(shell)/propuestas/page.tsx:1952` | texto / aviso en pantalla | anunciantes | advertisers |
| `propuestas.calc.loop.hoy` | `app/(app)/(shell)/propuestas/page.tsx:1956` | texto / aviso en pantalla | ␣({n} hoy + esta línea) | ␣({n} today + this line) |
| `propuestas.calc.rotaciones` | `app/(app)/(shell)/propuestas/page.tsx:1964` | texto / aviso en pantalla | {n} rotaciones/h | {n} rotations/h |
| `propuestas.calc.spots-dia` | `app/(app)/(shell)/propuestas/page.tsx:1965` | texto / aviso en pantalla | · {spots} spots/día × {dias} {unidad} = | · {spots} spots/day × {dias} {unidad} = |
| `propuestas.calc.dia` | `app/(app)/(shell)/propuestas/page.tsx:1968` | texto / aviso en pantalla | día | day |
| `propuestas.calc.dias` | `app/(app)/(shell)/propuestas/page.tsx:1968` | texto / aviso en pantalla | días | days |
| `propuestas.calc.rb.hora` | `app/(app)/(shell)/propuestas/page.tsx:1976` | texto / aviso en pantalla | Hora del loop: {tarifa} × {loop} ÷ {horas} h = {ingreso}{prima} ÷ {spots} spots = {precio} | Loop hour: {tarifa} × {loop} ÷ {horas} h = {ingreso}{prima} ÷ {spots} spots = {precio} |
| `propuestas.calc.rb.prima` | `app/(app)/(shell)/propuestas/page.tsx:1983` | texto / aviso en pantalla | ␣+ prima {pct} % = {monto} | ␣+ premium {pct} % = {monto} |
| `propuestas.calc.por-spot` | `app/(app)/(shell)/propuestas/page.tsx:1991`<br>`app/(app)/(shell)/propuestas/page.tsx:2004` | texto / aviso en pantalla | {monto} por spot | {monto} per spot |
| `propuestas.calc.mensual` | `app/(app)/(shell)/propuestas/page.tsx:2000` | texto / aviso en pantalla | Tarifa mensual {tarifa} ÷ {spots} spots de un anunciante al mes = {precio} | Monthly rate {tarifa} ÷ {spots} spots of one advertiser per month = {precio} |
| `propuestas.calc.pon-fechas` | `app/(app)/(shell)/propuestas/page.tsx:2015` | texto / aviso en pantalla | Pon las fechas para calcular los spots. | Set the dates to calculate the spots. |
| `propuestas.calc.horario-ilegible` | `app/(app)/(shell)/propuestas/page.tsx:2019` | texto / aviso en pantalla | No se entiende el horario de la pantalla («{horario}»): se toman 18 h al día. | The screen's schedule can't be read (“{horario}”): 18 h per day is assumed. |
| `propuestas.calc.horario-vacio` | `app/(app)/(shell)/propuestas/page.tsx:2019` | texto / aviso en pantalla | vacío | empty |
| `propuestas.calc.sin-tarifa` | `app/(app)/(shell)/propuestas/page.tsx:2024` | texto / aviso en pantalla | La pantalla no tiene tarifa mensual: el precio por spot sale de ella. Pide a un gerente que lo ponga. | The screen has no monthly rate, and the per-spot price comes from it. Ask a manager to set it. |
| `propuestas.embudo.titulo` | `app/(app)/(shell)/propuestas/page.tsx:2057` | título | Embudo histórico | Historical funnel |
| `propuestas.embudo.enviadas` | `app/(app)/(shell)/propuestas/page.tsx:2059` | rótulo de cifra | Enviadas | Sent |
| `propuestas.embudo.aprobadas` | `app/(app)/(shell)/propuestas/page.tsx:2060` | rótulo de cifra | Aprobadas | Approved |
| `propuestas.embudo.perdidas` | `app/(app)/(shell)/propuestas/page.tsx:2061` | rótulo de cifra | Perdidas | Lost |
| `propuestas.ficha.descuento.invalido` | `app/(app)/(shell)/propuestas/[id]/page.tsx:147` | aviso emergente (error) | Descuento inválido (0–100) | Invalid discount (0–100) |
| `propuestas.ficha.descuento.tope` | `app/(app)/(shell)/propuestas/[id]/page.tsx:154` | aviso emergente (error) | El descuento máximo que autoriza tu organización es {tope} % | The maximum discount your organization allows is {tope} % |
| `propuestas.ficha.descuento.actualizado` | `app/(app)/(shell)/propuestas/[id]/page.tsx:160` | aviso emergente (éxito) | Descuento actualizado | Discount updated |
| `propuestas.ficha.paquete.elige` | `app/(app)/(shell)/propuestas/[id]/page.tsx:185` | aviso emergente (error) | Elige un paquete | Choose a bundle |
| `propuestas.ficha.paquete.aplicado` | `app/(app)/(shell)/propuestas/[id]/page.tsx:191` | aviso emergente (éxito) | Paquete {nombre} aplicado: {precio} por el conjunto | Bundle {nombre} applied: {precio} for the set |
| `propuestas.ficha.paquete.quitado` | `app/(app)/(shell)/propuestas/[id]/page.tsx:206` | aviso emergente (éxito) | Paquete quitado; vuelven los precios de lista de cada pantalla | Bundle removed; each screen's list prices are back |
| `propuestas.ficha.copiado` | `app/(app)/(shell)/propuestas/[id]/page.tsx:215` | texto / aviso en pantalla | Copiado | Copied |
| `propuestas.ficha.copia-esto` | `app/(app)/(shell)/propuestas/[id]/page.tsx:220` | diálogo del navegador | Copia esto: | Copy this: |
| `propuestas.ficha.sin-liga` | `app/(app)/(shell)/propuestas/[id]/page.tsx:230` | aviso emergente (error) | Esta propuesta aún no tiene liga; vuelve a guardarla. | This proposal has no link yet; save it again. |
| `propuestas.ficha.liga-copiada` | `app/(app)/(shell)/propuestas/[id]/page.tsx:233` | texto / aviso en pantalla | Liga de la propuesta copiada | Proposal link copied |
| `propuestas.ficha.no-encontrada` | `app/(app)/(shell)/propuestas/[id]/page.tsx:260` | texto / aviso en pantalla | Propuesta no encontrada. | Proposal not found. |
| `propuestas.ficha.volver` | `app/(app)/(shell)/propuestas/[id]/page.tsx:262` | texto / aviso en pantalla | Volver a propuestas | Back to proposals |
| `propuestas.ficha.borrar.confirmar` | `app/(app)/(shell)/propuestas/[id]/page.tsx:326` | confirmación (diálogo del navegador) | ¿Borrar el borrador «{nombre}»? No se puede deshacer. | Delete the draft “{nombre}”? This cannot be undone. |
| `propuestas.ficha.borrar.hecho` | `app/(app)/(shell)/propuestas/[id]/page.tsx:329` | aviso emergente (éxito) | Borrador borrado | Draft deleted |
| `propuestas.ficha.quitar-sitio.aviso` | `app/(app)/(shell)/propuestas/[id]/page.tsx:338` | texto / aviso en pantalla | ␣La propuesta ya está enviada: subirá de versión. | ␣The proposal has already been sent: its version will go up. |
| `propuestas.ficha.quitar-sitio.confirmar` | `app/(app)/(shell)/propuestas/[id]/page.tsx:339` | confirmación (diálogo del navegador) | ¿Quitar «{sitio}» de la propuesta?{aviso} | Remove “{sitio}” from the proposal?{aviso} |
| `propuestas.ficha.quitar-sitio.hecho` | `app/(app)/(shell)/propuestas/[id]/page.tsx:342` | aviso emergente (éxito) | Sitio quitado | Site removed |
| `propuestas.ficha.version.titulo` | `app/(app)/(shell)/propuestas/[id]/page.tsx:391` | tooltip (title) | Versión (sube en cada renegociación) | Version (goes up with each renegotiation) |
| `propuestas.ficha.vencida` | `app/(app)/(shell)/propuestas/[id]/page.tsx:405` | texto / aviso en pantalla | Vencida el {fecha} | Expired on {fecha} |
| `propuestas.ficha.valida-hasta` | `app/(app)/(shell)/propuestas/[id]/page.tsx:406` | texto / aviso en pantalla | Válida hasta {fecha} | Valid until {fecha} |
| `propuestas.ficha.folio` | `app/(app)/(shell)/propuestas/[id]/page.tsx:411` | texto / aviso en pantalla | Folio interno: | Internal ref.: |
| `propuestas.ficha.folio.nota` | `app/(app)/(shell)/propuestas/[id]/page.tsx:412` | texto / aviso en pantalla | · el cliente accede solo por la liga (token) | · the client only gets access through the link (token) |
| `propuestas.ficha.copiado-boton` | `app/(app)/(shell)/propuestas/[id]/page.tsx:420` | botón | ¡Copiado! | Copied! |
| `propuestas.ficha.copiar-liga` | `app/(app)/(shell)/propuestas/[id]/page.tsx:422` | botón | Copiar liga | Copy link |
| `propuestas.ficha.duplicar` | `app/(app)/(shell)/propuestas/[id]/page.tsx:429` | botón | Duplicar | Duplicate |
| `propuestas.ficha.generar-pdf` | `app/(app)/(shell)/propuestas/[id]/page.tsx:433` | botón | Generar PDF | Generate PDF |
| `propuestas.ficha.borrar.titulo` | `app/(app)/(shell)/propuestas/[id]/page.tsx:452` | tooltip (title) | Solo los borradores se pueden borrar | Only drafts can be deleted |
| `propuestas.ficha.borrar` | `app/(app)/(shell)/propuestas/[id]/page.tsx:453` | botón | Borrar | Delete |
| `propuestas.ficha.meta.fechas` | `app/(app)/(shell)/propuestas/[id]/page.tsx:484` | rótulo de cifra | Fechas | Dates |
| `propuestas.ficha.meta.anunciante` | `app/(app)/(shell)/propuestas/[id]/page.tsx:486` | rótulo de cifra | Anunciante | Advertiser |
| `propuestas.ficha.meta.directa` | `app/(app)/(shell)/propuestas/[id]/page.tsx:487` | rótulo de cifra | Directa | Direct |
| `propuestas.ficha.meta.comision` | `app/(app)/(shell)/propuestas/[id]/page.tsx:488` | rótulo de cifra | Comisión | Commission |
| `propuestas.ficha.resumen` | `app/(app)/(shell)/propuestas/[id]/page.tsx:495` | título | Resumen económico | Financial summary |
| `propuestas.ficha.kpi.total` | `app/(app)/(shell)/propuestas/[id]/page.tsx:505` | título de tarjeta KPI | Total c/IVA | Total incl. VAT |
| `propuestas.ficha.kpi.total.sub` | `app/(app)/(shell)/propuestas/[id]/page.tsx:507` | subtítulo de tarjeta KPI | lo que paga el cliente · {sitios} | what the client pays · {sitios} |
| `propuestas.ficha.kpi.neto` | `app/(app)/(shell)/propuestas/[id]/page.tsx:512` | título de tarjeta KPI | Neto para el medio | Net to the media owner |
| `propuestas.ficha.kpi.neto.sub` | `app/(app)/(shell)/propuestas/[id]/page.tsx:516` | subtítulo de tarjeta KPI | después de {pct}% de comisión de agencia | after {pct}% agency commission |
| `propuestas.ficha.kpi.neto.directa` | `app/(app)/(shell)/propuestas/[id]/page.tsx:517` | subtítulo de tarjeta KPI | venta directa, sin comisión | direct sale, no commission |
| `propuestas.ficha.kpi.renta` | `app/(app)/(shell)/propuestas/[id]/page.tsx:526` | título de tarjeta KPI | Renta de referencia | Reference rent |
| `propuestas.ficha.kpi.renta.sin-permiso` | `app/(app)/(shell)/propuestas/[id]/page.tsx:530` | subtítulo de tarjeta KPI | requiere permiso de Arrendadores | requires Landlords permission |
| `propuestas.ficha.kpi.renta.ninguna` | `app/(app)/(shell)/propuestas/[id]/page.tsx:532` | subtítulo de tarjeta KPI | ninguna pantalla tiene renta capturada | no screen has rent entered |
| `propuestas.ficha.kpi.renta.suma` | `app/(app)/(shell)/propuestas/[id]/page.tsx:533` | texto / aviso en pantalla | suma de las rentas de contrato{sin} | sum of contract rents{sin} |
| `propuestas.ficha.kpi.renta.sin-contrato` | `app/(app)/(shell)/propuestas/[id]/page.tsx:534` | texto / aviso en pantalla | ␣· {n} sin contrato | ␣· {n} without a contract |
| `propuestas.ficha.kpi.aprobado` | `app/(app)/(shell)/propuestas/[id]/page.tsx:540` | título de tarjeta KPI | Aprobado | Approved |
| `propuestas.ficha.kpi.aprobado.ninguno` | `app/(app)/(shell)/propuestas/[id]/page.tsx:544` | subtítulo de tarjeta KPI | ningún sitio aprobado de {n} | no site approved out of {n} |
| `propuestas.ficha.kpi.aprobado.sub` | `app/(app)/(shell)/propuestas/[id]/page.tsx:545` | subtítulo de tarjeta KPI | total c/IVA · {aprobados} de {sitios} | total incl. VAT · {aprobados} of {sitios} |
| `propuestas.ficha.descuento-comercial-pct` | `app/(app)/(shell)/propuestas/[id]/page.tsx:587` | rótulo de cifra | Descuento comercial ({pct}%) | Commercial discount ({pct}%) |
| `propuestas.ficha.codigo-pendiente` | `app/(app)/(shell)/propuestas/[id]/page.tsx:598` | texto / aviso en pantalla | ␣· cupón pendiente de aprobación | ␣· promo code pending approval |
| `propuestas.ficha.base` | `app/(app)/(shell)/propuestas/[id]/page.tsx:604` | rótulo de cifra | Base con descuento | Discounted base |
| `propuestas.ficha.comision` | `app/(app)/(shell)/propuestas/[id]/page.tsx:605` | rótulo de cifra | Comisión de agencia ({pct}%) · divisor ×{divisor} | Agency commission ({pct}%) · divisor ×{divisor} |
| `propuestas.ficha.neto` | `app/(app)/(shell)/propuestas/[id]/page.tsx:606` | rótulo de cifra | Neto (para el medio) | Net (to the media owner) |
| `propuestas.ficha.total` | `app/(app)/(shell)/propuestas/[id]/page.tsx:609` | rótulo de cifra | Total que paga el cliente | Total the client pays |
| `propuestas.ficha.aprobado` | `app/(app)/(shell)/propuestas/[id]/page.tsx:618` | texto / aviso en pantalla | Sobre lo aprobado · {aprobados}/{sitios} | Approved portion · {aprobados}/{sitios} |
| `propuestas.ficha.ninguno-aprobado` | `app/(app)/(shell)/propuestas/[id]/page.tsx:622` | texto / aviso en pantalla | Aún no se aprueba ningún sitio{marca}. | No site approved yet{marca}. |
| `propuestas.ficha.ninguno-aprobado.marca` | `app/(app)/(shell)/propuestas/[id]/page.tsx:623` | texto / aviso en pantalla | : marca las casillas de la tabla «Sitios y renta» | : tick the boxes in the “Sites and rent” table |
| `propuestas.ficha.aprobado.bruto` | `app/(app)/(shell)/propuestas/[id]/page.tsx:629` | texto / aviso en pantalla | Bruto {monto} | Gross {monto} |
| `propuestas.ficha.aprobado.neto` | `app/(app)/(shell)/propuestas/[id]/page.tsx:634` | texto / aviso en pantalla | Neto {monto} | Net {monto} |
| `propuestas.ficha.aprobado.total` | `app/(app)/(shell)/propuestas/[id]/page.tsx:639` | texto / aviso en pantalla | Total {monto} | Total {monto} |
| `propuestas.ficha.descuento` | `app/(app)/(shell)/propuestas/[id]/page.tsx:651` | texto / aviso en pantalla | Descuento comercial | Commercial discount |
| `propuestas.ficha.descuento.ayuda` | `app/(app)/(shell)/propuestas/[id]/page.tsx:653` | texto / aviso en pantalla | Rebaja sobre la tarifa de lista (distinta de la comisión de agencia). Cambiarlo en una propuesta ya {enviada} sube la versión (renegociación). | A reduction on the list rate (separate from the agency commission). Changing it on a proposal that is already {enviada} bumps the version (renegotiation). |
| `propuestas.ficha.descuento.enviada` | `app/(app)/(shell)/propuestas/[id]/page.tsx:654` | texto / aviso en pantalla | Enviada | Sent |
| `propuestas.ficha.descuento.tope-aviso` | `app/(app)/(shell)/propuestas/[id]/page.tsx:660` | texto / aviso en pantalla | ␣Tu organización autoriza hasta {tope}; para más, Administración tiene que subir el tope. | ␣Your organization allows up to {tope}; for more, Settings has to raise the cap. |
| `propuestas.ficha.version-actual` | `app/(app)/(shell)/propuestas/[id]/page.tsx:678` | texto / aviso en pantalla | versión actual: v{n} | current version: v{n} |
| `propuestas.ficha.descuento.fijo` | `app/(app)/(shell)/propuestas/[id]/page.tsx:681` | texto / aviso en pantalla | La propuesta ya está {estatus}; el descuento quedó fijo. | The proposal is already {estatus}; the discount is locked. |
| `propuestas.ficha.paquete` | `app/(app)/(shell)/propuestas/[id]/page.tsx:695`<br>`app/(app)/(shell)/propuestas/[id]/page.tsx:751` | texto / aviso en pantalla | Paquete cerrado | Bundle |
| `propuestas.ficha.paquete.vendido` | `app/(app)/(shell)/propuestas/[id]/page.tsx:699` | texto / aviso en pantalla | Esta propuesta se vende como el paquete {nombre} por {precio}, que ya está congelado: si el paquete cambia o se borra, este precio no se mueve. | This proposal is sold as the {nombre} bundle for {precio}, which is already locked: if the bundle changes or is deleted, this price does not move. |
| `propuestas.ficha.paquete.admite-codigo` | `app/(app)/(shell)/propuestas/[id]/page.tsx:705` | texto / aviso en pantalla | Admite código de negociación encima. | A promo code can be added on top. |
| `propuestas.ficha.paquete.precio-final` | `app/(app)/(shell)/propuestas/[id]/page.tsx:706` | texto / aviso en pantalla | Es precio final: no admite descuento por volumen ni código de negociación. | It is a final price: no volume discount or promo code allowed. |
| `propuestas.ficha.paquete.quitar` | `app/(app)/(shell)/propuestas/[id]/page.tsx:728` | botón | Quitar paquete | Remove bundle |
| `propuestas.ficha.paquete.quitar.ayuda` | `app/(app)/(shell)/propuestas/[id]/page.tsx:731` | botón | Quitarlo devuelve los precios de lista de cada pantalla. | Removing it restores each screen's list prices. |
| `propuestas.ficha.paquete.fijo` | `app/(app)/(shell)/propuestas/[id]/page.tsx:736` | texto / aviso en pantalla | La propuesta ya está {estatus}; el paquete quedó fijo. | The proposal is already {estatus}; the bundle is locked. |
| `propuestas.ficha.paquete.ayuda` | `app/(app)/(shell)/propuestas/[id]/page.tsx:743` | texto / aviso en pantalla | El precio del paquete {sustituye} la suma de las tarifas de lista: no la descuenta, la reemplaza. Y se reparte entre sus pantallas a prorrata, que es el ingreso que el reporte le atribuye a cada una. Solo se puede aplicar si esta propuesta tiene {exactamente} las pantallas del paquete. | The bundle price {sustituye} the sum of the list rates: it doesn't discount it, it supersedes it. It is split pro rata across its screens, which is the revenue the report attributes to each one. It can only be applied if this proposal has {exactamente} the bundle's screens. |
| `propuestas.ficha.paquete.sustituye` | `app/(app)/(shell)/propuestas/[id]/page.tsx:744` | texto / aviso en pantalla | sustituye | replaces |
| `propuestas.ficha.paquete.exactamente` | `app/(app)/(shell)/propuestas/[id]/page.tsx:745` | texto / aviso en pantalla | exactamente | exactly |
| `propuestas.ficha.paquete.elige-opcion` | `app/(app)/(shell)/propuestas/[id]/page.tsx:756` | opción de un selector | Elige un paquete… | Choose a bundle… |
| `propuestas.ficha.paquete.opcion` | `app/(app)/(shell)/propuestas/[id]/page.tsx:759` | opción de un selector | {nombre} — {precio} · {n} pantallas | {nombre} — {precio} · {n} screens |
| `propuestas.ficha.paquete.no-admite` | `app/(app)/(shell)/propuestas/[id]/page.tsx:774` | texto / aviso en pantalla | La propuesta ya está {estatus}; no admite paquete. | The proposal is already {estatus}; no bundle allowed. |
| `propuestas.ficha.paquete.sin-catalogo` | `app/(app)/(shell)/propuestas/[id]/page.tsx:775` | texto / aviso en pantalla | No hay paquetes activos en el catálogo. | There are no active bundles in the catalog. |
| `propuestas.ficha.sitios` | `app/(app)/(shell)/propuestas/[id]/page.tsx:802` | título | Sitios y renta | Sites and rent |
| `propuestas.ficha.sitios.renta-total` | `app/(app)/(shell)/propuestas/[id]/page.tsx:805` | texto / aviso en pantalla | Renta total ref. {monto} | Total ref. rent {monto} |
| `propuestas.ficha.sitios.enviada` | `app/(app)/(shell)/propuestas/[id]/page.tsx:819` | texto / aviso en pantalla | Ya está enviada: agregar o quitar sitios sube la versión. | Already sent: adding or removing sites bumps the version. |
| `propuestas.ficha.sitios.vacia` | `app/(app)/(shell)/propuestas/[id]/page.tsx:824` | texto / aviso en pantalla | Esta propuesta no tiene sitios. | This proposal has no sites. |
| `propuestas.ficha.tabla.sitio` | `app/(app)/(shell)/propuestas/[id]/page.tsx:830` | cabecera de columna | Sitio | Site |
| `propuestas.ficha.tabla.arrendador` | `app/(app)/(shell)/propuestas/[id]/page.tsx:831` | cabecera de columna | Arrendador · renta | Landlord · rent |
| `propuestas.ficha.tabla.contratacion` | `app/(app)/(shell)/propuestas/[id]/page.tsx:837` | cabecera de columna | Contratación | Booking |
| `propuestas.ficha.tabla.precio` | `app/(app)/(shell)/propuestas/[id]/page.tsx:838` | cabecera de columna | Precio propuesta | Proposal price |
| `propuestas.ficha.tabla.aprobado` | `app/(app)/(shell)/propuestas/[id]/page.tsx:839` | cabecera de columna | Aprobado | Approved |
| `propuestas.ficha.tabla.quitar` | `app/(app)/(shell)/propuestas/[id]/page.tsx:841` | etiqueta accesible (aria-label) | Quitar | Remove |
| `propuestas.ficha.tabla.sin-contrato` | `app/(app)/(shell)/propuestas/[id]/page.tsx:886` | texto / aviso en pantalla | Sin contrato de renta | No rent contract |
| `propuestas.ficha.tabla.tarifa-calculada` | `app/(app)/(shell)/propuestas/[id]/page.tsx:914` | texto / aviso en pantalla | Tarifa calculada {monto} | Calculated rate {monto} |
| `propuestas.ficha.tabla.sin-tarifa-calculada` | `app/(app)/(shell)/propuestas/[id]/page.tsx:915` | texto / aviso en pantalla | Sin tarifa calculada | No calculated rate |
| `propuestas.ficha.tabla.ajustada` | `app/(app)/(shell)/propuestas/[id]/page.tsx:911` | texto / aviso en pantalla | {tarifa} · ajustada por {quien} | {tarifa} · adjusted by {quien} |
| `propuestas.ficha.tabla.usuario-baja` | `app/(app)/(shell)/propuestas/[id]/page.tsx:916` | texto / aviso en pantalla | un usuario dado de baja | a deactivated user |
| `propuestas.ficha.tabla.este-sitio` | `app/(app)/(shell)/propuestas/[id]/page.tsx:964` | botón | este sitio | this site |
| `propuestas.ficha.tabla.quitar-sitio` | `app/(app)/(shell)/propuestas/[id]/page.tsx:966` | etiqueta accesible (aria-label) | Quitar {sitio} | Remove {sitio} |
| `propuestas.ficha.tabla.sitio-generico` | `app/(app)/(shell)/propuestas/[id]/page.tsx:967` | texto / aviso en pantalla | sitio | site |
| `propuestas.ficha.tabla.quitar.titulo` | `app/(app)/(shell)/propuestas/[id]/page.tsx:969` | tooltip (title) | Quitar de la propuesta | Remove from the proposal |
| `propuestas.ficha.condiciones` | `app/(app)/(shell)/propuestas/[id]/page.tsx:998` | título | Condiciones y vigencia | Terms and validity |
| `propuestas.ficha.mapa` | `app/(app)/(shell)/propuestas/[id]/page.tsx:1010` | título | Ubicación de las pantallas | Screen locations |
| `propuestas.ficha.mapa.cargando` | `app/(app)/(shell)/propuestas/[id]/page.tsx:1017` | texto / aviso en pantalla | Cargando ubicaciones… | Loading locations… |
| `propuestas.ficha.mapa.sin-coords.uno` | `app/(app)/(shell)/propuestas/[id]/page.tsx:1019` | texto / aviso en pantalla | Ninguna de las {n} pantalla de esta propuesta tiene coordenadas capturadas. | The {n} screen in this proposal has no coordinates entered. |
| `propuestas.ficha.mapa.sin-coords.otros` | `app/(app)/(shell)/propuestas/[id]/page.tsx:1019` | texto / aviso en pantalla | Ninguna de las {n} pantallas de esta propuesta tiene coordenadas capturadas. | None of the {n} screens in this proposal have coordinates entered. |
| `propuestas.ficha.mapa.parcial` | `app/(app)/(shell)/propuestas/[id]/page.tsx:1027` | texto / aviso en pantalla | {n} de {pantallas} no tienen coordenadas y no aparecen en el mapa. | {n} of {pantallas} have no coordinates and do not appear on the map. |
| `propuestas.ficha.pasos` | `app/(app)/(shell)/propuestas/[id]/page.tsx:1075` | etiqueta accesible (aria-label) | Estado de la propuesta | Proposal status |
| `propuestas.codigo.elige-o-teclea` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:121` | aviso emergente (error) | Elige o teclea el código de negociación | Choose or type the promo code |
| `propuestas.codigo.aplicado` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:130` | aviso emergente (éxito) | Código {codigo} aplicado ({pct} %): pendiente de aprobación{reactivada} | Promo code {codigo} applied ({pct} %): pending approval{reactivada} |
| `propuestas.codigo.aplicado.reactivada` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:133` | texto / aviso en pantalla | . La propuesta vuelve a borrador. | . The proposal goes back to draft. |
| `propuestas.codigo.quitado` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:151` | aviso emergente (éxito) | Código quitado; su uso vuelve al cupón | Promo code removed; its use is returned |
| `propuestas.codigo.aprobado` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:164` | aviso emergente (éxito) | Código aprobado: el cliente ya lo ve en su propuesta | Promo code approved: the client now sees it in their proposal |
| `propuestas.codigo.motivo-falta` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:175` | aviso emergente (error) | Escribe el motivo del rechazo | Write the reason for the rejection |
| `propuestas.codigo.rechazado` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:181` | aviso emergente (éxito) | Código rechazado; se quitó y su uso vuelve al cupón | Promo code rejected; it was removed and its use is returned |
| `propuestas.codigo.titulo` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:198`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:313` | título | Código de negociación | Promo code |
| `propuestas.codigo.lleva` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:215` | texto / aviso en pantalla | Esta propuesta lleva el código {codigo} con un {pct}, que ya está congelado: si el código cambia o se borra, este precio no se mueve. | This proposal carries the promo code {codigo} at {pct}, which is already locked: if the code changes or is deleted, this price does not move. |
| `propuestas.codigo.pendiente` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:222` | texto / aviso en pantalla | {aviso} su liga enseña la propuesta sin este descuento hasta que un administrador o gerente lo apruebe. Si la acepta así, la acepta sin cupón. Mientras esté pendiente, la propuesta no se puede aprobar por dentro. | {aviso} their link shows the proposal without this discount until an administrator or manager approves it. If they accept it like that, they accept it without the promo code. While it is pending, the proposal cannot be approved internally. |
| `propuestas.codigo.pendiente.aviso` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:223` | texto / aviso en pantalla | El cliente todavía no lo ve: | The client can't see it yet: |
| `propuestas.codigo.aprobar` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:232` | botón | Aprobar código | Approve code |
| `propuestas.codigo.rechazar` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:235` | botón | Rechazar… | Reject… |
| `propuestas.codigo.motivo` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:242`<br>`components/demo/codigos/BloqueCodigoPropuesta.tsx:245` | etiqueta accesible (aria-label) | Motivo del rechazo | Reason for rejection |
| `propuestas.codigo.rechazando` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:250` | botón | Rechazando… | Rejecting… |
| `propuestas.codigo.confirmar-rechazo` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:250` | botón | Confirmar rechazo | Confirm rejection |
| `propuestas.codigo.quitar` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:260` | botón | Quitar código | Remove code |
| `propuestas.codigo.quitar.ayuda` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:262` | texto / aviso en pantalla | Quitarlo devuelve su uso al cupón. | Removing it returns its use to the promo code. |
| `propuestas.codigo.fijo` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:268` | texto / aviso en pantalla | La propuesta ya está aprobada; el código quedó fijo. | The proposal is already approved; the code is locked. |
| `propuestas.codigo.ayuda` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:275` | texto / aviso en pantalla | Se aplica {despues} del descuento comercial y se {compone} con él: un 20 % y un 20 % dejan al cliente pagando el 64 %, no el 60 %. Al aplicarlo se consume uno de sus usos — quitarlo lo devuelve — y queda {pendiente}: el cliente no lo ve hasta que un administrador o gerente lo apruebe. | It is applied {despues} the commercial discount and {compone} with it: 20 % plus 20 % leaves the client paying 64 %, not 60 %. Applying it uses up one of its uses — removing it gives it back — and it stays {pendiente}: the client doesn't see it until an administrator or manager approves it. |
| `propuestas.codigo.ayuda.despues` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:276` | texto / aviso en pantalla | después | after |
| `propuestas.codigo.ayuda.compone` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:277` | texto / aviso en pantalla | compone | compounds |
| `propuestas.codigo.ayuda.pendiente` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:278` | texto / aviso en pantalla | pendiente de aprobación | pending approval |
| `propuestas.codigo.rechazada` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:283` | texto / aviso en pantalla | Esta propuesta está rechazada: {aviso} | This proposal is rejected: {aviso} |
| `propuestas.codigo.rechazada.aviso` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:284` | texto / aviso en pantalla | aplicar un cupón la reactiva a borrador. | applying a promo code reactivates it as a draft. |
| `propuestas.codigo.vigente` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:292` | etiqueta accesible (aria-label) | Cupón vigente | Active promo code |
| `propuestas.codigo.vigente.elige` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:297` | opción de un selector | Elige un cupón vigente… | Choose an active promo code… |
| `propuestas.codigo.opcion` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:300` | opción de un selector | {codigo} — {pct} % · {usos} | {codigo} — {pct} % · {usos} |
| `propuestas.codigo.sin-tope` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:305` | texto / aviso en pantalla | sin tope de usos | unlimited uses |
| `propuestas.codigo.quedan` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:306` | texto / aviso en pantalla | quedan {n} | {n} left |
| `propuestas.codigo.o-teclealo` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:316` | texto de ejemplo del campo (placeholder) | o tecléalo | or type it |
| `propuestas.codigo.ejemplo` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:316` | texto de ejemplo del campo (placeholder) | VERANO20 | SUMMER20 |
| `propuestas.codigo.sin-permiso` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:329` | texto / aviso en pantalla | No tienes permiso para aplicar códigos. | You don't have permission to apply promo codes. |
| `propuestas.codigo.no-admite` | `components/demo/codigos/BloqueCodigoPropuesta.tsx:329` | texto / aviso en pantalla | La propuesta ya está aprobada; no admite código. | The proposal is already approved; no promo code allowed. |
| `propuestas.condiciones.guardadas` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:60` | aviso emergente (éxito) | Condiciones y vigencia guardadas | Terms and validity saved |
| `propuestas.condiciones.vigencia` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:71` | texto / aviso en pantalla | Vigencia | Validity |
| `propuestas.condiciones.vencio` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:75` | texto / aviso en pantalla | Venció el {fecha}: la liga ya no deja aceptarla. Pon otra fecha o vuelve a enviarla. | Expired on {fecha}: the link no longer allows accepting it. Set another date or send it again. |
| `propuestas.condiciones.hasta` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:76` | texto / aviso en pantalla | El cliente puede aceptarla hasta el {fecha} (ese día incluido). | The client can accept it until {fecha} (inclusive). |
| `propuestas.condiciones.sin-vigencia` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:77` | texto / aviso en pantalla | Se pone sola al enviarla, con los días que tu organización tiene en Administración. | It is set automatically when sent, using the number of days your organization has in Settings. |
| `propuestas.condiciones.valida-hasta` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:82` | etiqueta accesible (aria-label) | Válida hasta | Valid until |
| `propuestas.condiciones.terminos` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:91`<br>`components/demo/propuestas/BloqueCondicionesVigencia.tsx:97` | texto / aviso en pantalla | Términos y condiciones | Terms and conditions |
| `propuestas.condiciones.terminos.ayuda` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:93` | texto / aviso en pantalla | Salen al final del documento y en la liga del cliente. Nacen de la plantilla de Administración; lo que cambies aquí vale solo para esta propuesta. | They appear at the end of the document and on the client's link. They start from the template in Settings; what you change here applies only to this proposal. |
| `propuestas.condiciones.terminos.ejemplo` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:102` | texto de ejemplo del campo (placeholder) | Sin condiciones: el documento no lleva este bloque. | No terms: the document will not include this section. |
| `propuestas.condiciones.sin-terminos` | `components/demo/propuestas/BloqueCondicionesVigencia.tsx:106` | texto / aviso en pantalla | Sin condiciones. | No terms. |
| `propuestas.enviar.hecho` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:63` | aviso emergente (éxito) | Propuesta enviada a {correo} | Proposal sent to {correo} |
| `propuestas.enviar.sin-correo` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:65` | aviso emergente (advertencia) | La propuesta quedó como enviada, pero esta instancia no tiene correo configurado: manda la liga tú. | The proposal is marked as sent, but this instance has no email configured: send the link yourself. |
| `propuestas.enviar.error` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:69` | mensaje de error | No se pudo enviar | Could not send |
| `propuestas.enviar.titulo.reenviar` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:79` | tooltip (title) | Reenviar propuesta | Resend proposal |
| `propuestas.enviar.titulo.enviar` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:79` | tooltip (title) | Enviar propuesta | Send proposal |
| `propuestas.enviar.subtitulo` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:80` | tooltip (title) | El cliente recibe la liga para revisarla y aceptarla. Tú recibes copia. | The client gets the link to review and accept it. You get a copy. |
| `propuestas.enviar.correo` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:98` | rótulo de campo | Correo del cliente | Client email |
| `propuestas.enviar.correo.ejemplo` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:104` | texto de ejemplo del campo (placeholder) | cliente@empresa.com | client@company.com |
| `propuestas.enviar.mensaje` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:109` | rótulo de campo | Mensaje (opcional) | Message (optional) |
| `propuestas.enviar.mensaje.ejemplo` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:114` | texto de ejemplo del campo (placeholder) | Unas líneas para el cliente; van antes del botón de la liga. | A few lines for the client; they go before the link button. |
| `propuestas.enviar.reenvio.aviso` | `components/demo/propuestas/EnviarPropuestaDialog.tsx:121` | texto / aviso en pantalla | Si la propuesta ya venció, reenviarla le da una vigencia nueva. | If the proposal has expired, resending it gives it a new validity period. |
| `propuestas.elegir-cliente.titulo` | `components/demo/propuestas/ElegirClienteDialog.tsx:58` | tooltip (title) | ¿A qué cliente se le factura? | Which client is billed? |
| `propuestas.elegir-cliente.subtitulo` | `components/demo/propuestas/ElegirClienteDialog.tsx:59` | tooltip (title) | La propuesta se aprobó sin cliente. Elígelo para generar la campaña; después ya no se cambia. | The proposal was approved without a client. Choose one to generate the campaign; it can't be changed afterwards. |
| `propuestas.elegir-cliente.confirmar` | `components/demo/propuestas/ElegirClienteDialog.tsx:64` | botón | Poner cliente y generar campaña | Set client and generate campaign |
| `propuestas.elegir-cliente.sin-clientes` | `components/demo/propuestas/ElegirClienteDialog.tsx:71` | texto / aviso en pantalla | No hay clientes. Créalo primero en Clientes y vuelve a esta propuesta. | There are no clients. Create one first in Clients and come back to this proposal. |
| `propuestas.elegir-cliente.elige` | `components/demo/propuestas/ElegirClienteDialog.tsx:81` | opción de un selector | — Elige el cliente — | — Choose the client — |
| `propuestas.elegir-cliente.iva` | `components/demo/propuestas/ElegirClienteDialog.tsx:84` | opción de un selector | ␣(IVA {pct} %) | ␣(VAT {pct} %) |
| `propuestas.tablero.error` | `components/demo/propuestas/TableroPropuestas.tsx:133` | texto / aviso en pantalla | No se pudo calcular el tablero | The summary could not be calculated |
| `propuestas.tablero.titulo` | `components/demo/propuestas/TableroPropuestas.tsx:75` | título | Resumen de propuestas | Proposal summary |
| `propuestas.tablero.subtitulo` | `components/demo/propuestas/TableroPropuestas.tsx:81` | título | {periodo} · {desde} a {hasta} | {periodo} · {desde} to {hasta} |
| `propuestas.tablero.periodo` | `components/demo/propuestas/TableroPropuestas.tsx:97` | etiqueta accesible (aria-label) | Periodo | Period |
| `propuestas.tablero.a` | `components/demo/propuestas/TableroPropuestas.tsx:123` | texto / aviso en pantalla | a | to |
| `propuestas.tablero.elige-fechas` | `components/demo/propuestas/TableroPropuestas.tsx:131` | texto / aviso en pantalla | Elige la fecha de inicio y la de fin. | Choose the start and end dates. |
| `propuestas.tablero.generadas` | `components/demo/propuestas/TableroPropuestas.tsx:143`<br>`components/demo/propuestas/TableroPropuestas.tsx:199` | rótulo de cifra | Generadas | Created |
| `propuestas.tablero.generadas.pie` | `components/demo/propuestas/TableroPropuestas.tsx:143` | rótulo de cifra | creadas en el periodo | created in the period |
| `propuestas.tablero.aprobadas` | `components/demo/propuestas/TableroPropuestas.tsx:145`<br>`components/demo/propuestas/TableroPropuestas.tsx:200` | rótulo de cifra | Aprobadas | Approved |
| `propuestas.tablero.aprobadas.sin-venta` | `components/demo/propuestas/TableroPropuestas.tsx:149` | texto / aviso en pantalla | venta —, sin calcular en estas propuestas | sales —, not calculated for these proposals |
| `propuestas.tablero.aprobadas.venta` | `components/demo/propuestas/TableroPropuestas.tsx:150` | texto / aviso en pantalla | venta {monto} sin IVA | sales {monto} excl. VAT |
| `propuestas.tablero.rechazadas` | `components/demo/propuestas/TableroPropuestas.tsx:154`<br>`components/demo/propuestas/TableroPropuestas.tsx:201` | rótulo de cifra | Rechazadas | Rejected |
| `propuestas.tablero.rechazadas.pie` | `components/demo/propuestas/TableroPropuestas.tsx:154` | rótulo de cifra | en el periodo | in the period |
| `propuestas.tablero.tasa` | `components/demo/propuestas/TableroPropuestas.tsx:159` | rótulo de cifra | Tasa de cierre del periodo | Close rate for the period |
| `propuestas.tablero.tasa.pie` | `components/demo/propuestas/TableroPropuestas.tsx:161` | pie de cifra | aprobadas de las decididas en este periodo | approved out of those decided in this period |
| `propuestas.tablero.ganancia` | `components/demo/propuestas/TableroPropuestas.tsx:166`<br>`components/demo/propuestas/TableroPropuestas.tsx:203`<br>`components/demo/propuestas/TableroPropuestas.tsx:235` | rótulo de cifra | Ganancia | Profit |
| `propuestas.tablero.ganancia.sin-calcular` | `components/demo/propuestas/TableroPropuestas.tsx:170` | texto / aviso en pantalla | sin calcular: falta la venta o la renta | not calculated: sales or rent missing |
| `propuestas.tablero.ganancia.margen` | `components/demo/propuestas/TableroPropuestas.tsx:171` | texto / aviso en pantalla | margen {pct} | margin {pct} |
| `propuestas.tablero.ganancia-por-aprobada` | `components/demo/propuestas/TableroPropuestas.tsx:176` | rótulo de cifra | Ganancia por aprobada | Profit per approved |
| `propuestas.tablero.ganancia-por-aprobada.pie` | `components/demo/propuestas/TableroPropuestas.tsx:178` | pie de cifra | venta − renta de las pantallas | sales − screen rent |
| `propuestas.tablero.sin-costo.uno` | `components/demo/propuestas/TableroPropuestas.tsx:187` | texto / aviso en pantalla | {n} aprobada tiene alguna pantalla sin contrato de renta vigente: cuentan en la venta, pero no en la ganancia. | {n} approved proposal has a screen without an active rent contract: it counts toward sales, but not toward profit. |
| `propuestas.tablero.sin-costo.otros` | `components/demo/propuestas/TableroPropuestas.tsx:187` | texto / aviso en pantalla | {n} aprobadas tienen alguna pantalla sin contrato de renta vigente: cuentan en la venta, pero no en la ganancia. | {n} approved proposals have a screen without an active rent contract: they count toward sales, but not toward profit. |
| `propuestas.tablero.col.vendedor` | `components/demo/propuestas/TableroPropuestas.tsx:198`<br>`components/demo/propuestas/TableroPropuestas.tsx:231` | cabecera de columna | Vendedor | Sales rep |
| `propuestas.tablero.col.venta` | `components/demo/propuestas/TableroPropuestas.tsx:202`<br>`components/demo/propuestas/TableroPropuestas.tsx:233` | cabecera de columna | Venta sin IVA | Sales excl. VAT |
| `propuestas.tablero.aprobadas-periodo` | `components/demo/propuestas/TableroPropuestas.tsx:224` | texto / aviso en pantalla | Aprobadas del periodo | Approved in the period |
| `propuestas.tablero.col.folio` | `components/demo/propuestas/TableroPropuestas.tsx:229` | cabecera de columna | Folio | Ref. |
| `propuestas.tablero.col.propuesta` | `components/demo/propuestas/TableroPropuestas.tsx:230` | cabecera de columna | Propuesta | Proposal |
| `propuestas.tablero.col.aprobada` | `components/demo/propuestas/TableroPropuestas.tsx:232` | cabecera de columna | Aprobada | Approved |
| `propuestas.tablero.col.renta` | `components/demo/propuestas/TableroPropuestas.tsx:234` | cabecera de columna | Renta | Rent |
| `propuestas.tablero.sin-contrato` | `components/demo/propuestas/TableroPropuestas.tsx:246` | texto / aviso en pantalla | sin contrato | no contract |
| `propuestas.tablero.mas` | `components/demo/propuestas/TableroPropuestas.tsx:257` | texto / aviso en pantalla | Y {n} más. | And {n} more. |
| `propuestas.publica.no-encontrada` | `app/(app)/propuesta/page.tsx:26` | texto / aviso en pantalla | No encontramos ninguna propuesta con ese código. Revísalo e inténtalo de nuevo. | We couldn't find any proposal with that code. Check it and try again. |
| `propuestas.publica.error` | `app/(app)/propuesta/page.tsx:32` | mensaje de error | No se pudo verificar el código. Inténtalo de nuevo. | The code could not be verified. Please try again. |
| `propuestas.publica.marca` | `app/(app)/propuesta/page.tsx:46` | texto / aviso en pantalla | Propuestas comerciales | Commercial proposals |
| `propuestas.publica.titulo` | `app/(app)/propuesta/page.tsx:57` | título | Ver tu propuesta | View your proposal |
| `propuestas.publica.subtitulo` | `app/(app)/propuesta/page.tsx:59` | título | Ingresa el código que te compartimos para ver tu propuesta. | Enter the code we shared with you to view your proposal. |
| `propuestas.publica.ejemplo` | `app/(app)/propuesta/page.tsx:67` | texto de ejemplo del campo (placeholder) | p. ej. PR-A0BC4F | e.g. PR-A0BC4F |
| `propuestas.publica.verificando` | `app/(app)/propuesta/page.tsx:77` | texto / aviso en pantalla | Verificando… | Verifying… |
| `propuestas.publica.ver` | `app/(app)/propuesta/page.tsx:77` | texto / aviso en pantalla | Ver propuesta | View proposal |
| `propuestas.publica.pie` | `app/(app)/propuesta/page.tsx:84` | texto / aviso en pantalla | Spaces · propuestas comerciales · acceso de solo lectura por código | Spaces · commercial proposals · read-only access by code |
| `propuestas.documento.volver` | `components/demo/propuestas/DocumentoPropuestaCliente.tsx:25` | texto / aviso en pantalla | Volver a la propuesta | Back to the proposal |
| `propuestas.documento.imprimir` | `components/demo/propuestas/DocumentoPropuestaCliente.tsx:28` | botón | Imprimir o guardar como PDF | Print or save as PDF |
| `propuestas.documento.imprimir.nota` | `components/demo/propuestas/DocumentoPropuestaCliente.tsx:31` | botón | En el diálogo de impresión elige «Guardar como PDF». Espera a que cargue el mapa antes de imprimir. | In the print dialog choose “Save as PDF”. Wait for the map to load before printing. |
| `propuestas.documento.qr.acepta` | `components/demo/propuestas/DocumentoPropuestaCliente.tsx:66` | texto / aviso en pantalla | Acéptala en línea | Accept it online |
| `propuestas.documento.qr.consulta` | `components/demo/propuestas/DocumentoPropuestaCliente.tsx:66` | texto / aviso en pantalla | Consúltala en línea | View it online |
| `propuestas.documento.qr.acepta.texto` | `components/demo/propuestas/DocumentoPropuestaCliente.tsx:69` | texto / aviso en pantalla | Escanea el código o abre esta dirección para revisar la propuesta y aceptarla: | Scan the code or open this address to review the proposal and accept it: |
| `propuestas.documento.qr.consulta.texto` | `components/demo/propuestas/DocumentoPropuestaCliente.tsx:70` | texto / aviso en pantalla | Escanea el código o abre esta dirección para consultar la propuesta: | Scan the code or open this address to view the proposal: |
| `propuestas.documento.sin-permiso` | `app/(app)/propuesta/[id]/page.tsx:47` | texto / aviso en pantalla | No tienes permiso para ver esta propuesta. | You don't have permission to view this proposal. |
| `propuestas.documento.encabezado` | `app/(app)/propuesta/[id]/page.tsx:84` | texto / aviso en pantalla | PROPUESTA COMERCIAL | COMMERCIAL PROPOSAL |
| `propuestas.documento.para` | `app/(app)/propuesta/[id]/page.tsx:92` | texto / aviso en pantalla | Para | To |
| `propuestas.documento.periodo` | `app/(app)/propuesta/[id]/page.tsx:93` | texto / aviso en pantalla | Periodo | Period |
| `propuestas.documento.vigencia` | `app/(app)/propuesta/[id]/page.tsx:95` | texto / aviso en pantalla | Vigencia | Validity |
| `propuestas.documento.aceptada` | `app/(app)/propuesta/[id]/page.tsx:98` | texto / aviso en pantalla | Aceptada el {fecha} | Accepted on {fecha} |
| `propuestas.documento.vencio` | `app/(app)/propuesta/[id]/page.tsx:100` | texto / aviso en pantalla | Venció el {fecha} | Expired on {fecha} |
| `propuestas.documento.valida-hasta` | `app/(app)/propuesta/[id]/page.tsx:100` | texto / aviso en pantalla | Válida hasta el {fecha} | Valid until {fecha} |
| `propuestas.documento.se-fija` | `app/(app)/propuesta/[id]/page.tsx:104` | texto / aviso en pantalla | Se fija al enviarla | Set when it is sent |
| `propuestas.documento.pantallas` | `app/(app)/propuesta/[id]/page.tsx:110` | título | PANTALLAS | SCREENS |
| `propuestas.documento.col.pantalla` | `app/(app)/propuesta/[id]/page.tsx:116` | cabecera de columna | Pantalla y ubicación | Screen and location |
| `propuestas.documento.col.importe` | `app/(app)/propuesta/[id]/page.tsx:117` | cabecera de columna | Importe | Amount |
| `propuestas.documento.sin-foto` | `app/(app)/propuesta/[id]/page.tsx:132` | texto / aviso en pantalla | Sin foto | No photo |
| `propuestas.documento.franja` | `app/(app)/propuesta/[id]/page.tsx:141` | texto / aviso en pantalla | Franja | Daypart |
| `propuestas.documento.ubicacion` | `app/(app)/propuesta/[id]/page.tsx:155` | título | UBICACIÓN | LOCATION |
| `propuestas.documento.sin-coords` | `app/(app)/propuesta/[id]/page.tsx:159` | texto / aviso en pantalla | {n} pantalla(s) sin coordenadas; su dirección está en la tabla. | {n} screen(s) without coordinates; their address is in the table. |
| `propuestas.documento.importe` | `app/(app)/propuesta/[id]/page.tsx:167` | título | IMPORTE | AMOUNT |
| `propuestas.documento.descuento` | `app/(app)/propuesta/[id]/page.tsx:180` | rótulo de cifra | Descuento ({pct}%) | Discount ({pct}%) |
| `propuestas.documento.comision` | `app/(app)/propuesta/[id]/page.tsx:188` | rótulo de cifra | Comisión de agencia ({pct}%) | Agency commission ({pct}%) |
| `propuestas.documento.terminos` | `app/(app)/propuesta/[id]/page.tsx:196` | título | TÉRMINOS Y CONDICIONES | TERMS AND CONDITIONS |
| `propuestas.documento.aceptada-en-linea` | `app/(app)/propuesta/[id]/page.tsx:210` | texto / aviso en pantalla | ACEPTADA EN LÍNEA | ACCEPTED ONLINE |
| `propuestas.documento.acepta-cliente` | `app/(app)/propuesta/[id]/page.tsx:217` | texto / aviso en pantalla | ACEPTA EL CLIENTE | CLIENT ACCEPTANCE |
| `propuestas.documento.firma` | `app/(app)/propuesta/[id]/page.tsx:218` | texto / aviso en pantalla | Nombre, firma y fecha | Name, signature and date |
