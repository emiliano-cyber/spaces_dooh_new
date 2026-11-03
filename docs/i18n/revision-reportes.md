# Tabla de revisión · lote de inglés «reportes» (3.ª oleada)

Generada el 2026-11-02 en la rama `feat/ingles-reportes` (sale de
`integra/ingles` en `00815aa3`), leyendo `apps/web/lib/i18n/textos/reportes.ts`
y los usos en el código (búsqueda literal de la clave; las de plural y las de
variante se arman con un hueco y llevan su línea). **148 claves.**

- **español** es la copia literal de lo que ya decía la pantalla o el motor; no
  se tocó ni una letra. Lo comprueban:
  - el HTML de los **16 estados** de `lib/i18n/pantallas-reportes.test.ts`,
    volcado con `I18N_VOLCAR` con los componentes de `00815aa3` y con los de la
    rama: `diff -rq` vacío;
  - las **seis notas del motor** (`lib/data/reportes.ts`), comparadas contra el
    motor de `00815aa3` en **5225 combinaciones** de sus números: mismo texto;
  - `lib/i18n/textos/reportes.test.ts`, que ata el diccionario a los catálogos
    españoles de `consulta.ts` y `tabla.ts` (dimensiones, granularidades,
    columnas, primera columna, desglose, `cuenta`), al aviso del margen bruto, a
    las dos convenciones del m², al tope de 24 meses y a las dos filas que añade
    el motor.
- Ninguna clave lleva cifras de dinero: los importes entran por hueco ya
  formateados con el idioma (`MX$` en inglés en una instancia MXN). El ejemplo
  de la nota de operación («una herrería de $12,000 que una de $800») pasó a
  huecos por eso (GUARDIA 2 de `dinero.test.ts`).
- Lo que el SERVIDOR manda (las notas, la etiqueta de cada periodo, las filas
  «Sin asignar» y «Sin vendedor») sigue en español; la pantalla en inglés lo
  rearma desde los números y las claves estables que viajan con ello.

## Las claves (`textos/reportes.ts`)

| clave | español | inglés | dónde |
|---|---|---|---|
| `reportes.titulo` | Reportes de rentabilidad | Profitability reports | app/(app)/(shell)/reportes/page.tsx:227 |
| `reportes.subtitulo` | Qué ingresa y qué cuesta cada pantalla en el periodo que elijas. | What each screen brings in and what it costs in the period you choose. | app/(app)/(shell)/reportes/page.tsx:229 |
| `reportes.indicadores` | Indicadores del periodo | Period indicators | app/(app)/(shell)/reportes/page.tsx:247 |
| `reportes.kpi.ingreso` | Ingreso del periodo | Period revenue | app/(app)/(shell)/reportes/page.tsx:258 |
| `reportes.kpi.costo-sub` | Espacio {espacio} · Operación {operacion} · Luz {luz} | Space {espacio} · Operations {operacion} · Electricity {luz} | app/(app)/(shell)/reportes/page.tsx:277 |
| `reportes.kpi.margen` | Margen sobre ingreso | Margin on revenue | app/(app)/(shell)/reportes/page.tsx:285 |
| `reportes.kpi.margen-sub` | Margen {monto} | Margin {monto} | app/(app)/(shell)/reportes/page.tsx:287 |
| `reportes.rango` | Del {desde} al {hasta} | {desde} to {hasta} | app/(app)/(shell)/reportes/page.tsx:308, components/demo/reportes/TablaRentabilidad.tsx:318 |
| `reportes.resultado` | Resultado | Result | app/(app)/(shell)/reportes/page.tsx:309 |
| `reportes.periodos` | {n} {periodos} | {n} {periodos} | app/(app)/(shell)/reportes/page.tsx:317 |
| `reportes.periodos.palabra.uno` | periodo | period | app/(app)/(shell)/reportes/page.tsx:319 |
| `reportes.periodos.palabra.otros` | periodos | periods | app/(app)/(shell)/reportes/page.tsx:319 |
| `reportes.error.titulo` | No se pudo calcular el reporte | Could not calculate the report | app/(app)/(shell)/reportes/page.tsx:334 |
| `reportes.error.sin-mensaje` | No se pudo calcular el reporte. La petición no llegó a buen término. | Could not calculate the report. The request did not go through. | components/demo/reportes/estado.ts:103 |
| `reportes.error.red` | No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar. | Could not reach the server. Check your connection and try again. | components/demo/reportes/estado.ts:103 |
| `reportes.invalido.titulo` | Revisa el periodo | Check the period | app/(app)/(shell)/reportes/page.tsx:338 |
| `reportes.vacio.titulo` | Sin movimiento en este periodo | No activity in this period | app/(app)/(shell)/reportes/page.tsx:345 |
| `reportes.vacio.detalle` | Entre el {desde} y el {hasta} ninguna pantalla registró ingreso, renta ni órdenes de trabajo. Una pantalla sin nada de eso no aparece en el reporte; prueba con un rango más amplio. | Between {desde} and {hasta} no screen recorded revenue, rent or work orders. A screen with none of that does not appear in the report; try a wider range. | app/(app)/(shell)/reportes/page.tsx:346 |
| `reportes.notas` | Notas sobre estas cifras ({n}) | Notes on these figures ({n}) | app/(app)/(shell)/reportes/page.tsx:395 |
| `reportes.inicial.titulo` | Elige un periodo | Choose a period | app/(app)/(shell)/reportes/page.tsx:414 |
| `reportes.inicial.detalle` | El reporte se calcula al elegir las fechas. | The report is calculated when you choose the dates. | app/(app)/(shell)/reportes/page.tsx:414 |
| `reportes.filtro.agrupar` | Agrupar | Group by | components/demo/reportes/FiltrosRentabilidad.tsx:52 |
| `reportes.filtro.desde` | Desde | From | components/demo/reportes/FiltrosRentabilidad.tsx:73 |
| `reportes.filtro.hasta` | Hasta | To | components/demo/reportes/FiltrosRentabilidad.tsx:83 |
| `reportes.filtro.periodos` | Periodos | Periods | components/demo/reportes/FiltrosRentabilidad.tsx:93 |
| `reportes.dim.sitio` | Por pantalla | By screen | components/demo/reportes/consulta.ts:141 |
| `reportes.dim.sitio.ayuda` | Ingreso y las tres fuentes de costo de cada pantalla —espacio, operación y luz—. Peor margen primero. | Revenue and the three cost sources of each screen —space, operations and electricity—. Worst margin first. | components/demo/reportes/consulta.ts:141 |
| `reportes.dim.trimestre` | Por trimestre | By quarter | components/demo/reportes/consulta.ts:142 |
| `reportes.dim.trimestre.ayuda` | Cómo evoluciona el negocio: una fila por trimestre natural, en orden cronológico. | How the business is evolving: one row per calendar quarter, in chronological order. | components/demo/reportes/consulta.ts:142 |
| `reportes.dim.operacion` | Por operación | By operations | components/demo/reportes/consulta.ts:143 |
| `reportes.dim.operacion.ayuda` | Dónde se va el dinero en visitas: órdenes de trabajo, su costo y las horas en sitio. | Where the money goes on visits: work orders, their cost and the hours on site. | components/demo/reportes/consulta.ts:143 |
| `reportes.dim.m2` | Por metro cuadrado | By square meter | components/demo/reportes/consulta.ts:144 |
| `reportes.dim.m2.ayuda` | Qué superficie estática rinde. Las digitales no entran: su denominador son spots. | Which static area pays off. Digital screens are left out: their denominator is spots. | components/demo/reportes/consulta.ts:144 |
| `reportes.dim.luz` | Por consumo de luz | By electricity consumption | components/demo/reportes/consulta.ts:145 |
| `reportes.dim.luz.ayuda` | Qué pantallas se comen la energía. El recibo del predio se reparte entre sus pantallas. | Which screens eat up the energy. The property’s bill is split among its screens. | components/demo/reportes/consulta.ts:145 |
| `reportes.dim.entidad` | Por razón social | By legal entity | components/demo/reportes/consulta.ts:146 |
| `reportes.dim.entidad.ayuda` | Cuánto factura y cuánta renta paga cada una de tus razones sociales. La operación y la luz no se reparten: no hay dato que diga de quién son. | How much each of your legal entities bills and how much rent it pays. Operations and electricity are not split: no data says whose they are. | components/demo/reportes/consulta.ts:146 |
| `reportes.dim.tarifa` | Publicada vs neta | Published vs net | components/demo/reportes/consulta.ts:147 |
| `reportes.dim.tarifa.ayuda` | Qué tarifa se publicó y qué entró de ella. Lo vendido desde Comercial no tiene tarifa publicada congelada y sale con una raya, no con un cero. | Which rate was published and how much of it came in. What was sold from Sales has no frozen published rate and shows a dash, not a zero. | components/demo/reportes/consulta.ts:147 |
| `reportes.dim.vendedor` | Por vendedor | By sales rep | components/demo/reportes/consulta.ts:148 |
| `reportes.dim.vendedor.ayuda` | Cuánto vendió cada persona y cuánto descuento concedió. El vendedor es quien crea la propuesta, y se guarda desde el 2026-09-28: lo anterior sale en «Sin vendedor» y no se puede recuperar. | How much each person sold and how much discount they granted. The sales rep is whoever creates the proposal, and it is stored since 2026-09-28: anything earlier shows under “No sales rep” and cannot be recovered. | components/demo/reportes/consulta.ts:148 |
| `reportes.gran.mes` | Mensual | Monthly | components/demo/reportes/consulta.ts:152 |
| `reportes.gran.trimestre` | Trimestral | Quarterly | components/demo/reportes/consulta.ts:153 |
| `reportes.motivo.sin-inicio` | Falta la fecha de inicio del reporte | The report start date is missing | components/demo/reportes/consulta.ts:249 |
| `reportes.motivo.sin-fin` | Falta la fecha de fin del reporte | The report end date is missing | components/demo/reportes/consulta.ts:250 |
| `reportes.motivo.formato` | Usa fechas con formato AAAA-MM-DD | Use dates in YYYY-MM-DD format | components/demo/reportes/consulta.ts:251, components/demo/reportes/consulta.ts:256 |
| `reportes.motivo.invertido` | La fecha de fin no puede ser anterior a la de inicio | The end date cannot be earlier than the start date | components/demo/reportes/consulta.ts:258 |
| `reportes.motivo.tope` | El reporte abarca como máximo 24 meses por consulta. Acorta el rango de fechas. | The report covers at most 24 months per query. Shorten the date range. | components/demo/reportes/consulta.ts:262 |
| `reportes.col.pantalla` | Pantalla | Screen | components/demo/reportes/tabla.ts:243, components/demo/reportes/tabla.ts:402, components/demo/reportes/tabla.ts:404 |
| `reportes.col.trimestre` | Trimestre | Quarter | components/demo/reportes/tabla.ts:403 |
| `reportes.col.razon-social` | Razón social | Legal name | components/demo/reportes/tabla.ts:407 |
| `reportes.col.vendedor` | Vendedor | Sales rep | components/demo/reportes/tabla.ts:409 |
| `reportes.col.ingreso` | Ingreso | Revenue | components/demo/reportes/tabla.ts:244, components/demo/reportes/tabla.ts:692 |
| `reportes.col.costo-espacio` | Costo del espacio | Space cost | components/demo/reportes/tabla.ts:245 |
| `reportes.col.costo-operacion` | Costo de operación | Operations cost | components/demo/reportes/tabla.ts:246 |
| `reportes.col.costo-luz` | Costo de la luz | Electricity cost | components/demo/reportes/tabla.ts:247 |
| `reportes.col.costo-total` | Costo total | Total cost | app/(app)/(shell)/reportes/page.tsx:275, components/demo/reportes/tabla.ts:248 |
| `reportes.col.margen-bruto` | Margen bruto | Gross margin | components/demo/reportes/tabla.ts:249, components/demo/reportes/tabla.ts:696 |
| `reportes.col.margen-bruto-pct` | Margen bruto % | Gross margin (%) | components/demo/reportes/tabla.ts:250 |
| `reportes.col.visitas` | Visitas | Visits | components/demo/reportes/tabla.ts:251, components/demo/reportes/tabla.ts:697 |
| `reportes.col.operacion-ingreso` | Operación / ingreso | Operations / revenue | components/demo/reportes/tabla.ts:252 |
| `reportes.col.horas` | Horas en sitio | Hours on site | components/demo/reportes/tabla.ts:253 |
| `reportes.col.superficie` | Superficie | Area | components/demo/reportes/tabla.ts:254 |
| `reportes.col.ingreso-m2` | Ingreso / m² | Revenue / m² | components/demo/reportes/tabla.ts:255 |
| `reportes.col.margen-m2` | Margen bruto / m² | Gross margin / m² | components/demo/reportes/tabla.ts:256 |
| `reportes.col.consumo` | Consumo | Consumption | components/demo/reportes/tabla.ts:257 |
| `reportes.col.costo-kwh` | Costo / kWh | Cost / kWh | components/demo/reportes/tabla.ts:258 |
| `reportes.col.saldo-atribuido` | Saldo atribuido | Attributed balance | components/demo/reportes/tabla.ts:259 |
| `reportes.col.pct-facturacion` | % de la facturación | % of billing | components/demo/reportes/tabla.ts:260 |
| `reportes.col.tarifa-publicada` | Tarifa publicada | Published rate | components/demo/reportes/tabla.ts:261 |
| `reportes.col.neto-comparable` | Neto comparable | Comparable net | components/demo/reportes/tabla.ts:262 |
| `reportes.col.descuento-comision` | Descuento y comisión | Discount and commission | components/demo/reportes/tabla.ts:263 |
| `reportes.col.pct-publicada` | % sobre publicada | % of published | components/demo/reportes/tabla.ts:264 |
| `reportes.desglose.periodo` | Periodo | Period | components/demo/reportes/tabla.ts:691 |
| `reportes.desglose.espacio` | Espacio | Space | components/demo/reportes/tabla.ts:693 |
| `reportes.desglose.operacion` | Operación | Operations | components/demo/reportes/tabla.ts:694 |
| `reportes.desglose.luz` | Luz | Electricity | components/demo/reportes/tabla.ts:695 |
| `reportes.tabla.total` | Total ({n}) | Total ({n}) | components/demo/reportes/TablaRentabilidad.tsx:167 |
| `reportes.tabla.desglose.ocultar` | Ocultar el desglose por periodo | Hide the breakdown by period | components/demo/reportes/TablaRentabilidad.tsx:227 |
| `reportes.tabla.desglose.ver` | Ver el desglose por periodo | Show the breakdown by period | components/demo/reportes/TablaRentabilidad.tsx:227 |
| `reportes.tabla.raya.margen-pct` | Sin ingreso en el rango: no hay porcentaje que calcular | No revenue in the range: there is no percentage to calculate | components/demo/reportes/TablaRentabilidad.tsx:67 |
| `reportes.tabla.raya.operacion-pct` | Sin ingreso en el rango: no hay proporción que calcular | No revenue in the range: there is no ratio to calculate | components/demo/reportes/TablaRentabilidad.tsx:68 |
| `reportes.tabla.raya.horas` | Ninguna visita del rango tiene registradas sus dos marcas de tiempo | No visit in the range has both of its timestamps recorded | components/demo/reportes/TablaRentabilidad.tsx:69 |
| `reportes.tabla.horas-de` | de {n} {visitas} | of {n} {visitas} | components/demo/reportes/TablaRentabilidad.tsx:278 |
| `reportes.tabla.visitas.uno` | visita | visit | components/demo/reportes/TablaRentabilidad.tsx:280 |
| `reportes.tabla.visitas.otros` | visitas | visits | components/demo/reportes/TablaRentabilidad.tsx:280 |
| `reportes.tabla.propia` | propia | owned | components/demo/reportes/tabla.ts:508 |
| `reportes.tabla.sin-contrato` | sin contrato | no contract | components/demo/reportes/tabla.ts:510 |
| `reportes.fila.sin-asignar` | Sin asignar | Unassigned | components/demo/reportes/tabla.ts:740 |
| `reportes.fila.sin-asignar.detalle` | Sin razón social en el dato de origen | No legal entity in the source data | components/demo/reportes/tabla.ts:741 |
| `reportes.fila.sin-vendedor` | Sin vendedor | No sales rep | components/demo/reportes/tabla.ts:746 |
| `reportes.fila.sin-vendedor.detalle` | Campañas de Comercial y propuestas anteriores al 2026-09-28 | Campaigns from Sales and proposals before 2026-09-28 | components/demo/reportes/tabla.ts:747 |
| `reportes.cuenta.pantalla.uno` | {n} pantalla | {n} screen |components/demo/reportes/consulta.ts:199 (`claveCuenta`, en ingles) |
| `reportes.cuenta.pantalla.otros` | {n} pantallas | {n} screens |components/demo/reportes/consulta.ts:199 (`claveCuenta`, en ingles) |
| `reportes.cuenta.trimestre.uno` | {n} trimestre | {n} quarter |components/demo/reportes/consulta.ts:199 (`claveCuenta`, en ingles) |
| `reportes.cuenta.trimestre.otros` | {n} trimestres | {n} quarters |components/demo/reportes/consulta.ts:199 (`claveCuenta`, en ingles) |
| `reportes.cuenta.razon-social.uno` | {n} razón social | {n} legal entity |components/demo/reportes/consulta.ts:199 (`claveCuenta`, en ingles) |
| `reportes.cuenta.razon-social.otros` | {n} razones sociales | {n} legal entities |components/demo/reportes/consulta.ts:199 (`claveCuenta`, en ingles) |
| `reportes.cuenta.vendedor.uno` | {n} vendedor | {n} sales rep |components/demo/reportes/consulta.ts:199 (`claveCuenta`, en ingles) |
| `reportes.cuenta.vendedor.otros` | {n} vendedores | {n} sales reps |components/demo/reportes/consulta.ts:199 (`claveCuenta`, en ingles) |
| `reportes.con-movimiento` | {cuenta} con movimiento | {cuenta} with activity | components/demo/reportes/tabla.ts:533 |
| `reportes.aviso.en-curso.uno` | El periodo que estás viendo toca {etiqueta}, que está EN CURSO: llevan {corridos} de sus {totales} días. La renta de los espacios ya corrió esos {corridos} días completos, pero lo que se vendió se cobra al cerrar, así que el ingreso todavía no está dentro y el margen sale peor de lo que va a quedar. No lo compares con un trimestre terminado. | The period you are viewing touches {etiqueta}, which is IN PROGRESS: {corridos} of its {totales} days has gone by. Space rent has already run for that {corridos} full day, but what was sold is billed at the close, so the revenue is not in yet and the margin looks worse than it will end up. Do not compare it with a finished quarter. | components/demo/reportes/tabla.ts:945 |
| `reportes.aviso.en-curso.otros` | El periodo que estás viendo toca {etiqueta}, que está EN CURSO: llevan {corridos} de sus {totales} días. La renta de los espacios ya corrió esos {corridos} días completos, pero lo que se vendió se cobra al cerrar, así que el ingreso todavía no está dentro y el margen sale peor de lo que va a quedar. No lo compares con un trimestre terminado. | The period you are viewing touches {etiqueta}, which is IN PROGRESS: {corridos} of its {totales} days have gone by. Space rent has already run for those {corridos} full days, but what was sold is billed at the close, so the revenue is not in yet and the margin looks worse than it will end up. Do not compare it with a finished quarter. | components/demo/reportes/tabla.ts:945 |
| `reportes.aviso.margen-bruto` | El margen de este reporte es BRUTO: es el ingreso menos los costos DIRECTOS de la pantalla —el espacio, la operación y la luz—. NO es el margen neto, y no se llega a él restando nada de lo que hay en esta tabla: al neto le faltarían los costos indirectos (nómina, oficina, estructura) y este sistema no captura ninguno. Mientras no se capturen, el margen neto del negocio no se puede calcular aquí y no es que esté escondido en otra pantalla. | The margin in this report is GROSS: it is revenue minus the screen’s DIRECT costs —space, operations and electricity—. It is NOT the net margin, and you do not get to it by subtracting anything in this table: the net would be missing the indirect costs (payroll, office, overhead) and this system records none of them. Until they are recorded, the business’s net margin cannot be calculated here, and it is not hidden on another screen either. | components/demo/reportes/tabla.ts:1077 |
| `reportes.aviso.m2.todas-las-caras` | La superficie suma TODAS las caras de cada pantalla: una de dos caras de 3 × 6 cuenta 36 m², no 18. Es la superficie que se vende, y cada pantalla aporta la de sus propias caras. | The area adds up ALL the faces of each screen: a two-faced 3 × 6 screen counts as 36 m², not 18. It is the area that is sold, and each screen contributes that of its own faces. | components/demo/reportes/tabla.ts:863 |
| `reportes.aviso.m2.una-cara` | La superficie es la de UNA cara: una pantalla de dos caras de 3 × 6 cuenta 18 m², no 36. Mide la superficie del soporte y no la que se vende, así que las pantallas de varias caras salen mejor situadas que si se contaran todas. | The area is that of ONE face: a two-faced 3 × 6 screen counts as 18 m², not 36. It measures the structure’s area and not the area that is sold, so screens with several faces rank better than if all of them were counted. | components/demo/reportes/tabla.ts:864 |
| `reportes.aviso.sin-contrato.uno` | {cuenta} no tiene contrato de arrendamiento en el periodo: su costo del espacio sale en cero porque falta el dato, no porque sea gratis, y su margen se lee mejor de lo que es. | {cuenta} has no lease contract in the period: its space cost shows as zero because the data is missing, not because it is free, and its margin reads better than it is. | components/demo/reportes/tabla.ts:1118 |
| `reportes.aviso.sin-contrato.otros` | {cuenta} no tienen contrato de arrendamiento en el periodo: su costo del espacio sale en cero porque falta el dato, no porque sea gratis, y su margen se lee mejor de lo que es. | {cuenta} have no lease contract in the period: their space cost shows as zero because the data is missing, not because it is free, and their margin reads better than it is. | components/demo/reportes/tabla.ts:1118 |
| `reportes.aviso.sin-ingreso.trimestre.uno` | {cuenta} sin ingreso en el rango. Aparece en cero a propósito: en una serie de tiempo un hueco se lee como «faltan datos» y un cero se lee como «no pasó nada». | {cuenta} with no revenue in the range. It shows as zero on purpose: in a time series a gap reads as “data is missing” and a zero reads as “nothing happened”. | components/demo/reportes/tabla.ts:1140 |
| `reportes.aviso.sin-ingreso.trimestre.otros` | {cuenta} sin ingreso en el rango. Aparecen en cero a propósito: en una serie de tiempo un hueco se lee como «faltan datos» y un cero se lee como «no pasó nada». | {cuenta} with no revenue in the range. They show as zero on purpose: in a time series a gap reads as “data is missing” and a zero reads as “nothing happened”. | components/demo/reportes/tabla.ts:1140 |
| `reportes.aviso.sin-ingreso.uno` | {cuenta} costó sin vender nada en el periodo, así que no tiene margen porcentual (la columna sale con «—»). | {cuenta} cost money without selling anything in the period, so it has no percentage margin (the column shows “—”). | components/demo/reportes/tabla.ts:1140, components/demo/reportes/tabla.ts:1146 |
| `reportes.aviso.sin-ingreso.otros` | {cuenta} costaron sin vender nada en el periodo, así que no tienen margen porcentual (la columna sale con «—»). | {cuenta} cost money without selling anything in the period, so they have no percentage margin (the column shows “—”). | components/demo/reportes/tabla.ts:1140, components/demo/reportes/tabla.ts:1146 |
| `reportes.nota.ot.sin-visitas` | No hubo ninguna visita en este periodo, así que el costo de operación es cero porque no se fue a ninguna pantalla, no porque falte capturarlo. | There were no visits in this period, so the operations cost is zero because nobody went to any screen, not because it is missing. | lib/data/reportes.ts:1916 |
| `reportes.nota.ot.intro` | El costo de operación se arma de dos fuentes y NO son lo mismo: lo que de verdad costó cada visita, cuando alguien lo capturó en su orden de trabajo, y una ESTIMACIÓN por tipo de orden —la de Configuración— cuando no. La estimación cobra igual una herrería de {caro} que una de {barato}. | The operations cost is built from two sources and they are NOT the same: what each visit actually cost, when someone recorded it on its work order, and an ESTIMATE per order type —the one in Settings— when not. The estimate charges a metalwork job of {caro} the same as one of {barato}. | lib/data/reportes.ts:1924 |
| `reportes.nota.ot.estimacion.uno` | {estimadas} de las {total} visita del periodo entra con la estimación por tipo ({estimado}) y {reales} con su costo real ({capturado}). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye. | {estimadas} of {total} visit in the period goes in at the per-type estimate ({estimado}) and {reales} at its actual cost ({capturado}). That part of the cost —and the margin that comes from it— is an estimate, not a measurement: recording the cost on the work order replaces it. |lib/data/reportes.ts:1934 (variante) |
| `reportes.nota.ot.estimacion.una-de-varias` | {estimadas} de las {total} visitas del periodo entra con la estimación por tipo ({estimado}) y {reales} con su costo real ({capturado}). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye. | {estimadas} of the {total} visits in the period goes in at the per-type estimate ({estimado}) and {reales} at their actual cost ({capturado}). That part of the cost —and the margin that comes from it— is an estimate, not a measurement: recording the cost on the work order replaces it. |lib/data/reportes.ts:1934 (variante) |
| `reportes.nota.ot.estimacion.otros` | {estimadas} de las {total} visitas del periodo entran con la estimación por tipo ({estimado}) y {reales} con su costo real ({capturado}). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye. | {estimadas} of the {total} visits in the period go in at the per-type estimate ({estimado}) and {reales} at their actual cost ({capturado}). That part of the cost —and the margin that comes from it— is an estimate, not a measurement: recording the cost on the work order replaces it. |lib/data/reportes.ts:1934 (variante) |
| `reportes.nota.ot.reales.uno` | Las {total} visita del periodo van con su costo REAL capturado ({capturado}): aquí no hay ninguna estimación, el costo de operación que ves es lo que se pagó. | The period’s {total} visit goes in at its ACTUAL recorded cost ({capturado}): there is no estimate here, the operations cost you see is what was paid. | lib/data/reportes.ts:1944 |
| `reportes.nota.ot.reales.otros` | Las {total} visitas del periodo van con su costo REAL capturado ({capturado}): aquí no hay ninguna estimación, el costo de operación que ves es lo que se pagó. | All {total} visits in the period go in at their ACTUAL recorded cost ({capturado}): there is no estimate here, the operations cost you see is what was paid. | lib/data/reportes.ts:1944 |
| `reportes.nota.m2.ninguna` | No se excluyó ninguna pantalla: todas las que tuvieron movimiento son estáticas y tienen sus medidas capturadas. | No screen was excluded: all the ones with activity are static and have their measurements recorded. | lib/data/reportes.ts:2101 |
| `reportes.nota.m2.fuera` | Quedaron fuera del ranking: {partes}. | Left out of the ranking: {partes}. | lib/data/reportes.ts:2118 |
| `reportes.nota.m2.digitales.uno` | {n} pantalla digital o rotativa, porque su denominador correcto son spots y no metros | {n} digital or rotating screen, because its correct denominator is spots, not meters | lib/data/reportes.ts:2106 |
| `reportes.nota.m2.digitales.otros` | {n} pantallas digitales o rotativas, porque su denominador correcto son spots y no metros | {n} digital or rotating screens, because their correct denominator is spots, not meters | lib/data/reportes.ts:2106 |
| `reportes.nota.m2.sin-medidas.uno` | {n} estática sin ancho o sin alto capturados | {n} static screen with no width or height recorded | lib/data/reportes.ts:2113 |
| `reportes.nota.m2.sin-medidas.otros` | {n} estáticas sin ancho o sin alto capturados | {n} static screens with no width or height recorded | lib/data/reportes.ts:2113 |
| `reportes.nota.entidad.intro` | La operación ({operacion}) y la luz ({luz}) NO se reparten entre razones sociales: ningún dato dice a nombre de quién se pagan. Por eso esta vista no muestra margen — saldría mejor que el real. | Operations ({operacion}) and electricity ({luz}) are NOT split among legal entities: no data says in whose name they are paid. That is why this view shows no margin — it would come out better than the real one. | lib/data/reportes.ts:2249 |
| `reportes.nota.entidad.sin-emisora.uno` | {n} reserva del periodo sin comprobante con emisora: su ingreso sale en «Sin asignar». | {n} booking in the period has no invoice from an issuing entity: its revenue shows under “Unassigned”. | lib/data/reportes.ts:2258 |
| `reportes.nota.entidad.sin-emisora.otros` | {n} reservas del periodo sin comprobante con emisora: su ingreso sale en «Sin asignar». | {n} bookings in the period have no invoice from an issuing entity: their revenue shows under “Unassigned”. | lib/data/reportes.ts:2258 |
| `reportes.nota.entidad.sin-entidad.uno` | {n} contrato sin razón social asignada: su renta sale en «Sin asignar». | {n} contract has no legal entity assigned: its rent shows under “Unassigned”. | lib/data/reportes.ts:2267 |
| `reportes.nota.entidad.sin-entidad.otros` | {n} contratos sin razón social asignada: su renta sale en «Sin asignar». | {n} contracts have no legal entity assigned: their rent shows under “Unassigned”. | lib/data/reportes.ts:2267 |
| `reportes.nota.tarifa.intro` | La diferencia entre la tarifa publicada y el neto es el descuento comercial MÁS la comisión de agencia: las dos se congelan juntas en la propuesta y el dato no las separa por pantalla. | The difference between the published rate and the net is the commercial discount PLUS the agency commission: both are frozen together in the proposal and the data does not separate them by screen. | lib/data/reportes.ts:2411 |
| `reportes.nota.tarifa.sin-tarifa.uno` | {sin} de las {total} reserva del periodo no tienen tarifa publicada con la que comparar ({ingreso} de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera. | {sin} of {total} booking in the period has no published rate to compare against ({ingreso} of revenue): either it was created in Sales —where the stored price ALREADY IS the list rate— or its price does not match the net its proposal froze. Those rows show a dash, not a zero: a zero would say the whole rate was given away. |lib/data/reportes.ts:2418 (variante) |
| `reportes.nota.tarifa.sin-tarifa.una-de-varias` | {sin} de las {total} reservas del periodo no tienen tarifa publicada con la que comparar ({ingreso} de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera. | {sin} of the {total} bookings in the period has no published rate to compare against ({ingreso} of revenue): either it was created in Sales —where the stored price ALREADY IS the list rate— or its price does not match the net its proposal froze. Those rows show a dash, not a zero: a zero would say the whole rate was given away. |lib/data/reportes.ts:2418 (variante) |
| `reportes.nota.tarifa.sin-tarifa.otros` | {sin} de las {total} reservas del periodo no tienen tarifa publicada con la que comparar ({ingreso} de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera. | {sin} of the {total} bookings in the period have no published rate to compare against ({ingreso} of revenue): either they were created in Sales —where the stored price ALREADY IS the list rate— or their price does not match the net their proposal froze. Those rows show a dash, not a zero: a zero would say the whole rate was given away. |lib/data/reportes.ts:2418 (variante) |
| `reportes.nota.vendedor.intro` | La diferencia entre la tarifa publicada y el neto es el descuento comercial MÁS la comisión de agencia: las dos se congelan juntas en la propuesta y el dato no las separa. No es todo rebaja que el vendedor concediera. | The difference between the published rate and the net is the commercial discount PLUS the agency commission: both are frozen together in the proposal and the data does not separate them. Not all of it is a discount the sales rep granted. | lib/data/reportes.ts:2575 |
| `reportes.nota.vendedor.sin-propuesta` | {n} de campañas creadas directamente en Comercial, que nunca tuvieron propuesta y por tanto no tienen a quién atribuirse | {n} from campaigns created directly in Sales, which never had a proposal and so have no one to be attributed to | lib/data/reportes.ts:2584 |
| `reportes.nota.vendedor.historicas` | {n} de propuestas anteriores al 2026-09-28, cuando todavía no se guardaba quién las hacía: ese dato NO SE PUEDE RECUPERAR —la bitácora guarda el nombre de la propuesta, no su identificador— así que esas ventas se quedan sin vendedor para siempre | {n} from proposals before 2026-09-28, when who made them was not stored yet: that data CANNOT BE RECOVERED —the log stores the proposal’s name, not its identifier— so those sales stay without a sales rep for good | lib/data/reportes.ts:2587 |
| `reportes.nota.vendedor.sin-vendedor.uno` | {sin} de las {total} reserva del periodo salen en «Sin vendedor» ({ingreso} de ingreso): {causas}. | {sin} of {total} booking in the period shows under “No sales rep” ({ingreso} of revenue): {causas}. |lib/data/reportes.ts:2591 (variante) |
| `reportes.nota.vendedor.sin-vendedor.una-de-varias` | {sin} de las {total} reservas del periodo salen en «Sin vendedor» ({ingreso} de ingreso): {causas}. | {sin} of the {total} bookings in the period shows under “No sales rep” ({ingreso} of revenue): {causas}. |lib/data/reportes.ts:2591 (variante) |
| `reportes.nota.vendedor.sin-vendedor.otros` | {sin} de las {total} reservas del periodo salen en «Sin vendedor» ({ingreso} de ingreso): {causas}. | {sin} of the {total} bookings in the period show under “No sales rep” ({ingreso} of revenue): {causas}. |lib/data/reportes.ts:2591 (variante) |
| `reportes.nota.vendedor.raya` | Esas filas salen con una raya y no con un cero: un cero en «Descuento y comisión» afirmaría que no se concedió ninguno. | Those rows show a dash, not a zero: a zero in “Discount and commission” would claim none was granted. | lib/data/reportes.ts:2598 |
| `reportes.nota.luz.sin-esperados` | No hay recibos de luz que esperar en este periodo. | There are no electricity bills to expect in this period. | lib/data/reportes.ts:2792 |
| `reportes.nota.luz.completa.uno` | No falta ningún recibo: están capturados los {esperados} del periodo, así que el costo de la luz está completo. | No bill is missing: the period’s {esperados} bill is recorded, so the electricity cost is complete. | lib/data/reportes.ts:2793 |
| `reportes.nota.luz.completa.otros` | No falta ningún recibo: están capturados los {esperados} del periodo, así que el costo de la luz está completo. | No bill is missing: all {esperados} for the period are recorded, so the electricity cost is complete. | lib/data/reportes.ts:2793 |
| `reportes.nota.luz.faltan.uno` | Faltan {faltantes} de {esperados} recibos del periodo, así que el costo de la luz que ves está INCOMPLETO y el margen sale mejor de lo que va a quedar. Un mes sin recibo no es un mes sin consumo: es un dato que nadie ha capturado todavía. | Missing: {faltantes} of {esperados} bill for the period, so the electricity cost you see is INCOMPLETE and the margin looks better than it will end up. A month without a bill is not a month without consumption: it is data nobody has recorded yet. | lib/data/reportes.ts:2799 |
| `reportes.nota.luz.faltan.otros` | Faltan {faltantes} de {esperados} recibos del periodo, así que el costo de la luz que ves está INCOMPLETO y el margen sale mejor de lo que va a quedar. Un mes sin recibo no es un mes sin consumo: es un dato que nadie ha capturado todavía. | Missing: {faltantes} of {esperados} bills for the period, so the electricity cost you see is INCOMPLETE and the margin looks better than it will end up. A month without a bill is not a month without consumption: it is data nobody has recorded yet. | lib/data/reportes.ts:2799 |
| `reportes.nota.luz.sin-destino.uno` | Además, {n} recibo por {importe} no aparece en ninguna fila, porque su predio todavía no tiene pantallas dadas de alta. | Also, {n} bill for {importe} does not appear in any row, because its property has no screens set up yet. | lib/data/reportes.ts:2815 |
| `reportes.nota.luz.sin-destino.otros` | Además, {n} recibos por {importe} no aparecen en ninguna fila, porque su predio todavía no tiene pantallas dadas de alta. | Also, {n} bills for {importe} do not appear in any row, because their property has no screens set up yet. | lib/data/reportes.ts:2815 |

## Términos nuevos del lote

| español | inglés | nota |
|---|---|---|
| rentabilidad | profitability | glosario del orquestador |
| ocupación | occupancy | glosario del orquestador (eje de la gráfica) |
| ingreso | revenue | como el Dashboard (`inicio.*`) |
| costo del espacio / de operación / de la luz | space cost / operations cost / electricity cost | «Operación» = Operations, como Administración |
| margen bruto | gross margin | |
| superficie · cara | area · face | |
| razón social (columna) | Legal name | como Administración; el sustantivo contado es «legal entity» |
| saldo atribuido | attributed balance | |
| tarifa publicada · neto comparable · tarifa de lista | published rate · comparable net · list rate | |
| descuento y comisión | discount and commission | |
| reserva | booking | glosario |
| comprobante con emisora | invoice from an issuing entity | |
| horas en sitio · marcas de tiempo | hours on site · timestamps | |
| trimestre (columna) · «T1 2026» | Quarter · «Q1 2026» | «Trimestre» va declarado en `costura.test.ts`: el selector de periodo dice «This quarter» |
| en curso · con movimiento | in progress · with activity | |
| desglose por periodo | breakdown by period | |
| recibo (de luz) · predio | (electricity) bill · property | como Consumo de luz y el lote servidor |
| contrato de arrendamiento · propia | lease contract · owned | |
| digital o rotativa | digital or rotating | «rotating», como la ficha de Comercial |
| bitácora | log | |
