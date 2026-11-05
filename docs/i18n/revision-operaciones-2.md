# Tabla de revisión · lote de inglés «operaciones (parte 2)»

Generada el 2026-11-02 a partir de `apps/web/lib/i18n/textos/operaciones2.ts`,
`textos/inicio.ts` y `textos/energia.ts`, y de los usos en el código (búsqueda
literal de la clave; «por plantilla de clave» = la clave se arma con un hueco,
p. ej. `` `energia.motivo.${campo}.falta` ``). **471 claves**: 202 de
operaciones2 (OT y Creativos), 148 del Dashboard y 121 de Consumo de luz (tras la
segunda vuelta). Rama
`feat/ingles-operaciones-2`, sale de `integra/ingles` en `34022673`.

- **Pantallas:** `/operaciones` (lista de OT, indicadores, aviso de SLA,
  filtros, alta de OT), la ficha de la OT (`OTVista`, escritorio y móvil),
  `/creativos`, el Dashboard (`/inicio`) y `/energia` (indicadores, formulario
  del recibo, rejilla de cobertura, subida de PDF de CFE).
- **Español idéntico, medido:** con `I18N_VOLCAR` se volcó el HTML español de
  cada estado antes y después de tocar los componentes y `diff -rq` salió vacío
  en los cuatro: 17 de OT, 7 de Creativos (24 en `pantallas-operaciones2`), 7
  del Dashboard (`pantallas-inicio`) y 11 de energía (`pantallas-energia`).
- **Funciones de `lib/` con `idioma` (`'es'` por omisión):** `leerCostoOt`,
  `avisoAntesDeCerrar`, `textoCostoDeCerrada` (`lib/costo-ot-captura.ts`);
  `dashboardMetrics` → `construirAlertas` (`lib/data/derive.ts`) y
  `useDashboard` (`lib/data/client.ts`); `pipelineComercial`
  (`components/demo/inicio/indicadores.ts`); `motivoInvalido`,
  `resumenDeCobertura`, `etiquetaDeMes`, `motivoInvalidoDelRecibo`,
  `textoDeConfirmacionDeBorrado` (`energia/captura.ts`); `motivoNoConfirmable`,
  `resumenDeLectura`, `textoDeLoLeido` (`energia/recibos.ts`). En español
  devuelven el literal de siempre: lo comprueban `textos/operaciones2.test.ts`,
  `textos/inicio.test.ts` (alertas idénticas con y sin idioma sobre un estado
  que dispara todas las ramas, `lib/i18n/estado-alertas.fixture.ts`) y
  `textos/energia.test.ts` (21 casos rama a rama).
- **Espejos de tablas españolas que no se tocan:** `TIPO_OT_LABEL`
  (`components/operaciones/claves.ts`, **provisional** hasta juntar con
  `etiquetaTipoOt` del lote de administración), las dos tablas de prioridad,
  `CLAVE_OT` de Campañas, `TIPOS_ALERTA`, `TRAMOS_COBRANZA`, `LICENCIA_LABEL`
  (`CLAVE_LICENCIA`), `GRANS`, la tabla `label` de los estados de creativo y
  `OPCIONES_MESES`. Cada una con su prueba de paridad.
- **Dinero:** `formatMonto(n, idioma)` / `formatearDinero(n, idioma)` /
  `simboloMoneda(idioma)` en todas las pantallas del lote; las pruebas de
  pantallas leen los importes con `leerDinero` en las dos monedas y los dos
  idiomas. El «$» adorno del campo del costo de la OT sigue igual en español y
  en inglés lleva el símbolo de la instancia.

## Términos decididos en este lote

| español | inglés | motivo |
|---|---|---|
| OT / orden de trabajo | work order | glosario |
| cuadrilla | crew | |
| fecha compromiso / compromiso | due date | |
| responsable / sin asignar | assignee / Unassigned | «Unassigned» como razones sociales |
| prioridad baja / normal / alta / urgente | Low / Normal / High / Urgent | «Baja» se declara distinta en la costura (sitio «Decommissioned») |
| tipos de OT | Vinyl installation, Digital installation, Removal, Preventive / Corrective maintenance, Metalwork, Electrical, Inspection, Other | |
| frenan el candado de facturación | keeping the billing lock closed | el candado «se abre» al cumplirse (Campañas); subtítulo de KPI sin «they» (2.ª vuelta) |
| candado de facturación encendido | Billing lock open | |
| fotografía comprobatoria / sello de ubicación | proof photo / location stamp | |
| costo real / estimación por tipo | actual cost / per-type estimate | |
| rentabilidad | profitability | glosario del orquestador |
| creativo / arte / retirado | creative / artwork / withdrawn | «withdrawn… in its panel» y «exceeds», como Campañas (costura) |
| spots / slots (Creativos) | slots | orquestador, 2.ª vuelta: «spot» es el anuncio y «slot» el espacio del loop; lo que se reserva y se queda sin creativo es un slot |
| tipo de alerta (Dashboard) | Rent issues / Contract issues / Invoices (collections) / Blocked or paused sites / Work orders (SLA) / Licenses and permits | orquestador, 2.ª vuelta: que cubran todo lo que agrupan |
| dictamen estructural | Structural inspection report | orquestador, 2.ª vuelta |
| tipo de incidencia (enum) | weather, maintenance, legal issue, vandalism, operational suspension, accident, other | solo inglés; en español el dato en minúsculas, como siempre |
| tipo de campaña en Creativos | OOH / DOOH / Hybrid | reusa `campanas.tipo.*` solo en inglés |
| slots reservados | booked slots | |
| ingreso / margen / tasa de cierre / ganado | revenue / margin / close rate / won | |
| ocupación de la red / espacio·día / cara libre | network occupancy / space·day / available face | «available face», orquestador, 2.ª vuelta |
| huecos y renovaciones | gaps and renewals | |
| por cobrar por antigüedad / cuota / sin vencer | receivables by age / installment / not yet due | |
| pausa legal | legal restriction | orquestador, 2.ª vuelta («legal hold» en EE. UU. es retención de documentos) |
| razón social / nombre comercial | legal name / trade name | |
| recibo de luz / consumo | electricity bill / consumption | orquestador |
| predio / medidor / número de servicio | property / meter / service number | |
| punto de medición / pantalla suelta | metering point / standalone screen | |
| capturar / tanda / renglón | enter / batch / row | |
| alumbrado público / adeudos | street lighting / past-due balances | |
| recibo BIMESTRAL | bill issued EVERY TWO MONTHS | periodicidades en letra; «bimonthly» lo prohíbe la costura |
| título de `/energia` | Power usage | el del menú (`nav.energia`) |

## Segunda vuelta (validación ÁMBAR, `docs/i18n/validacion-operaciones-2.md`)

| hallazgo | qué se hizo |
|---|---|
| `energia.lectura.ok` «All 1 file were read» | partida en `.uno/.otros` por `total`: «1 file was read and it produces 1 row.» / «3 files were read…» |
| `desajuste.*` «the 1 months you declared», `cubre.otros` «all 2 cover» | sin plural por `esperados`: «…don’t match the number of months you declared (1): the number of calendar months covered by those 2 is 3» |
| `derive.ts` tipo de incidencia crudo | `CLAVE_INCIDENCIA` → `inicio.incidencia.*` solo en inglés; el español sigue con `toLowerCase()`. Se quitaron «vandalismo» y «otro» de `COMUNES` |
| `creativos/page.tsx` `tipoCampana` crudo | `CLAVE_TIPO_CAMPANA` de Campañas solo en inglés; el fixture usa ya un valor válido (`HIBRIDA`, y `DOOH` en la ficha de OT) |
| `inicio.sale` «no client leaves» | «Ending {fecha}: {campana} ({cliente})» → «Ending Nov 20, 2026: Otoño (no client)» |
| `energia.lectura.alerta` «1 rows / 1 of 1 files» | «Files read: {leidos} of {total}; rows: {filas}.»: sin plural que romper |
| «Assign to (assignee)» | «Assign to» |
| «Your 1 campaign is» | «You have 1 campaign and it is on static media…» |
| «its campaign is finished» | «its campaign in DOOHmain is ended» |
| «meter no number» | «(no number)» |
| «3 points» | «3 metering points» |
| «billing» del recibo de CFE | «period charges» |
| subtítulo de Huecos | «what becomes free in the next {n} days» |
| «Over 90» | «Over 90 days» |
| sujetos «they» en subtítulos de KPI | «keeping the billing lock closed», «holding back publishing» |
| Mutantes de clases del Dashboard (M5/M5b/M5c) | el mock de `CardColapsable` pinta `className` y `contentClassName`, y una instantánea guarda el HTML español de los 7 estados. Medido: `lg:col-span-2` → `lg:col-span-3` (M5c, el que ni el volcado veía) y `text-2xl` → `text-xl` (M5) ponen en rojo las 7 instantáneas |

## Diccionario

### `textos/operaciones2.ts` (202 claves)

| clave | español | inglés | dónde |
|---|---|---|---|
| `operaciones2.comun.de` | {a} de {b} | {a} of {b} | page.tsx:238, page.tsx:238, page.tsx:556 |
| `operaciones2.comun.campana` | Campaña | Campaign | page.tsx:510, OTVista.tsx:580 |
| `operaciones2.comun.pantalla` | Pantalla | Screen | page.tsx:519 |
| `operaciones2.comun.descripcion` | Descripción | Description | page.tsx:556 |
| `operaciones2.comun.tipo` | Tipo | Type | OTVista.tsx:546 |
| `operaciones2.comun.prioridad` | Prioridad | Priority | page.tsx:565, OTVista.tsx:551 |
| `operaciones2.comun.responsable` | Responsable | Assignee | OTVista.tsx:577 |
| `operaciones2.comun.sin-asignar` | Sin asignar | Unassigned | page.tsx:852, page.tsx:94, page.tsx:187 |
| `operaciones2.comun.vencida` | Vencida | Overdue | page.tsx:349, OTVista.tsx:566 |
| `operaciones2.comun.por-vencer` | Por vencer | Due soon | page.tsx:181, page.tsx:354, OTVista.tsx:571 |
| `operaciones2.comun.guardando` | Guardando… | Saving… | page.tsx:621, OTVista.tsx:305, OTVista.tsx:371 |
| `operaciones2.comun.ver-todas` | Ver todas | Show all | page.tsx:282, page.tsx:381 |
| `operaciones2.comun.ver-todas-n` | Ver todas ({n}) | Show all ({n}) | page.tsx:381 |
| `operaciones2.comun.ver-menos` | Ver menos | Show less | page.tsx:381 |
| `operaciones2.tipo-ot.montaje-lona` | Montaje de lona | Vinyl installation | claves.ts:16 |
| `operaciones2.tipo-ot.montaje-digital` | Montaje digital | Digital installation | claves.ts:17 |
| `operaciones2.tipo-ot.desmontaje` | Desmontaje | Removal | claves.ts:18 |
| `operaciones2.tipo-ot.mantenimiento-preventivo` | Mantenimiento preventivo | Preventive maintenance | claves.ts:19 |
| `operaciones2.tipo-ot.mantenimiento-correctivo` | Mantenimiento correctivo | Corrective maintenance | claves.ts:20 |
| `operaciones2.tipo-ot.herreria` | Herrería | Metalwork | claves.ts:21 |
| `operaciones2.tipo-ot.electrico` | Eléctrico | Electrical | claves.ts:22 |
| `operaciones2.tipo-ot.inspeccion` | Inspección | Inspection | claves.ts:23 |
| `operaciones2.tipo-ot.otro` | Otro | Other | claves.ts:24 |
| `operaciones2.prioridad.baja` | Baja | Low | claves.ts:31 |
| `operaciones2.prioridad.normal` | Normal | Normal | claves.ts:32 |
| `operaciones2.prioridad.alta` | Alta | High | claves.ts:33 |
| `operaciones2.prioridad.urgente` | Urgente | Urgent | claves.ts:34 |
| `operaciones2.ot.descripcion` | Tareas de cuadrilla · seguimiento de campo | Crew tasks · field tracking | page.tsx:139 |
| `operaciones2.ot.nueva` | Nueva OT | New work order | page.tsx:143, page.tsx:292, page.tsx:487 |
| `operaciones2.ot.filtro.todas` | Todas | All | page.tsx:74 |
| `operaciones2.ot.filtro.pendientes` | Pendientes | Pending | page.tsx:75 |
| `operaciones2.ot.filtro.asignadas` | Asignadas | Assigned | page.tsx:76 |
| `operaciones2.ot.filtro.en-proceso` | En proceso | In progress | page.tsx:77 |
| `operaciones2.ot.filtro.completadas` | Completadas | Completed | page.tsx:78 |
| `operaciones2.ot.kpi.abiertas` | Abiertas | Open | page.tsx:170 |
| `operaciones2.ot.kpi.en-proceso` | {n} en proceso | {n} in progress | page.tsx:172 |
| `operaciones2.ot.kpi.vencidas` | Vencidas | Overdue | page.tsx:175 |
| `operaciones2.ot.kpi.frenan` | frenan el candado de facturación | keeping the billing lock closed | page.tsx:177 |
| `operaciones2.ot.kpi.compromiso` | compromiso en 2 días o menos | due in 2 days or less | page.tsx:183 |
| `operaciones2.ot.kpi.sin-responsable` | abiertas sin responsable | open with no assignee | page.tsx:189 |
| `operaciones2.ot.banner.vencidas.uno` | {n} OT vencida | {n} overdue work order | page.tsx:210 |
| `operaciones2.ot.banner.vencidas.otros` | {n} OT vencidas | {n} overdue work orders | page.tsx:210 |
| `operaciones2.ot.banner.por-vencer` | {n} por vencer | {n} due soon | page.tsx:216 |
| `operaciones2.ot.banner.explica` | — una OT abierta que pasó su fecha compromiso frena el candado de facturación. | — an open work order past its due date keeps the billing lock closed. | page.tsx:221 |
| `operaciones2.ot.lista` | Órdenes de trabajo | Work orders | page.tsx:233 |
| `operaciones2.ot.vacio.filtro` | Ninguna OT en «{filtro}» | No work orders in “{filtro}” | page.tsx:280, page.tsx:281 |
| `operaciones2.ot.vacio.filtro-detalle` | Las demás siguen en «Todas». | The rest are still under “All”. | page.tsx:281 |
| `operaciones2.ot.vacio.titulo` | Todavía no hay órdenes de trabajo | No work orders yet | page.tsx:287 |
| `operaciones2.ot.vacio.detalle` | Crea la primera con «Nueva OT»: se liga a una campaña y a su pantalla. | Create the first one with “New work order”: it is linked to a campaign and its screen. | page.tsx:288 |
| `operaciones2.ot.abrir` | Abrir OT | Open work order | page.tsx:314 |
| `operaciones2.ot.ver` | Ver OT | View work order | page.tsx:314 |
| `operaciones2.ot.fecha-compromiso` | Fecha compromiso | Due date | page.tsx:342, page.tsx:570 |
| `operaciones2.ot.evidencias.uno` | {n} evidencia | {n} evidence photo | page.tsx:364 |
| `operaciones2.ot.evidencias.otros` | {n} evidencias | {n} evidence photos | page.tsx:364 |
| `operaciones2.ot.nueva.no-crear` | No se pudo crear la OT | Could not create the work order | page.tsx:487 |
| `operaciones2.ot.nueva.titulo` | Nueva orden de trabajo | New work order | page.tsx:496 |
| `operaciones2.ot.nueva.subtitulo` | Asigna una tarea a cuadrilla | Assign a task to a crew | page.tsx:497 |
| `operaciones2.ot.nueva.creando` | Creando… | Creating… | page.tsx:502 |
| `operaciones2.ot.nueva.crear` | Crear OT | Create work order | page.tsx:502 |
| `operaciones2.ot.nueva.sin-campana` | — Sin campaña — | — No campaign — | page.tsx:512 |
| `operaciones2.ot.nueva.auto` | (auto por campaña) | (set by the campaign) | page.tsx:520 |
| `operaciones2.ot.nueva.sin-pantalla` | — Sin pantalla — | — No screen — | page.tsx:525 |
| `operaciones2.ot.nueva.opcion-digital` | · Digital | · Digital | page.tsx:528 |
| `operaciones2.ot.nueva.opcion-fija` | · Fija | · Static | page.tsx:528 |
| `operaciones2.ot.nueva.sin-sitios` | Esta campaña no tiene sitios reservados. | This campaign has no booked sites. | page.tsx:533 |
| `operaciones2.ot.nueva.tipo-tarea` | Tipo de tarea | Task type | page.tsx:541 |
| `operaciones2.ot.nueva.opciones-digital` | (opciones de pantalla digital) | (options for a digital screen) | page.tsx:544 |
| `operaciones2.ot.nueva.opciones-fija` | (opciones de pantalla fija) | (options for a static screen) | page.tsx:544 |
| `operaciones2.ot.nueva.descripcion-ej` | p. ej. Montaje de lona en espectacular… | e.g. Vinyl installation on a billboard… | page.tsx:561 |
| `operaciones2.ot.nueva.asignar` | Asignar a (responsable) | Assign to | page.tsx:574 |
| `operaciones2.ot.nueva.sin-asignar` | — Sin asignar — | — Unassigned — | page.tsx:576 |
| `operaciones2.ficha.no-cargar` | No se pudo cargar la orden de trabajo. | Could not load the work order. | OTVista.tsx:188 |
| `operaciones2.ficha.inicia-sesion` | Inicia sesión para continuar | Sign in to continue | OTVista.tsx:190 |
| `operaciones2.ficha.no-cerrar` | No se pudo cerrar la OT | Could not close the work order | OTVista.tsx:223 |
| `operaciones2.ficha.sin-cambios` | No hay ningún cambio que guardar. | There are no changes to save. | OTVista.tsx:250 |
| `operaciones2.ficha.costo-borrado` | Costo borrado: esta visita vuelve a entrar al reporte con la estimación por tipo. | Cost cleared: this visit goes back into the report with the per-type estimate. | OTVista.tsx:259 |
| `operaciones2.ficha.costo-guardado` | Costo guardado. El reporte de rentabilidad usará este importe en vez de la estimación. | Cost saved. The profitability report will use this amount instead of the estimate. | OTVista.tsx:260 |
| `operaciones2.ficha.no-guardar-costo` | No se pudo guardar el costo | Could not save the cost | OTVista.tsx:265 |
| `operaciones2.ficha.costo` | Costo real de esta visita | Actual cost of this visit | OTVista.tsx:259, OTVista.tsx:260, OTVista.tsx:277 |
| `operaciones2.ficha.costo-explica` | Lo que de verdad costó. {sustituye} a la estimación por tipo de tarea que usa el reporte de rentabilidad, no se suma a ella. Déjalo vacío si no lo sabes: entonces el reporte sigue usando la estimación y te lo dice. | What it really cost. It {sustituye} the per-type estimate that the profitability report uses; it is not added to it. Leave it empty if you don’t know: the report keeps using the estimate and tells you so. | OTVista.tsx:279 |
| `operaciones2.ficha.costo-sustituye` | Sustituye | replaces | OTVista.tsx:280 |
| `operaciones2.ficha.sin-capturar` | Sin capturar | Not entered | OTVista.tsx:299, OTVista.tsx:320 |
| `operaciones2.ficha.guardar-costo` | Guardar costo | Save cost | OTVista.tsx:305 |
| `operaciones2.ficha.guardado-importe` | Guardado: {importe} | Saved: {importe} | OTVista.tsx:312 |
| `operaciones2.ficha.guardado-cero` |  — esta visita está capturada como que no costó nada. |  — this visit is recorded as having cost nothing. | OTVista.tsx:315 |
| `operaciones2.ficha.sin-capturar-reporte` | Sin capturar: el reporte usa la estimación por tipo de tarea. | Not entered: the report uses the per-type estimate. | OTVista.tsx:320 |
| `operaciones2.ficha.campana-de` | Campaña: {nombre} | Campaign: {nombre} | OTVista.tsx:332 |
| `operaciones2.ficha.responsable-de` | Responsable: {nombre} | Assignee: {nombre} | OTVista.tsx:335 |
| `operaciones2.ficha.guardado` | Guardado | Saved | OTVista.tsx:312, OTVista.tsx:315, OTVista.tsx:376 |
| `operaciones2.ficha.checklist` | Checklist | Checklist | OTVista.tsx:385, OTVista.tsx:741 |
| `operaciones2.ficha.error-guardar` | Error al guardar: {error}. Lo tachado se ve aquí pero aún NO está guardado. | Error while saving: {error}. What you checked off shows here but is NOT saved yet. | OTVista.tsx:395 |
| `operaciones2.ficha.reintentar` | Reintentar | Retry | OTVista.tsx:398 |
| `operaciones2.ficha.solo-lectura` | Solo lectura: tu rol puede ver esta orden de trabajo, pero no marcar su checklist. | Read only: your role can see this work order but cannot check off its checklist. | OTVista.tsx:404 |
| `operaciones2.ficha.foto` | Fotografía comprobatoria | Proof photo | OTVista.tsx:439 |
| `operaciones2.ficha.tomar-foto` | Tomar foto | Take photo | OTVista.tsx:440 |
| `operaciones2.ficha.sello` | Sello de ubicación | Location stamp | OTVista.tsx:446 |
| `operaciones2.ficha.capturar-ubicacion` | Capturar ubicación | Capture location | OTVista.tsx:455 |
| `operaciones2.ficha.cerrando` | Cerrando… | Closing… | OTVista.tsx:473 |
| `operaciones2.ficha.cerrar` | Cerrar OT | Close work order | OTVista.tsx:475 |
| `operaciones2.ficha.completa` | Completa el checklist, toma una foto y captura la ubicación. | Complete the checklist, take a photo and capture the location. | OTVista.tsx:480 |
| `operaciones2.ficha.compromiso` | Compromiso | Due date | OTVista.tsx:562 |
| `operaciones2.ficha.candado.titulo` | Confirma con tu contraseña | Confirm with your password | OTVista.tsx:643 |
| `operaciones2.ficha.candado.subtitulo` | Capturar el costo de una orden de trabajo cambia el margen del reporte de rentabilidad: tu organización pide que vuelvas a identificarte. | Entering the cost of a work order changes the margin in the profitability report: your organization asks you to verify your identity again. | OTVista.tsx:644 |
| `operaciones2.ficha.candado.confirmar` | Confirmar y guardar el costo | Confirm and save the cost | OTVista.tsx:645 |
| `operaciones2.ficha.cerrada` | OT cerrada | Work order closed | OTVista.tsx:732, OTVista.tsx:735 |
| `operaciones2.ficha.evidencia-enviada` | La evidencia se envió al pipeline de la campaña. | The evidence was sent to the campaign pipeline. | OTVista.tsx:733 |
| `operaciones2.ficha.cerrada-el` | Cerrada el {fecha} | Closed on {fecha} | OTVista.tsx:735 |
| `operaciones2.ficha.checklist-cumplido` | Checklist cumplido | Checklist completed | OTVista.tsx:741 |
| `operaciones2.ficha.candado-encendido` | Candado de facturación encendido | Billing lock open | OTVista.tsx:763 |
| `operaciones2.ficha.evidencia-alt` | evidencia | evidence | OTVista.tsx:769 |
| `operaciones2.ficha.puedes-cerrar` | Puedes cerrar esta ventana. La evidencia ya quedó registrada. | You can close this window. The evidence is already recorded. | OTVista.tsx:774 |
| `operaciones2.ot.costo.negativo` | El costo no puede ser negativo | The cost cannot be negative | costo-ot-captura.ts:59 |
| `operaciones2.ot.costo.aviso-sin` | Esta OT no tiene costo capturado. Si la cierras, ya no podrás registrarlo después: el reporte de rentabilidad usará la estimación por tipo de tarea. | This work order has no cost entered. If you close it, you won’t be able to record it later: the profitability report will use the per-type estimate. | costo-ot-captura.ts:105 |
| `operaciones2.ot.costo.aviso-con` | Al cerrarla, el costo de {importe} queda fijo: ya no se podrá cambiar. | Once closed, the cost of {importe} is final: it can’t be changed. | costo-ot-captura.ts:108 |
| `operaciones2.ot.costo.cerrada-sin` | Se cerró sin costo capturado: el reporte de rentabilidad usa la estimación por tipo de tarea. | It was closed with no cost entered: the profitability report uses the per-type estimate. | costo-ot-captura.ts:114 |
| `operaciones2.ot.costo.cerrada-con` | Costo registrado: {importe}. La OT está cerrada y ya no se puede cambiar. | Recorded cost: {importe}. The work order is closed and can no longer be changed. | costo-ot-captura.ts:117 |
| `operaciones2.creativos.descripcion` | Sube y aprueba las imágenes de cada campaña, y asigna cuál va en cada slot reservado. | Upload and approve each campaign’s images, and assign which one goes in each booked slot. | page.tsx:183 |
| `operaciones2.creativos.kpi.por-aprobar` | Por aprobar | Pending approval | page.tsx:190 |
| `operaciones2.creativos.kpi.frenan` | frenan la publicación | holding back publishing | page.tsx:192 |
| `operaciones2.creativos.kpi.aprobados` | Aprobados | Approved | page.tsx:195 |
| `operaciones2.creativos.kpi.listos` | listos para asignar | ready to assign | page.tsx:195 |
| `operaciones2.creativos.kpi.rechazados` | Rechazados | Rejected | page.tsx:197 |
| `operaciones2.creativos.kpi.reemplazar` | hay que reemplazarlos | they need to be replaced | page.tsx:199 |
| `operaciones2.creativos.kpi.sin-creativo` | Spots sin creativo | Slots with no creative | page.tsx:203 |
| `operaciones2.creativos.kpi.de-spots.uno` | de {n} spot reservado | of {n} booked slot | page.tsx:205 |
| `operaciones2.creativos.kpi.de-spots.otros` | de {n} spots reservados | of {n} booked slots | page.tsx:205 |
| `operaciones2.creativos.buscar` | Buscar por campaña, folio, cliente o nombre del creativo… | Search by campaign, internal ref., client or creative name… | page.tsx:222 |
| `operaciones2.creativos.filtro.todos` | Todos los creativos | All creatives | page.tsx:231 |
| `operaciones2.creativos.filtro.pendientes` | Con pendientes de aprobar | With creatives pending approval | page.tsx:232 |
| `operaciones2.creativos.filtro.aprobados` | Con aprobados | With approved creatives | page.tsx:233 |
| `operaciones2.creativos.filtro.rechazados` | Con rechazados | With rejected creatives | page.tsx:234 |
| `operaciones2.creativos.filtro.sin` | Sin creativos todavía | No creatives yet | page.tsx:235 |
| `operaciones2.creativos.vacio.sin-digitales` | Ninguna campaña tiene pantallas digitales | No campaign has digital screens | page.tsx:251, page.tsx:254, page.tsx:255 |
| `operaciones2.creativos.vacio.sin-digitales-detalle.uno` | Aquí solo se gestionan los creativos de pantallas digitales. Tus {n} campaña son de medios fijos: su arte se lleva en Imprenta. | Only creatives for digital screens are managed here. You have {n} campaign and it is on static media: its artwork is handled in Printing. | page.tsx:254, page.tsx:255 |
| `operaciones2.creativos.vacio.sin-digitales-detalle.otros` | Aquí solo se gestionan los creativos de pantallas digitales. Tus {n} campañas son de medios fijos: su arte se lleva en Imprenta. | Only creatives for digital screens are managed here. Your {n} campaigns are on static media: their artwork is handled in Printing. | page.tsx:254, page.tsx:255 |
| `operaciones2.creativos.vacio.ir-imprenta` | Ir a Imprenta | Go to Printing | page.tsx:260 |
| `operaciones2.creativos.vacio.sin-campanas` | Sin campañas con slots o creativos | No campaigns with slots or creatives | page.tsx:267, page.tsx:268 |
| `operaciones2.creativos.vacio.sin-campanas-detalle` | Reserva sitios en Comercial o sube un creativo para gestionarlos aquí. | Book sites in Sales or upload a creative to manage them here. | page.tsx:268 |
| `operaciones2.creativos.vacio.ninguna` | Ninguna campaña coincide | No campaign matches | page.tsx:276, page.tsx:277 |
| `operaciones2.creativos.vacio.ninguna-detalle` | Prueba con otro texto de búsqueda o quita el filtro de estado. | Try a different search or remove the status filter. | page.tsx:277 |
| `operaciones2.creativos.limpiar` | Limpiar filtros | Clear filters | page.tsx:286 |
| `operaciones2.creativos.imagen-supera` | La imagen supera {mb} MB | The image exceeds {mb} MB | page.tsx:381, page.tsx:484 |
| `operaciones2.creativos.no-subir` | No se pudo subir | Could not upload | page.tsx:397 |
| `operaciones2.creativos.no-guardar` | No se pudo guardar | Could not save | page.tsx:419 |
| `operaciones2.creativos.motivo-rechazo` | Motivo de rechazo (opcional): | Reason for rejection (optional): | page.tsx:426 |
| `operaciones2.creativos.no-validar` | No se pudo validar | Could not save the review | page.tsx:431 |
| `operaciones2.creativos.retirado-doohmain` | “{nombre}” se retiró. Su arte sigue en DOOHmain — quítalo en su panel | “{nombre}” was withdrawn. Its artwork is still in DOOHmain — remove it in its panel | page.tsx:446 |
| `operaciones2.creativos.eliminado` | “{nombre}” se eliminó | “{nombre}” was deleted | page.tsx:447 |
| `operaciones2.creativos.no-eliminar` | No se pudo eliminar | Could not delete | page.tsx:451 |
| `operaciones2.creativos.reemplazado-doohmain` | Arte reemplazado. En DOOHmain el anterior ya no se reproduce, pero sigue en la lista: elimina la campaña anterior en su panel (la que aparece como finalizada). Aprueba el nuevo para publicarlo. | Artwork replaced. In DOOHmain the previous one no longer plays, but it is still on the list: delete the previous campaign from its panel (the one shown as finished). Approve the new one to publish it. | page.tsx:503 |
| `operaciones2.creativos.reemplazado` | Arte reemplazado. Apruébalo de nuevo para publicarlo. | Artwork replaced. Approve it again to publish it. | page.tsx:503, page.tsx:504 |
| `operaciones2.creativos.no-reemplazar` | No se pudo reemplazar | Could not replace | page.tsx:508 |
| `operaciones2.creativos.no-asignar` | No se pudo asignar | Could not assign | page.tsx:522 |
| `operaciones2.creativos.chip.por-aprobar` | {n} por aprobar | {n} pending approval | page.tsx:563 |
| `operaciones2.creativos.chip.spots-con` | {con}/{total} spots con creativo | {con}/{total} slots with a creative | page.tsx:568 |
| `operaciones2.creativos.imagen` | Imagen | Image | page.tsx:381, page.tsx:484, page.tsx:580 |
| `operaciones2.creativos.codigo` | Código | Code | page.tsx:583, page.tsx:600, page.tsx:604 |
| `operaciones2.creativos.nombre` | Nombre del creativo | Creative name | page.tsx:593 |
| `operaciones2.creativos.codigo-ej` | Pega aquí el código del creativo (HTML/UTF)… | Paste the creative’s code here (HTML/UTF)… | page.tsx:604 |
| `operaciones2.creativos.guardar-codigo` | Guardar código | Save code | page.tsx:621 |
| `operaciones2.creativos.lista` | Creativos ({n}) | Creatives ({n}) | page.tsx:629 |
| `operaciones2.creativos.sin-creativos` | Sin creativos. Sube una imagen para aprobarla. | No creatives. Upload an image to approve it. | page.tsx:631 |
| `operaciones2.creativos.etiqueta-codigo` | código | code | page.tsx:680 |
| `operaciones2.creativos.retirado-title` | Retirado del sistema; su arte sigue en DOOHmain (quítalo en su panel) | Withdrawn from the system; its artwork is still in DOOHmain (remove it in its panel) | page.tsx:687 |
| `operaciones2.creativos.retirado` | Retirado · pendiente en DOOHmain | Withdrawn · pending in DOOHmain | page.tsx:446, page.tsx:687, page.tsx:689 |
| `operaciones2.creativos.ver-html` | Ver HTML | View HTML | page.tsx:705 |
| `operaciones2.creativos.ya-aprobado` | El creativo ya fue aprobado — reemplázalo o elimínalo para cambiarlo | This creative is already approved — replace or delete it to change it | page.tsx:725 |
| `operaciones2.creativos.aprobar` | Aprobar | Approve | page.tsx:728 |
| `operaciones2.creativos.rechazar` | Rechazar | Reject | page.tsx:739 |
| `operaciones2.creativos.reemplazar-de` | Reemplazar el arte de {nombre} | Replace the artwork of {nombre} | page.tsx:747 |
| `operaciones2.creativos.reemplazar` | Reemplazar el arte | Replace the artwork | page.tsx:747, page.tsx:748, page.tsx:931 |
| `operaciones2.creativos.eliminar-de` | Eliminar {nombre} | Delete {nombre} | page.tsx:758 |
| `operaciones2.creativos.eliminar` | Eliminar | Delete | page.tsx:758, page.tsx:759, page.tsx:917 |
| `operaciones2.creativos.slots` | Slots reservados ({n}) | Booked slots ({n}) | page.tsx:778 |
| `operaciones2.creativos.sin-slots` | Sin slots reservados todavía. | No booked slots yet. | page.tsx:784 |
| `operaciones2.creativos.sitio` | Sitio | Site | page.tsx:797 |
| `operaciones2.creativos.sin-creativo` | Sin creativo | No creative | page.tsx:631, page.tsx:801 |
| `operaciones2.creativos.rotan.uno` | 1 creativo | 1 creative | page.tsx:805 |
| `operaciones2.creativos.rotan.otros` | {n} creativos rotan | {n} creatives rotate | page.tsx:805 |
| `operaciones2.creativos.aprueba-uno` | Aprueba un creativo para asignarlo aquí. | Approve a creative to assign it here. | page.tsx:812 |
| `operaciones2.creativos.del-sitio` | Creativo del sitio | Site creative | page.tsx:843 |
| `operaciones2.creativos.aprueba-al-menos` | Aprueba al menos un creativo para poder asignarlo a los slots. | Approve at least one creative to be able to assign it to the slots. | page.tsx:867 |
| `operaciones2.creativos.creativo` | Creativo | Creative | page.tsx:879, page.tsx:971 |
| `operaciones2.creativos.creativo-min` | creativo | creative | page.tsx:971 |
| `operaciones2.creativos.fuente.cargando` | {formato} · cargando… | {formato} · loading… | page.tsx:883, page.tsx:909 |
| `operaciones2.creativos.fuente.caracteres` | {formato} · {n} caracteres | {formato} · {n} characters | page.tsx:884 |
| `operaciones2.creativos.descargar` | Descargar .html | Download .html | page.tsx:901 |
| `operaciones2.creativos.fuente.cargando-texto` | Cargando la fuente… | Loading the source… | page.tsx:909 |
| `operaciones2.creativos.fuente.no-cargar` | No se pudo cargar la fuente de este creativo. | Could not load this creative’s source. | page.tsx:910 |
| `operaciones2.creativos.eliminar.titulo` | Eliminar creativo | Delete creative | page.tsx:917 |
| `operaciones2.creativos.eliminar.si` | Sí, eliminar | Yes, delete | page.tsx:918 |
| `operaciones2.creativos.eliminar.cuerpo` | ¿Seguro que quieres bajar {nombre}? Si ya está publicado, su campaña se finaliza, pero {arte} (su API no lo permite): quedará marcado como “pendiente en DOOHmain” para que lo quites en su panel. | Are you sure you want to take down {nombre}? If it is already published, its campaign in DOOHmain is ended, but {arte} (its API does not allow it): it will be marked as “pending in DOOHmain” so you can remove it from its panel. | page.tsx:922 |
| `operaciones2.creativos.eliminar.arte` | el arte no se puede quitar de DOOHmain | the artwork cannot be removed from DOOHmain | page.tsx:924 |
| `operaciones2.creativos.reemplazo.elegir` | Elegir el arte nuevo | Choose the new artwork | page.tsx:932 |
| `operaciones2.creativos.reemplazo.cuerpo` | Si {nombre} ya está publicado, al reemplazarlo {orden}: deja de reproducirse en todas sus pantallas. El nuevo queda pendiente hasta que lo apruebes. | If {nombre} is already published, replacing it {orden}: it stops playing on all its screens. The new one stays pending until you approve it. | page.tsx:941 |
| `operaciones2.creativos.reemplazo.orden` | se manda a DOOHmain la orden de bajar el arte anterior | sends DOOHmain the order to take down the previous artwork | page.tsx:943 |
| `operaciones2.creativos.reemplazo.recordatorio` | {recordatorio} después entra al panel de DOOHmain y {elimina}. DOOHmain no deja borrarla desde aquí, y la nueva lleva el mismo nombre: la anterior es la que aparece como finalizada. | {recordatorio} afterwards, go to the DOOHmain panel and {elimina}. DOOHmain doesn’t let you delete it from here, and the new one has the same name: the previous one is the one shown as finished. | page.tsx:947, page.tsx:948 |
| `operaciones2.creativos.reemplazo.recordatorio-etiqueta` | Recordatorio: | Reminder: | page.tsx:948 |
| `operaciones2.creativos.reemplazo.elimina` | elimina la campaña anterior | delete the previous campaign | page.tsx:949 |
| `operaciones2.creativos.estado.pendiente` | Pendiente | Pending | page.tsx:1006 |
| `operaciones2.creativos.estado.validada` | Aprobado | Approved | page.tsx:1007 |
| `operaciones2.creativos.estado.rechazada` | Rechazado | Rejected | page.tsx:1008 |

### `textos/inicio.ts` (148 claves)

| clave | español | inglés | dónde |
|---|---|---|---|
| `inicio.razon-social` | Razón social: {nombre} | Legal name: {nombre} | page.tsx:169 |
| `inicio.nombre-comercial` | Nombre comercial: {nombre} | Trade name: {nombre} | page.tsx:170 |
| `inicio.indicadores` | Indicadores del mes | This month’s indicators | page.tsx:216 |
| `inicio.ingreso-de` | Ingreso de {mes} | {mes} revenue | page.tsx:238, page.tsx:254 |
| `inicio.ingreso-sub` | lo que se devenga este mes, prorrateado por días | what is earned this month, prorated by day | page.tsx:240 |
| `inicio.margen-de` | Margen de {mes} | {mes} margin | page.tsx:245, page.tsx:255 |
| `inicio.margen-sub` | {margen} · costo {costo} | {margen} · cost {costo} | page.tsx:247 |
| `inicio.requiere-finanzas` | requiere permiso de Finanzas | requires Finance permission | page.tsx:254, page.tsx:255 |
| `inicio.no-calcular` | no se pudo calcular | could not be calculated | page.tsx:254, page.tsx:255, page.tsx:342 |
| `inicio.pipeline-abierto` | Pipeline abierto | Open pipeline | page.tsx:261 |
| `inicio.pipeline-sub` | {propuestas} · {enviadas} | {propuestas} · {enviadas} | page.tsx:263 |
| `inicio.propuestas.uno` | {n} propuesta | {n} proposal | page.tsx:264, page.tsx:387 |
| `inicio.propuestas.otros` | {n} propuestas | {n} proposals | page.tsx:264, page.tsx:387 |
| `inicio.enviadas.uno` | {n} enviada | {n} sent | page.tsx:265 |
| `inicio.enviadas.otros` | {n} enviadas | {n} sent | page.tsx:265 |
| `inicio.tasa` | Tasa de cierre | Close rate | page.tsx:271, page.tsx:273, page.tsx:389 |
| `inicio.tasa-sub` | aprobadas de las decididas en {n} días | approved out of those decided in {n} days | page.tsx:273 |
| `inicio.ganado-en` | Ganado en {mes} | Won in {mes} | page.tsx:279, page.tsx:388 |
| `inicio.aprobadas-propuestas.uno` | {n} propuesta aprobada | {n} approved proposal | page.tsx:281 |
| `inicio.aprobadas-propuestas.otros` | {n} propuestas aprobadas | {n} approved proposals | page.tsx:281 |
| `inicio.ocupacion-red` | Ocupación de la red | Network occupancy | page.tsx:290, page.tsx:292 |
| `inicio.ocupacion-red-sub` | {ocupados} de {capacidad} espacios · digital {dOcupados}/{dCapacidad} · fijas {fOcupados}/{fCapacidad} | {ocupados} of {capacidad} spaces · digital {dOcupados}/{dCapacidad} · static {fOcupados}/{fCapacidad} | page.tsx:292 |
| `inicio.costos-de` | Costos de {mes} | {mes} costs | page.tsx:315 |
| `inicio.costo.renta` | Renta | Rent | page.tsx:316 |
| `inicio.costo.operacion` | Operación | Operations | page.tsx:317 |
| `inicio.costo.luz` | Luz | Electricity | page.tsx:318 |
| `inicio.costo.total` | Total | Total | page.tsx:319, page.tsx:570 |
| `inicio.costo.impresion` | Impresión (aparte) | Printing (separate) | page.tsx:320 |
| `inicio.ver-por-pantalla` | Ver por pantalla | View by screen | page.tsx:322 |
| `inicio.rendimiento` | Rendimiento | Performance | page.tsx:326 |
| `inicio.renta-ingreso` | Renta / ingreso | Rent / revenue | page.tsx:328 |
| `inicio.tarifa-cobrada` | Tarifa publicada cobrada | Published rate charged | page.tsx:332 |
| `inicio.de-ventas.uno` | de {n} venta con tarifa publicada | of {n} sale with a published rate | page.tsx:337 |
| `inicio.de-ventas.otros` | de {n} ventas con tarifa publicada | of {n} sales with a published rate | page.tsx:337 |
| `inicio.sin-tarifa` |  · {n} sin tarifa con qué comparar |  · {n} with no rate to compare against | page.tsx:337 |
| `inicio.sin-ventas` | sin ventas con tarifa publicada este mes | no sales with a published rate this month | page.tsx:339 |
| `inicio.ocupacion` | Ocupación | Occupancy | page.tsx:290, page.tsx:292, page.tsx:353 |
| `inicio.ocupacion-sub` | {ocupados} espacios·día ocupados de {disponibles} disponibles | {ocupados} space·days occupied out of {disponibles} available | page.tsx:358 |
| `inicio.gran.dia` | Día | Day | page.tsx:88 |
| `inicio.gran.semana` | Semana | Week | page.tsx:89 |
| `inicio.gran.mes` | Mes | Month | page.tsx:90 |
| `inicio.pipeline` | Pipeline comercial | Sales pipeline | page.tsx:261, page.tsx:263, page.tsx:375 |
| `inicio.abierto` | Abierto | Open | page.tsx:387 |
| `inicio.aprobadas.uno` | {n} aprobada | {n} approved | page.tsx:388 |
| `inicio.aprobadas.otros` | {n} aprobadas | {n} approved | page.tsx:388 |
| `inicio.ultimos` | últimos {n} días | last {n} days | page.tsx:389 |
| `inicio.por-vendedor` | Ganado por vendedor | Won by sales rep | page.tsx:392 |
| `inicio.nada-aprobado` | Nada aprobado en {mes} todavía. | Nothing approved in {mes} yet. | page.tsx:394 |
| `inicio.otros-vendedores` | Otros vendedores | Other sales reps | indicadores.ts:158 |
| `inicio.sin-vendedor` | Sin vendedor | No sales rep | indicadores.ts:158 |
| `inicio.alertas` | Alertas | Alerts | page.tsx:415, page.tsx:673 |
| `inicio.sin-alertas` | Sin alertas activas. | No active alerts. | page.tsx:427, page.tsx:428 |
| `inicio.sin-alertas-tipo` | No hay alertas de los tipos que elegiste mostrar. | There are no alerts of the types you chose to show. | page.tsx:428 |
| `inicio.urgentes.uno` | {n} urgente | {n} urgent | page.tsx:440 |
| `inicio.urgentes.otros` | {n} urgentes | {n} urgent | page.tsx:440 |
| `inicio.ver-menos` | Ver menos | Show less | page.tsx:472, page.tsx:542 |
| `inicio.ver-todas` | Ver todas ({n}) | Show all ({n}) | page.tsx:472 |
| `inicio.ver-todos` | Ver todos ({n}) | Show all ({n}) | page.tsx:542 |
| `inicio.config-alertas` | Configurar alertas | Configure alerts | page.tsx:655 |
| `inicio.elegir-alertas` | Elegir qué alertas ver | Choose which alerts to see | page.tsx:656 |
| `inicio.alertas-a-mostrar` | Alertas a mostrar | Alerts to show | page.tsx:673 |
| `inicio.tipo-alerta.pago` | Rentas vencidas | Rent issues | page.tsx:73 |
| `inicio.tipo-alerta.contrato` | Contratos por vencer | Contract issues | page.tsx:74 |
| `inicio.tipo-alerta.cobranza` | Facturas (cobranza) | Invoices (collections) | page.tsx:75 |
| `inicio.tipo-alerta.incidencia` | Sitios bloqueados por incidencia | Blocked or paused sites | page.tsx:76 |
| `inicio.tipo-alerta.ot` | Órdenes de trabajo (SLA) | Work orders (SLA) | page.tsx:77 |
| `inicio.tipo-alerta.licencia` | Licencias y permisos | Licenses and permits | page.tsx:78 |
| `inicio.huecos` | Huecos y renovaciones | Gaps and renewals | page.tsx:485, page.tsx:487, page.tsx:493 |
| `inicio.huecos-sub` | lo que se queda sin campaña en los próximos {n} días | what becomes free in the next {n} days | page.tsx:487 |
| `inicio.huecos-nada` | Nada se queda libre en los próximos {n} días. | Nothing becomes free in the next {n} days. | page.tsx:493 |
| `inicio.slots-libres.uno` | {n} slot libre | {n} free slot | page.tsx:505 |
| `inicio.slots-libres.otros` | {n} slots libres | {n} free slots | page.tsx:505 |
| `inicio.slots-libres` | slots libres | free slots | page.tsx:505 |
| `inicio.cara-libre` | cara libre | available face | page.tsx:505 |
| `inicio.sale` | Sale {cliente} · {campana} · termina {fecha} | Ending {fecha}: {campana} ({cliente}) | page.tsx:509 |
| `inicio.sin-cliente` | sin cliente | no client | page.tsx:510 |
| `inicio.en-propuesta-lista` | En propuesta: {lista} | In a proposal: {lista} | page.tsx:522 |
| `inicio.hoy` | hoy | today | page.tsx:531 |
| `inicio.en-dias` | en {n} d | in {n} d | page.tsx:531 |
| `inicio.por-cobrar` | Por cobrar por antigüedad | Receivables by age | page.tsx:555 |
| `inicio.sin-saldos` | No hay saldos por cobrar. | No outstanding balances. | page.tsx:565 |
| `inicio.tramo-titulo.uno` | {tramo}: {monto} en {n} cuota | {tramo}: {monto} in {n} installment | page.tsx:581 |
| `inicio.tramo-titulo.otros` | {tramo}: {monto} en {n} cuotas | {tramo}: {monto} in {n} installments | page.tsx:581 |
| `inicio.tramo.corriente` | Sin vencer | Not yet due | page.tsx:81 |
| `inicio.tramo.d1-30` | 1–30 días | 1–30 days | page.tsx:82 |
| `inicio.tramo.d31-60` | 31–60 días | 31–60 days | page.tsx:83 |
| `inicio.tramo.d61-90` | 61–90 días | 61–90 days | page.tsx:84 |
| `inicio.tramo.d90` | Más de 90 | Over 90 days | page.tsx:85 |
| `inicio.vencido` | Vencido: {monto} | Overdue: {monto} | page.tsx:601 |
| `inicio.mapa` | Tu red en el mapa | Your network on the map | page.tsx:615 |
| `inicio.ver-comercial` | Ver comercial | View Sales | page.tsx:622 |
| `inicio.leyenda.digital` | Digital | Digital | page.tsx:634 |
| `inicio.leyenda.libre` | Libre hoy | Free today | page.tsx:635 |
| `inicio.leyenda.ocupado` | Ocupado hoy | Occupied today | page.tsx:636 |
| `inicio.leyenda.en-propuesta` | En propuesta | In a proposal | page.tsx:638 |
| `inicio.grafica.tentativas` | Tentativas | Tentative | charts.tsx:93 |
| `inicio.grafica.confirmadas` | Confirmadas | Confirmed | charts.tsx:94 |
| `inicio.alerta.sitio` | Sitio | Site | derive.ts:821 |
| `inicio.alerta.renta-vencida` | Renta vencida | Overdue rent | derive.ts:853, derive.ts:856, derive.ts:857 |
| `inicio.alerta.renta-vencida.una` | {sitio} — pago {periodo} sin liquidar ({monto}) | {sitio} — payment {periodo} unpaid ({monto}) | derive.ts:856 |
| `inicio.alerta.renta-vencida.varias` | {sitio} — {n} cuotas sin liquidar desde {periodo} ({monto}) | {sitio} — {n} installments unpaid since {periodo} ({monto}) | derive.ts:857 |
| `inicio.alerta.renta-por-vencer` | Renta por vencer | Rent due soon | derive.ts:883 |
| `inicio.alerta.renta-hoy` | {sitio} — vence hoy ({monto}) | {sitio} — due today ({monto}) | derive.ts:886 |
| `inicio.alerta.renta-en.uno` | {sitio} — vence en {n} día ({monto}) | {sitio} — due in {n} day ({monto}) | derive.ts:887 |
| `inicio.alerta.renta-en.otros` | {sitio} — vence en {n} días ({monto}) | {sitio} — due in {n} days ({monto}) | derive.ts:887 |
| `inicio.alerta.contrato-incompleto` | Contrato incompleto | Incomplete contract | derive.ts:903, derive.ts:904 |
| `inicio.alerta.contrato-incompleto.detalle` | {sitio} — falta arrendador e importe de renta | {sitio} — landlord and rent amount missing | derive.ts:904 |
| `inicio.alerta.contrato-por-vencer` | Contrato por vencer | Contract expiring soon | derive.ts:912 |
| `inicio.alerta.contrato-vence.uno` | {sitio} — vence en {n} días | {sitio} — expires in {n} day | derive.ts:913 |
| `inicio.alerta.contrato-vence.otros` | {sitio} — vence en {n} días | {sitio} — expires in {n} days | derive.ts:913 |
| `inicio.alerta.contrato-vencido` | Contrato vencido | Contract expired | derive.ts:921 |
| `inicio.alerta.contrato-vencio.uno` | {sitio} — venció hace {n} días | {sitio} — expired {n} day ago | derive.ts:922 |
| `inicio.alerta.contrato-vencio.otros` | {sitio} — venció hace {n} días | {sitio} — expired {n} days ago | derive.ts:922 |
| `inicio.alerta.ubicacion` | Ubicación | Location | derive.ts:948 |
| `inicio.alerta.licencia-vencida` | Licencia vencida | License expired | derive.ts:955 |
| `inicio.alerta.licencia-vencio.uno` | {donde} — {que} venció hace {n} días | {donde} — {que} expired {n} day ago | derive.ts:956 |
| `inicio.alerta.licencia-vencio.otros` | {donde} — {que} venció hace {n} días | {donde} — {que} expired {n} days ago | derive.ts:956 |
| `inicio.alerta.licencia-por-vencer` | Licencia por vencer | License expiring soon | derive.ts:962 |
| `inicio.alerta.licencia-vence.uno` | {donde} — {que} vence en {n} días | {donde} — {que} expires in {n} day | derive.ts:963 |
| `inicio.alerta.licencia-vence.otros` | {donde} — {que} vence en {n} días | {donde} — {que} expires in {n} days | derive.ts:963 |
| `inicio.licencia.municipal` | Licencia municipal | Municipal license | derive.ts:380 |
| `inicio.licencia.ambiental` | Permiso ambiental | Environmental permit | derive.ts:381 |
| `inicio.licencia.estructural` | Dictamen estructural | Structural inspection report | derive.ts:382 |
| `inicio.licencia.otro` | Permiso | Permit | derive.ts:383, derive.ts:946 |
| `inicio.alerta.campana` | campaña | campaign | derive.ts:996 |
| `inicio.alerta.cobertura` | El contrato no cubre la campaña | The contract does not cover the campaign | derive.ts:1007, derive.ts:1012 |
| `inicio.alerta.cobertura.vence` | {sitio} — «{campana}» va hasta {hasta} y el contrato vence el {fin} | {sitio} — “{campana}” runs until {hasta} and the contract expires on {fin} | derive.ts:1012 |
| `inicio.alerta.cobertura.sin-fin` | {sitio} — «{campana}» va hasta {hasta} y el contrato no tiene fecha de fin | {sitio} — “{campana}” runs until {hasta} and the contract has no end date | derive.ts:1012 |
| `inicio.alerta.factura-vencida` | Factura vencida | Overdue invoice | derive.ts:1027 |
| `inicio.alerta.factura-por-vencer` | Factura por vencer | Invoice due soon | derive.ts:1027 |
| `inicio.alerta.factura` | Factura | Invoice | derive.ts:1027, derive.ts:1028 |
| `inicio.alerta.pausa-legal` | Pantalla en pausa legal | Screen under legal restriction | derive.ts:1040 |
| `inicio.alerta.incidencia` | Sitio bloqueado por incidencia | Site blocked by an incident | derive.ts:1054 |
| `inicio.incidencia.clima` | clima | weather | derive.ts:370 |
| `inicio.incidencia.mantenimiento` | mantenimiento | maintenance | derive.ts:371 |
| `inicio.incidencia.legal` | legal | legal issue | derive.ts:372 |
| `inicio.incidencia.vandalismo` | vandalismo | vandalism | derive.ts:373 |
| `inicio.incidencia.suspension-operativa` | suspension_operativa | operational suspension | derive.ts:374 |
| `inicio.incidencia.accidente` | accidente | accident | derive.ts:375 |
| `inicio.incidencia.otro` | otro | other | derive.ts:376, derive.ts:1056 |
| `inicio.alerta.ot-vencida` | OT vencida | Overdue work order | derive.ts:1079 |
| `inicio.alerta.ot-por-vencer` | OT por vencer | Work order due soon | derive.ts:1079 |
| `inicio.alerta.ot-sin-sitio` | sin sitio | no site | derive.ts:1087 |
| `inicio.alerta.ot-vencio.uno` | {folio} · {sitio} — venció hace {n} día(s){sinAsignar} | {folio} · {sitio} — {n} day overdue{sinAsignar} | derive.ts:1083 |
| `inicio.alerta.ot-vencio.otros` | {folio} · {sitio} — venció hace {n} día(s){sinAsignar} | {folio} · {sitio} — {n} days overdue{sinAsignar} | derive.ts:1083 |
| `inicio.alerta.ot-vence.uno` | {folio} · {sitio} — vence en {n} día(s){sinAsignar} | {folio} · {sitio} — due in {n} day{sinAsignar} | derive.ts:1084 |
| `inicio.alerta.ot-vence.otros` | {folio} · {sitio} — vence en {n} día(s){sinAsignar} | {folio} · {sitio} — due in {n} days{sinAsignar} | derive.ts:1084 |
| `inicio.alerta.ot-sin-asignar` |  · sin asignar |  · unassigned | derive.ts:1089 |

### `textos/energia.ts` (121 claves)

| clave | español | inglés | dónde |
|---|---|---|---|
| `energia.descripcion` | Un recibo por predio y por mes. Se reparte entre sus pantallas igual que la renta. | One bill per property per month. It is split among its screens the same way as the rent. | page.tsx:168 |
| `energia.error.cargar` | No se pudo cargar la captura de consumos | Could not load the consumption entries | page.tsx:91 |
| `energia.error.contactar` | No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar. | Could not reach the server. Check your connection and try again. | page.tsx:99, SubirRecibos.tsx:109 |
| `energia.error.guardar-recibo` | No se pudo guardar el recibo | Could not save the bill | page.tsx:134, FormularioRecibo.tsx:83 |
| `energia.error.borrar-recibo` | No se pudo borrar el recibo | Could not delete the bill | page.tsx:149 |
| `energia.capturar` | Capturar un recibo | Enter a bill | page.tsx:210 |
| `energia.cargando-puntos` | Cargando los puntos de medición… | Loading the metering points… | page.tsx:223 |
| `energia.sin-donde-abajo` | No hay dónde capturar todavía: el motivo está abajo. | There is nowhere to enter bills yet: the reason is below. | page.tsx:224 |
| `energia.cobertura.titulo` | Qué está capturado y qué falta | What’s entered and what’s missing | page.tsx:244 |
| `energia.meses.uno` | {n} mes | {n} month | page.tsx:250 |
| `energia.meses.otros` | {n} meses | {n} months | page.tsx:250 |
| `energia.puntos.uno` | {n} punto | {n} metering point | page.tsx:251 |
| `energia.puntos.otros` | {n} puntos | {n} metering points | page.tsx:251 |
| `energia.resumen` | {meses} · {puntos} | {meses} · {puntos} | page.tsx:249 |
| `energia.vacio.error` | No se pudo cargar la captura | Could not load the entries | page.tsx:303 |
| `energia.vacio.periodo` | Revisa el periodo | Check the period | page.tsx:305 |
| `energia.vacio.sin-puntos` | Todavía no hay dónde capturar | Nowhere to enter bills yet | page.tsx:312, page.tsx:313 |
| `energia.vacio.sin-puntos-detalle` | Un recibo de luz cuelga de un predio con pantallas, o de una pantalla sin predio. Da de alta el inventario y esta pantalla se llena sola. | An electricity bill belongs to a property with screens, or to a screen with no property. Set up the inventory and this page fills itself in. | page.tsx:313 |
| `energia.kpi.capturados` | Recibos capturados | Bills entered | IndicadoresEnergia.tsx:35, IndicadoresEnergia.tsx:62 |
| `energia.kpi.no-cargar` | no se pudo cargar | could not be loaded | IndicadoresEnergia.tsx:35, IndicadoresEnergia.tsx:36, IndicadoresEnergia.tsx:37 |
| `energia.kpi.faltan` | Faltan | Missing | IndicadoresEnergia.tsx:36, IndicadoresEnergia.tsx:67 |
| `energia.kpi.importe` | Importe del periodo | Period amount | IndicadoresEnergia.tsx:37, IndicadoresEnergia.tsx:73 |
| `energia.kpi.kwh` | kWh del periodo | Period kWh | IndicadoresEnergia.tsx:38, IndicadoresEnergia.tsx:82 |
| `energia.kpi.de` | {a} de {b} | {a} of {b} | IndicadoresEnergia.tsx:63, IndicadoresEnergia.tsx:64 |
| `energia.kpi.del-periodo` | del periodo | in the period | IndicadoresEnergia.tsx:64 |
| `energia.kpi.menos-luz` | el reporte enseña menos luz de la real | the report shows less electricity than the real figure | IndicadoresEnergia.tsx:69 |
| `energia.kpi.completa` | captura completa | all entered | IndicadoresEnergia.tsx:69 |
| `energia.kpi.solo-capturado` | solo lo capturado | entered only | IndicadoresEnergia.tsx:78, IndicadoresEnergia.tsx:84 |
| `energia.kpi.sin-pantalla.uno` | solo lo capturado · {n} recibo sin pantalla | entered only · {n} bill with no screen | IndicadoresEnergia.tsx:77 |
| `energia.kpi.sin-pantalla.otros` | solo lo capturado · {n} recibos sin pantalla | entered only · {n} bills with no screen | IndicadoresEnergia.tsx:77 |
| `energia.predio-o-pantalla` | Predio o pantalla | Property or screen | FormularioRecibo.tsx:99, RejillaCaptura.tsx:57, SubirRecibos.tsx:280 |
| `energia.opcion.pantallas.uno` |  · {n} pantalla |  · {n} screen | FormularioRecibo.tsx:112 |
| `energia.opcion.pantallas.otros` |  · {n} pantallas |  · {n} screens | FormularioRecibo.tsx:112 |
| `energia.opcion.suelta` |  · pantalla suelta |  · standalone screen | FormularioRecibo.tsx:113 |
| `energia.mes-recibo` | Mes del recibo | Bill month | FormularioRecibo.tsx:119 |
| `energia.medidor` | Medidor | Meter | FormularioRecibo.tsx:126 |
| `energia.importe` | Importe | Amount | FormularioRecibo.tsx:147, SubirRecibos.tsx:284 |
| `energia.guardar-recibo` | Guardar recibo | Save bill | FormularioRecibo.tsx:163 |
| `energia.rejilla.faltan` | Faltan | Missing | RejillaCaptura.tsx:63 |
| `energia.rejilla.pantallas.uno` | {n} pantalla | {n} screen | RejillaCaptura.tsx:73 |
| `energia.rejilla.pantallas.otros` | {n} pantallas | {n} screens | RejillaCaptura.tsx:73 |
| `energia.rejilla.suelta` | Pantalla suelta | Standalone screen | RejillaCaptura.tsx:74 |
| `energia.rejilla.hueco` | Sin recibo capturado: no es un consumo de cero, es un dato que falta | No bill entered: this is not zero consumption, it is missing data | RejillaCaptura.tsx:90 |
| `energia.rejilla.borrar-este` | Borrar este recibo | Delete this bill | RejillaCaptura.tsx:111, RejillaCaptura.tsx:139 |
| `energia.rejilla.borrar-aria` | Borrar el recibo del medidor {medidor} | Delete the bill for meter {medidor} | RejillaCaptura.tsx:112 |
| `energia.rejilla.borrar` | Borrar el recibo | Delete the bill | RejillaCaptura.tsx:111, RejillaCaptura.tsx:112, RejillaCaptura.tsx:139 |
| `energia.sin-numero` | sin número | (no number) | RejillaCaptura.tsx:112, RejillaCaptura.tsx:115, captura.ts:397 |
| `energia.subir.error-leer` | No se pudieron leer los archivos | Could not read the files | SubirRecibos.tsx:101 |
| `energia.subir.no-guardar` | No se pudo guardar | Could not save | SubirRecibos.tsx:133 |
| `energia.subir.no-contactar` | No se pudo contactar al servidor | Could not reach the server | SubirRecibos.tsx:139 |
| `energia.subir.pregunta` | 1 · ¿Cuántos meses de calendario cubre cada recibo de esta tanda? | 1 · How many calendar months does each bill in this batch cover? | SubirRecibos.tsx:167 |
| `energia.subir.elige-antes` | — elige antes de subir — | — choose before uploading — | SubirRecibos.tsx:175 |
| `energia.subir.opcion.1` | 1 mes de calendario — un periodo corto, dentro de un solo mes | 1 calendar month — a short period, within a single month | SubirRecibos.tsx:178 |
| `energia.subir.opcion.2` | 2 meses de calendario — lo normal en un recibo MENSUAL | 2 calendar months — the usual for a MONTHLY bill | SubirRecibos.tsx:178 |
| `energia.subir.opcion.3` | 3 meses de calendario — lo normal en un recibo BIMESTRAL | 3 calendar months — the usual for a bill issued EVERY TWO MONTHS | SubirRecibos.tsx:178 |
| `energia.subir.opcion.4` | 4 meses de calendario — un periodo largo o atrasado | 4 calendar months — a long or late period | SubirRecibos.tsx:178 |
| `energia.subir.explica` | Se cuentan los meses de calendario que {toca} el periodo, no lo que dura. Un recibo mensual empieza a mitad de mes, así que casi siempre toca {dos}; uno bimestral, {tres}. Si mezclas mensuales y bimestrales en la misma tanda, muchos saldrán marcados: súbelos por separado. | Count the calendar months the period {toca}, not how long it lasts. A monthly bill starts mid-month, so it almost always touches {dos}; one issued every two months, {tres}. If you mix monthly bills and bills issued every two months in the same batch, many will be flagged: upload them separately. | SubirRecibos.tsx:183 |
| `energia.subir.toca` | toca | touches | SubirRecibos.tsx:184 |
| `energia.subir.dos` | dos | two | SubirRecibos.tsx:185 |
| `energia.subir.tres` | tres | three | SubirRecibos.tsx:186 |
| `energia.subir.leyendo` | Leyendo… | Reading… | SubirRecibos.tsx:206 |
| `energia.subir.subir` | 2 · Subir PDF del recibo | 2 · Upload the bill PDF | SubirRecibos.tsx:206 |
| `energia.subir.elige-arriba` | Elige arriba cuántos meses esperas antes de subir los archivos. | Choose above how many months you expect before uploading the files. | SubirRecibos.tsx:228 |
| `energia.subir.se-leen` | Se leen en el servidor y no se guarda nada: revisa cada renglón contra el recibo y confírmalo. | They are read on the server and nothing is saved: check each row against the bill and confirm it. | SubirRecibos.tsx:229 |
| `energia.subir.col.mes` | Mes | Month | SubirRecibos.tsx:281 |
| `energia.subir.col.dias` | Días | Days | SubirRecibos.tsx:282 |
| `energia.subir.elige` | — elige — | — choose — | SubirRecibos.tsx:175, SubirRecibos.tsx:228, SubirRecibos.tsx:304 |
| `energia.subir.escribelo` | escríbelo | type it | SubirRecibos.tsx:325, SubirRecibos.tsx:335 |
| `energia.subir.guardado` | Guardado | Saved | SubirRecibos.tsx:343 |
| `energia.subir.guardando` | Guardando… | Saving… | SubirRecibos.tsx:351 |
| `energia.subir.guardar` | Guardar | Save | SubirRecibos.tsx:351 |
| `energia.subir.declaraste.uno` | Declaraste {n} mes y este recibo cubre {pdf}. Se repartió según el PDF. | You declared {n} month and this bill covers {pdf}. It was split according to the PDF. | SubirRecibos.tsx:363 |
| `energia.subir.declaraste.otros` | Declaraste {n} meses y este recibo cubre {pdf}. Se repartió según el PDF. | You declared {n} months and this bill covers {pdf}. It was split according to the PDF. | SubirRecibos.tsx:363 |
| `energia.subir.ya-capturado` | Ya hay uno capturado en {mes}: {kwh} kWh por {monto}. Guardar otra vez DUPLICA el costo de ese mes. | One is already entered for {mes}: {kwh} kWh for {monto}. Saving again DOUBLES that month’s cost. | SubirRecibos.tsx:371 |
| `energia.motivo.falta-inicio` | Falta el mes de inicio | The start month is missing | captura.ts:104, captura.ts:288, captura.ts:290 |
| `energia.motivo.falta-fin` | Falta el mes de fin | The end month is missing | captura.ts:105, captura.ts:288, captura.ts:290 |
| `energia.motivo.formato` | Usa fechas con formato AAAA-MM-DD | Use dates in YYYY-MM-DD format | captura.ts:106, captura.ts:108, captura.ts:288 |
| `energia.motivo.orden` | El mes de fin no puede ser anterior al de inicio | The end month cannot be before the start month | captura.ts:112, captura.ts:288, captura.ts:290 |
| `energia.motivo.punto` | Elige a qué predio o pantalla corresponde el recibo | Choose which property or screen the bill belongs to | captura.ts:288, captura.ts:290, captura.ts:305 |
| `energia.motivo.mes` | Elige el mes del recibo | Choose the bill month | captura.ts:288, captura.ts:290, captura.ts:305 |
| `energia.motivo.kwh.falta` | Captura los kWh del recibo | Enter the bill’s kWh | (por plantilla de clave) |
| `energia.motivo.importe.falta` | Captura el importe del recibo | Enter the bill amount | (por plantilla de clave) |
| `energia.motivo.kwh.numero` | los kWh tiene que ser un número | The kWh must be a number | (por plantilla de clave) |
| `energia.motivo.importe.numero` | el importe tiene que ser un número | The amount must be a number | (por plantilla de clave) |
| `energia.motivo.kwh.mayor` | los kWh tiene que ser mayor que cero | The kWh must be greater than zero | (por plantilla de clave) |
| `energia.motivo.importe.mayor` | el importe tiene que ser mayor que cero | The amount must be greater than zero | (por plantilla de clave) |
| `energia.motivo.futuro` | Ese mes todavía no ha terminado: no puede haber recibo | That month hasn’t ended yet: there can’t be a bill for it | captura.ts:288, captura.ts:290, captura.ts:305 |
| `energia.cobertura.huerfanos.uno` | {n} recibo capturado por {monto} no llega a ninguna pantalla, porque su predio no tiene ninguna dada de alta. Ese dinero no aparece en el reporte de rentabilidad. | {n} entered bill for {monto} doesn’t reach any screen, because its property has none set up. That money does not appear in the profitability report. | captura.ts:209 |
| `energia.cobertura.huerfanos.otros` | {n} recibos capturados por {monto} no llegan a ninguna pantalla, porque su predio no tiene ninguna dada de alta. Ese dinero no aparece en el reporte de rentabilidad. | {n} entered bills for {monto} don’t reach any screen, because their property has none set up. That money does not appear in the profitability report. | captura.ts:209 |
| `energia.cobertura.sin-puntos` | Todavía no hay dónde capturar recibos: hace falta al menos un predio con pantallas, o una pantalla sin predio. | There is nowhere to enter bills yet: you need at least one property with screens, or a screen with no property. | captura.ts:222 |
| `energia.cobertura.completa.uno` | Captura completa: están los {n} recibos del periodo. El costo de la luz del reporte de rentabilidad es el total de verdad. | All entered: the period’s {n} bill is in. The electricity cost in the profitability report is the real total. | captura.ts:234 |
| `energia.cobertura.completa.otros` | Captura completa: están los {n} recibos del periodo. El costo de la luz del reporte de rentabilidad es el total de verdad. | All entered: all {n} bills for the period are in. The electricity cost in the profitability report is the real total. | captura.ts:234 |
| `energia.cobertura.faltan` | Faltan {faltan} de {esperados} recibos del periodo. Mientras falten, el reporte de rentabilidad suma solo lo capturado y enseña un costo de luz MENOR del real, sin avisar de nada: un mes sin recibo no es un mes sin consumo. | {faltan} of {esperados} bills for the period are missing. Until they are entered, the profitability report adds up only what has been entered and shows an electricity cost LOWER than the real one, with no warning: a month with no bill is not a month with no consumption. | captura.ts:246 |
| `energia.borrado.confirmacion` | Se borra el recibo del medidor {medidor}, de {mes}, por {monto}. No se puede deshacer: ese mes vuelve a contar como un hueco, y hasta que lo captures otra vez el reporte de rentabilidad enseñará un costo de luz menor del real. | This deletes the bill for meter {medidor}, for {mes}, for {monto}. It cannot be undone: that month counts as a gap again, and until you enter it again the profitability report will show an electricity cost lower than the real one. | captura.ts:401 |
| `energia.lectura.punto` | Elige a qué predio o pantalla corresponde este recibo | Choose which property or screen this bill belongs to | recibos.ts:208, recibos.ts:218 |
| `energia.lectura.kwh.falta` | Escribe los kWh: no se pudieron leer del PDF | Enter the kWh: they could not be read from the PDF | (por plantilla de clave) |
| `energia.lectura.importe.falta` | Escribe el importe: no se pudieron leer del PDF | Enter the amount: it could not be read from the PDF | (por plantilla de clave) |
| `energia.lectura.no-recibo.uno` | {n} archivo no es un recibo de CFE | {n} file is not a CFE bill | recibos.ts:270 |
| `energia.lectura.no-recibo.otros` | {n} archivos no son un recibo de CFE | {n} files are not CFE bills | recibos.ts:270 |
| `energia.lectura.desajuste.uno` | {n} no coincide con los {esperados} meses que declaraste | {n} doesn’t match the number of months you declared ({esperados}) | recibos.ts:330 |
| `energia.lectura.desajuste.otros` | {n} no coinciden con los {esperados} meses que declaraste | {n} don’t match the number of months you declared ({esperados}) | recibos.ts:330 |
| `energia.lectura.cubre.uno` | {base}: cubre {unico} meses de calendario | {base}: the number of calendar months it covers is {unico} | recibos.ts:339 |
| `energia.lectura.cubre.otros` | {base}: los {n} cubren {unico} meses de calendario | {base}: the number of calendar months covered by those {n} is {unico} | recibos.ts:339 |
| `energia.lectura.sin-predio` | {n} sin predio: eligelo tú | {n} with no property: choose it yourself | recibos.ts:218, recibos.ts:276 |
| `energia.lectura.sin-cifra` | {n} con una cifra que no se pudo leer | {n} with a figure that could not be read | recibos.ts:218, recibos.ts:277 |
| `energia.lectura.repetidos` | {n} ya capturados: volver a guardarlos DUPLICA el costo | {n} already entered: saving them again DOUBLES the cost | recibos.ts:218, recibos.ts:278 |
| `energia.lectura.alerta` | Se leyeron {leidos} de {total} archivos y salen {filas} renglones. Revisa antes de confirmar: {pegas}. | Files read: {leidos} of {total}; rows: {filas}. Check before confirming: {pegas}. | recibos.ts:218, recibos.ts:287 |
| `energia.lectura.ninguno` | No salió ningún renglón de estos archivos. | These files produced no rows. | recibos.ts:218, recibos.ts:293 |
| `energia.lectura.ok.uno` | Se leyeron los {total} {archivos} y salen {filas} {renglones}. Míralos contra el recibo y confírmalos: nada se guarda hasta que le des a guardar. | {total} {archivos} was read and it produces {filas} {renglones}. Check them against the bill and confirm them: nothing is saved until you click save. | recibos.ts:302 |
| `energia.lectura.ok.otros` | Se leyeron los {total} {archivos} y salen {filas} {renglones}. Míralos contra el recibo y confírmalos: nada se guarda hasta que le des a guardar. | {total} {archivos} were read and they produce {filas} {renglones}. Check them against the bill and confirm them: nothing is saved until you click save. | recibos.ts:302 |
| `energia.lectura.archivo.uno` | archivo | file | recibos.ts:305 |
| `energia.lectura.archivo.otros` | archivos | files | recibos.ts:305 |
| `energia.lectura.renglon.uno` | renglón | row | recibos.ts:307 |
| `energia.lectura.renglon.otros` | renglones | rows | recibos.ts:307 |
| `energia.leido.servicio` | servicio {n} | service {n} | recibos.ts:354 |
| `energia.leido.medidor` | medidor {n} | meter {n} | recibos.ts:355 |
| `energia.leido.periodo` | periodo {desde} → {hasta} | period {desde} → {hasta} | recibos.ts:357 |
| `energia.leido.pdf-dice` | el PDF dice {kwh} kWh | the PDF says {kwh} kWh | recibos.ts:360 |
| `energia.leido.facturacion` | facturación {monto} | period charges {monto} | recibos.ts:362 |
| `energia.leido.alumbrado` | alumbrado {monto} | street lighting {monto} | recibos.ts:363 |
| `energia.leido.total` | Total del recibo {monto} (incluye adeudos y pagos) | Bill total {monto} (includes past-due balances and payments) | recibos.ts:368 |
