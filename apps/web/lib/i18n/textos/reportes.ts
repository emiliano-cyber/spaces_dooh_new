// ============================================================================
//  lib/i18n/textos/reportes.ts — LOS TEXTOS DE REPORTES DE RENTABILIDAD
//  (`/reportes`: la pagina, los filtros, la tabla, los avisos y las notas que
//  redacta el motor).
// ----------------------------------------------------------------------------
//  3.ª oleada del ingles (2026-11-02), lote «reportes». Mismas reglas que
//  `textos/propuestas.ts`: claves en espanol, espanol LITERAL, `EN_REPORTES`
//  como `Record` (una clave que falte no compila), ni dinero ni moneda (los
//  importes entran por hueco, ya formateados con el idioma).
//
//  DE DONDE SALE EL ESPANOL, y quien lo ata:
//   - Los catalogos de `components/demo/reportes/{consulta,tabla}.ts`
//     (`DIMENSIONES_UI`, `GRANULARIDADES_UI`, `COLUMNAS`, `PRIMERA_COLUMNA`,
//     `COLUMNAS_DESGLOSE`, `SUSTANTIVO_FILA`) siguen siendo la verdad en
//     espanol; `textos/reportes.test.ts` exige que el diccionario los
//     reproduzca letra por letra, como el menu con `nav.ts`.
//   - `reportes.nota.*` son las notas que redacta el MOTOR
//     (`lib/data/reportes.ts`: `notaDeCostosOt`, `notaDeExclusiones`,
//     `notaDeAtribucion`, `notaDeTarifas`, `notaDeVendedores`,
//     `notaDeCobertura`). El motor las arma CON este diccionario, en espanol
//     por omision; la pantalla en ingles las vuelve a armar desde los numeros
//     que viajan con ellas. Lo que el servidor manda (y lo que se exporte)
//     sigue en espanol.
//   - `reportes.fila.sin-asignar*` y `reportes.fila.sin-vendedor*` son las dos
//     filas que el motor anade con la clave vacia; el resto de etiquetas de
//     fila son DATOS (nombres de pantallas, de razones sociales, de personas y
//     los papeles de `catalogo_roles_entidad`) y no se traducen.
//
//  GLOSARIO DEL LOTE: rentabilidad → profitability · ingreso → revenue ·
//  costo del espacio → space cost · operacion → operations · luz →
//  electricity · recibo (de luz) → (electricity) bill · margen bruto → gross
//  margin · superficie → area · cara → face · razon social → legal entity
//  (la columna, «Legal name», como Administracion) · saldo atribuido →
//  attributed balance · tarifa publicada → published rate · neto comparable →
//  comparable net · tarifa de lista → list rate · reserva → booking ·
//  comprobante con emisora → invoice from an issuing entity · horas en sitio →
//  hours on site · marcas de tiempo → timestamps · trimestre → quarter (y su
//  etiqueta «T1 2026» → «Q1 2026») · en curso → in progress · con movimiento →
//  with activity · desglose → breakdown · predio → property · contrato de
//  arrendamiento → lease contract · propia → owned · bitacora → log.
// ============================================================================

export const ES_REPORTES = {
  // ── La pagina ──
  'reportes.titulo': 'Reportes de rentabilidad',
  'reportes.subtitulo': 'Qué ingresa y qué cuesta cada pantalla en el periodo que elijas.',
  'reportes.indicadores': 'Indicadores del periodo',
  'reportes.kpi.ingreso': 'Ingreso del periodo',
  'reportes.kpi.costo-sub': 'Espacio {espacio} · Operación {operacion} · Luz {luz}',
  'reportes.kpi.margen': 'Margen sobre ingreso',
  'reportes.kpi.margen-sub': 'Margen {monto}',
  'reportes.rango': 'Del {desde} al {hasta}',
  'reportes.resultado': 'Resultado',
  'reportes.periodos': '{n} {periodos}',
  'reportes.periodos.palabra.uno': 'periodo',
  'reportes.periodos.palabra.otros': 'periodos',
  'reportes.error.titulo': 'No se pudo calcular el reporte',
  'reportes.error.sin-mensaje': 'No se pudo calcular el reporte. La petición no llegó a buen término.',
  'reportes.error.red': 'No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar.',
  'reportes.invalido.titulo': 'Revisa el periodo',
  'reportes.vacio.titulo': 'Sin movimiento en este periodo',
  'reportes.vacio.detalle':
    'Entre el {desde} y el {hasta} ninguna pantalla registró ingreso, renta ni órdenes de trabajo. Una pantalla sin nada de eso no aparece en el reporte; prueba con un rango más amplio.',
  'reportes.notas': 'Notas sobre estas cifras ({n})',
  'reportes.inicial.titulo': 'Elige un periodo',
  'reportes.inicial.detalle': 'El reporte se calcula al elegir las fechas.',

  // ── Los filtros ──
  'reportes.filtro.agrupar': 'Agrupar',
  'reportes.filtro.desde': 'Desde',
  'reportes.filtro.hasta': 'Hasta',
  'reportes.filtro.periodos': 'Periodos',
  'reportes.dim.sitio': 'Por pantalla',
  'reportes.dim.sitio.ayuda':
    'Ingreso y las tres fuentes de costo de cada pantalla —espacio, operación y luz—. Peor margen primero.',
  'reportes.dim.trimestre': 'Por trimestre',
  'reportes.dim.trimestre.ayuda': 'Cómo evoluciona el negocio: una fila por trimestre natural, en orden cronológico.',
  'reportes.dim.operacion': 'Por operación',
  'reportes.dim.operacion.ayuda': 'Dónde se va el dinero en visitas: órdenes de trabajo, su costo y las horas en sitio.',
  'reportes.dim.m2': 'Por metro cuadrado',
  'reportes.dim.m2.ayuda': 'Qué superficie estática rinde. Las digitales no entran: su denominador son spots.',
  'reportes.dim.luz': 'Por consumo de luz',
  'reportes.dim.luz.ayuda': 'Qué pantallas se comen la energía. El recibo del predio se reparte entre sus pantallas.',
  'reportes.dim.entidad': 'Por razón social',
  'reportes.dim.entidad.ayuda':
    'Cuánto factura y cuánta renta paga cada una de tus razones sociales. La operación y la luz no se reparten: no hay dato que diga de quién son.',
  'reportes.dim.tarifa': 'Publicada vs neta',
  'reportes.dim.tarifa.ayuda':
    'Qué tarifa se publicó y qué entró de ella. Lo vendido desde Comercial no tiene tarifa publicada congelada y sale con una raya, no con un cero.',
  'reportes.dim.vendedor': 'Por vendedor',
  'reportes.dim.vendedor.ayuda':
    'Cuánto vendió cada persona y cuánto descuento concedió. El vendedor es quien crea la propuesta, y se guarda desde el 2026-09-28: lo anterior sale en «Sin vendedor» y no se puede recuperar.',
  'reportes.gran.mes': 'Mensual',
  'reportes.gran.trimestre': 'Trimestral',

  // ── Los motivos del rango (`motivoInvalido`) ──
  'reportes.motivo.sin-inicio': 'Falta la fecha de inicio del reporte',
  'reportes.motivo.sin-fin': 'Falta la fecha de fin del reporte',
  'reportes.motivo.formato': 'Usa fechas con formato AAAA-MM-DD',
  'reportes.motivo.invertido': 'La fecha de fin no puede ser anterior a la de inicio',
  'reportes.motivo.tope': 'El reporte abarca como máximo 24 meses por consulta. Acorta el rango de fechas.',

  // ── Las columnas (`COLUMNAS`, `PRIMERA_COLUMNA`) ──
  'reportes.col.pantalla': 'Pantalla',
  'reportes.col.trimestre': 'Trimestre',
  'reportes.col.razon-social': 'Razón social',
  'reportes.col.vendedor': 'Vendedor',
  'reportes.col.ingreso': 'Ingreso',
  'reportes.col.costo-espacio': 'Costo del espacio',
  'reportes.col.costo-operacion': 'Costo de operación',
  'reportes.col.costo-luz': 'Costo de la luz',
  'reportes.col.costo-total': 'Costo total',
  'reportes.col.margen-bruto': 'Margen bruto',
  'reportes.col.margen-bruto-pct': 'Margen bruto %',
  'reportes.col.visitas': 'Visitas',
  'reportes.col.operacion-ingreso': 'Operación / ingreso',
  'reportes.col.horas': 'Horas en sitio',
  'reportes.col.superficie': 'Superficie',
  'reportes.col.ingreso-m2': 'Ingreso / m²',
  'reportes.col.margen-m2': 'Margen bruto / m²',
  'reportes.col.consumo': 'Consumo',
  'reportes.col.costo-kwh': 'Costo / kWh',
  'reportes.col.saldo-atribuido': 'Saldo atribuido',
  'reportes.col.pct-facturacion': '% de la facturación',
  'reportes.col.tarifa-publicada': 'Tarifa publicada',
  'reportes.col.neto-comparable': 'Neto comparable',
  'reportes.col.descuento-comision': 'Descuento y comisión',
  'reportes.col.pct-publicada': '% sobre publicada',
  // ── El desglose por periodo (`COLUMNAS_DESGLOSE`) ──
  'reportes.desglose.periodo': 'Periodo',
  'reportes.desglose.espacio': 'Espacio',
  'reportes.desglose.operacion': 'Operación',
  'reportes.desglose.luz': 'Luz',

  // ── La tabla ──
  'reportes.tabla.total': 'Total ({n})',
  'reportes.tabla.desglose.ocultar': 'Ocultar el desglose por periodo',
  'reportes.tabla.desglose.ver': 'Ver el desglose por periodo',
  'reportes.tabla.raya.margen-pct': 'Sin ingreso en el rango: no hay porcentaje que calcular',
  'reportes.tabla.raya.operacion-pct': 'Sin ingreso en el rango: no hay proporción que calcular',
  'reportes.tabla.raya.horas': 'Ninguna visita del rango tiene registradas sus dos marcas de tiempo',
  'reportes.tabla.horas-de': 'de {n} {visitas}',
  'reportes.tabla.visitas.uno': 'visita',
  'reportes.tabla.visitas.otros': 'visitas',
  'reportes.tabla.propia': 'propia',
  'reportes.tabla.sin-contrato': 'sin contrato',

  // ── Las filas que anade el motor con la clave vacia ──
  'reportes.fila.sin-asignar': 'Sin asignar',
  'reportes.fila.sin-asignar.detalle': 'Sin razón social en el dato de origen',
  'reportes.fila.sin-vendedor': 'Sin vendedor',
  'reportes.fila.sin-vendedor.detalle': 'Campañas de Comercial y propuestas anteriores al 2026-09-28',

  // ── Cuantas filas (`cuenta`, `subtituloDeConteo`) ──
  'reportes.cuenta.pantalla.uno': '{n} pantalla',
  'reportes.cuenta.pantalla.otros': '{n} pantallas',
  'reportes.cuenta.trimestre.uno': '{n} trimestre',
  'reportes.cuenta.trimestre.otros': '{n} trimestres',
  'reportes.cuenta.razon-social.uno': '{n} razón social',
  'reportes.cuenta.razon-social.otros': '{n} razones sociales',
  'reportes.cuenta.vendedor.uno': '{n} vendedor',
  'reportes.cuenta.vendedor.otros': '{n} vendedores',
  'reportes.con-movimiento': '{cuenta} con movimiento',

  // ── Los avisos que arma la pantalla (`avisosDelReporte`) ──
  'reportes.aviso.en-curso.uno':
    'El periodo que estás viendo toca {etiqueta}, que está EN CURSO: llevan {corridos} de sus {totales} días. La renta de los espacios ya corrió esos {corridos} días completos, pero lo que se vendió se cobra al cerrar, así que el ingreso todavía no está dentro y el margen sale peor de lo que va a quedar. No lo compares con un trimestre terminado.',
  'reportes.aviso.en-curso.otros':
    'El periodo que estás viendo toca {etiqueta}, que está EN CURSO: llevan {corridos} de sus {totales} días. La renta de los espacios ya corrió esos {corridos} días completos, pero lo que se vendió se cobra al cerrar, así que el ingreso todavía no está dentro y el margen sale peor de lo que va a quedar. No lo compares con un trimestre terminado.',
  'reportes.aviso.margen-bruto':
    'El margen de este reporte es BRUTO: es el ingreso menos los costos DIRECTOS de la pantalla —el espacio, la operación y la luz—. NO es el margen neto, y no se llega a él restando nada de lo que hay en esta tabla: al neto le faltarían los costos indirectos (nómina, oficina, estructura) y este sistema no captura ninguno. Mientras no se capturen, el margen neto del negocio no se puede calcular aquí y no es que esté escondido en otra pantalla.',
  'reportes.aviso.m2.todas-las-caras':
    'La superficie suma TODAS las caras de cada pantalla: una de dos caras de 3 × 6 cuenta 36 m², no 18. Es la superficie que se vende, y cada pantalla aporta la de sus propias caras.',
  'reportes.aviso.m2.una-cara':
    'La superficie es la de UNA cara: una pantalla de dos caras de 3 × 6 cuenta 18 m², no 36. Mide la superficie del soporte y no la que se vende, así que las pantallas de varias caras salen mejor situadas que si se contaran todas.',
  'reportes.aviso.sin-contrato.uno':
    '{cuenta} no tiene contrato de arrendamiento en el periodo: su costo del espacio sale en cero porque falta el dato, no porque sea gratis, y su margen se lee mejor de lo que es.',
  'reportes.aviso.sin-contrato.otros':
    '{cuenta} no tienen contrato de arrendamiento en el periodo: su costo del espacio sale en cero porque falta el dato, no porque sea gratis, y su margen se lee mejor de lo que es.',
  'reportes.aviso.sin-ingreso.trimestre.uno':
    '{cuenta} sin ingreso en el rango. Aparece en cero a propósito: en una serie de tiempo un hueco se lee como «faltan datos» y un cero se lee como «no pasó nada».',
  'reportes.aviso.sin-ingreso.trimestre.otros':
    '{cuenta} sin ingreso en el rango. Aparecen en cero a propósito: en una serie de tiempo un hueco se lee como «faltan datos» y un cero se lee como «no pasó nada».',
  'reportes.aviso.sin-ingreso.uno':
    '{cuenta} costó sin vender nada en el periodo, así que no tiene margen porcentual (la columna sale con «—»).',
  'reportes.aviso.sin-ingreso.otros':
    '{cuenta} costaron sin vender nada en el periodo, así que no tienen margen porcentual (la columna sale con «—»).',

  // ── Las notas que redacta el motor (`lib/data/reportes.ts`) ──
  // Operacion: con que se cobro (`notaDeCostosOt`).
  'reportes.nota.ot.sin-visitas':
    'No hubo ninguna visita en este periodo, así que el costo de operación es cero porque no se fue a ninguna pantalla, no porque falte capturarlo.',
  'reportes.nota.ot.intro':
    'El costo de operación se arma de dos fuentes y NO son lo mismo: lo que de verdad costó cada visita, cuando alguien lo capturó en su orden de trabajo, y una ESTIMACIÓN por tipo de orden —la de Configuración— cuando no. La estimación cobra igual una herrería de {caro} que una de {barato}.',
  'reportes.nota.ot.estimacion.uno':
    '{estimadas} de las {total} visita del periodo entra con la estimación por tipo ({estimado}) y {reales} con su costo real ({capturado}). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye.',
  'reportes.nota.ot.estimacion.una-de-varias':
    '{estimadas} de las {total} visitas del periodo entra con la estimación por tipo ({estimado}) y {reales} con su costo real ({capturado}). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye.',
  'reportes.nota.ot.estimacion.otros':
    '{estimadas} de las {total} visitas del periodo entran con la estimación por tipo ({estimado}) y {reales} con su costo real ({capturado}). Esa parte del costo —y el margen que sale de ella— es una estimación, no una medición: capturar el costo en la orden de trabajo la sustituye.',
  // Sin hueco: esta variante sale solo con UNA visita, y el ingles dice «the
  // period’s only visit» sin cifra. El espanol escribe el 1 que antes ponia el
  // hueco: la frase es la misma, letra por letra (incluido «Las 1 visita»).
  'reportes.nota.ot.reales.uno':
    'Las 1 visita del periodo van con su costo REAL capturado ({capturado}): aquí no hay ninguna estimación, el costo de operación que ves es lo que se pagó.',
  'reportes.nota.ot.reales.otros':
    'Las {total} visitas del periodo van con su costo REAL capturado ({capturado}): aquí no hay ninguna estimación, el costo de operación que ves es lo que se pagó.',
  // Metro cuadrado: lo que quedo fuera (`notaDeExclusiones`).
  'reportes.nota.m2.ninguna':
    'No se excluyó ninguna pantalla: todas las que tuvieron movimiento son estáticas y tienen sus medidas capturadas.',
  'reportes.nota.m2.fuera': 'Quedaron fuera del ranking: {partes}.',
  'reportes.nota.m2.digitales.uno': '{n} pantalla digital o rotativa, porque su denominador correcto son spots y no metros',
  'reportes.nota.m2.digitales.otros':
    '{n} pantallas digitales o rotativas, porque su denominador correcto son spots y no metros',
  'reportes.nota.m2.sin-medidas.uno': '{n} estática sin ancho o sin alto capturados',
  'reportes.nota.m2.sin-medidas.otros': '{n} estáticas sin ancho o sin alto capturados',
  // Razon social: lo que no se reparte (`notaDeAtribucion`).
  'reportes.nota.entidad.intro':
    'La operación ({operacion}) y la luz ({luz}) NO se reparten entre razones sociales: ningún dato dice a nombre de quién se pagan. Por eso esta vista no muestra margen — saldría mejor que el real.',
  'reportes.nota.entidad.sin-emisora.uno':
    '{n} reserva del periodo sin comprobante con emisora: su ingreso sale en «Sin asignar».',
  'reportes.nota.entidad.sin-emisora.otros':
    '{n} reservas del periodo sin comprobante con emisora: su ingreso sale en «Sin asignar».',
  'reportes.nota.entidad.sin-entidad.uno': '{n} contrato sin razón social asignada: su renta sale en «Sin asignar».',
  'reportes.nota.entidad.sin-entidad.otros': '{n} contratos sin razón social asignada: su renta sale en «Sin asignar».',
  // Publicada vs neta (`notaDeTarifas`).
  'reportes.nota.tarifa.intro':
    'La diferencia entre la tarifa publicada y el neto es el descuento comercial MÁS la comisión de agencia: las dos se congelan juntas en la propuesta y el dato no las separa por pantalla.',
  'reportes.nota.tarifa.sin-tarifa.uno':
    '{sin} de las {total} reserva del periodo no tienen tarifa publicada con la que comparar ({ingreso} de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera.',
  'reportes.nota.tarifa.sin-tarifa.una-de-varias':
    '{sin} de las {total} reservas del periodo no tienen tarifa publicada con la que comparar ({ingreso} de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera.',
  'reportes.nota.tarifa.sin-tarifa.otros':
    '{sin} de las {total} reservas del periodo no tienen tarifa publicada con la que comparar ({ingreso} de ingreso): o nacieron en Comercial —donde el precio que se guarda YA ES la tarifa de lista— o su precio no coincide con el neto que congeló su propuesta. Esas filas salen con una raya y no con un cero: un cero diría que se regaló la tarifa entera.',
  // Por vendedor (`notaDeVendedores`).
  'reportes.nota.vendedor.intro':
    'La diferencia entre la tarifa publicada y el neto es el descuento comercial MÁS la comisión de agencia: las dos se congelan juntas en la propuesta y el dato no las separa. No es todo rebaja que el vendedor concediera.',
  'reportes.nota.vendedor.sin-propuesta':
    '{n} de campañas creadas directamente en Comercial, que nunca tuvieron propuesta y por tanto no tienen a quién atribuirse',
  'reportes.nota.vendedor.historicas':
    '{n} de propuestas anteriores al 2026-09-28, cuando todavía no se guardaba quién las hacía: ese dato NO SE PUEDE RECUPERAR —la bitácora guarda el nombre de la propuesta, no su identificador— así que esas ventas se quedan sin vendedor para siempre',
  'reportes.nota.vendedor.sin-vendedor.uno':
    '{sin} de las {total} reserva del periodo salen en «Sin vendedor» ({ingreso} de ingreso): {causas}.',
  'reportes.nota.vendedor.sin-vendedor.una-de-varias':
    '{sin} de las {total} reservas del periodo salen en «Sin vendedor» ({ingreso} de ingreso): {causas}.',
  'reportes.nota.vendedor.sin-vendedor.otros':
    '{sin} de las {total} reservas del periodo salen en «Sin vendedor» ({ingreso} de ingreso): {causas}.',
  'reportes.nota.vendedor.raya':
    'Esas filas salen con una raya y no con un cero: un cero en «Descuento y comisión» afirmaría que no se concedió ninguno.',
  // Luz: los recibos que faltan (`notaDeCobertura`).
  'reportes.nota.luz.sin-esperados': 'No hay recibos de luz que esperar en este periodo.',
  'reportes.nota.luz.completa.uno':
    'No falta ningún recibo: están capturados los {esperados} del periodo, así que el costo de la luz está completo.',
  'reportes.nota.luz.completa.otros':
    'No falta ningún recibo: están capturados los {esperados} del periodo, así que el costo de la luz está completo.',
  'reportes.nota.luz.faltan.uno':
    'Faltan {faltantes} de {esperados} recibos del periodo, así que el costo de la luz que ves está INCOMPLETO y el margen sale mejor de lo que va a quedar. Un mes sin recibo no es un mes sin consumo: es un dato que nadie ha capturado todavía.',
  'reportes.nota.luz.faltan.otros':
    'Faltan {faltantes} de {esperados} recibos del periodo, así que el costo de la luz que ves está INCOMPLETO y el margen sale mejor de lo que va a quedar. Un mes sin recibo no es un mes sin consumo: es un dato que nadie ha capturado todavía.',
  'reportes.nota.luz.sin-destino.uno':
    'Además, {n} recibo por {importe} no aparece en ninguna fila, porque su predio todavía no tiene pantallas dadas de alta.',
  'reportes.nota.luz.sin-destino.otros':
    'Además, {n} recibos por {importe} no aparecen en ninguna fila, porque su predio todavía no tiene pantallas dadas de alta.',
} as const

export type ClaveReportes = keyof typeof ES_REPORTES

export const EN_REPORTES: Record<ClaveReportes, string> = {
  // ── The page ──
  'reportes.titulo': 'Profitability reports',
  'reportes.subtitulo': 'What each screen brings in and what it costs in the period you choose.',
  'reportes.indicadores': 'Period indicators',
  'reportes.kpi.ingreso': 'Period revenue',
  'reportes.kpi.costo-sub': 'Space {espacio} · Operations {operacion} · Electricity {luz}',
  'reportes.kpi.margen': 'Margin on revenue',
  'reportes.kpi.margen-sub': 'Margin {monto}',
  'reportes.rango': '{desde} to {hasta}',
  'reportes.resultado': 'Result',
  'reportes.periodos': '{n} {periodos}',
  'reportes.periodos.palabra.uno': 'period',
  'reportes.periodos.palabra.otros': 'periods',
  'reportes.error.titulo': 'Could not calculate the report',
  'reportes.error.sin-mensaje': 'Could not calculate the report. The request did not go through.',
  'reportes.error.red': 'Could not reach the server. Check your connection and try again.',
  'reportes.invalido.titulo': 'Check the period',
  'reportes.vacio.titulo': 'No activity in this period',
  'reportes.vacio.detalle':
    'Between {desde} and {hasta} no screen recorded revenue, rent or work orders. A screen with none of that does not appear in the report; try a wider range.',
  'reportes.notas': 'Notes on these figures ({n})',
  'reportes.inicial.titulo': 'Choose a period',
  'reportes.inicial.detalle': 'The report is calculated when you choose the dates.',

  // ── The filters ──
  'reportes.filtro.agrupar': 'Group by',
  'reportes.filtro.desde': 'From',
  'reportes.filtro.hasta': 'To',
  'reportes.filtro.periodos': 'Periods',
  'reportes.dim.sitio': 'By screen',
  'reportes.dim.sitio.ayuda':
    'Revenue and the three cost sources of each screen —space, operations and electricity—. Worst margin first.',
  'reportes.dim.trimestre': 'By quarter',
  'reportes.dim.trimestre.ayuda': 'How the business is evolving: one row per calendar quarter, in chronological order.',
  'reportes.dim.operacion': 'By operations',
  'reportes.dim.operacion.ayuda': 'Where the money goes on visits: work orders, their cost and the hours on site.',
  'reportes.dim.m2': 'By square meter',
  'reportes.dim.m2.ayuda': 'Which static area pays off. Digital screens are left out: their denominator is spots.',
  'reportes.dim.luz': 'By electricity consumption',
  'reportes.dim.luz.ayuda': 'Which screens eat up the energy. The property’s bill is split among its screens.',
  'reportes.dim.entidad': 'By legal entity',
  'reportes.dim.entidad.ayuda':
    'How much each of your legal entities bills and how much rent it pays. Operations and electricity are not split: no data says whose they are.',
  'reportes.dim.tarifa': 'Published vs net',
  'reportes.dim.tarifa.ayuda':
    'Which rate was published and how much of it came in. What was sold from Sales has no frozen published rate and shows a dash, not a zero.',
  'reportes.dim.vendedor': 'By sales rep',
  'reportes.dim.vendedor.ayuda':
    'How much each person sold and how much discount they granted. The sales rep is whoever creates the proposal, and it has been recorded since 2026-09-28: anything earlier shows under “No sales rep” and cannot be recovered.',
  'reportes.gran.mes': 'Monthly',
  'reportes.gran.trimestre': 'Quarterly',

  // ── Range reasons ──
  'reportes.motivo.sin-inicio': 'The report start date is missing',
  'reportes.motivo.sin-fin': 'The report end date is missing',
  'reportes.motivo.formato': 'Use dates in YYYY-MM-DD format',
  'reportes.motivo.invertido': 'The end date cannot be earlier than the start date',
  'reportes.motivo.tope': 'The report covers at most 24 months per query. Shorten the date range.',

  // ── Columns ──
  'reportes.col.pantalla': 'Screen',
  'reportes.col.trimestre': 'Quarter',
  'reportes.col.razon-social': 'Legal name',
  'reportes.col.vendedor': 'Sales rep',
  'reportes.col.ingreso': 'Revenue',
  'reportes.col.costo-espacio': 'Space cost',
  'reportes.col.costo-operacion': 'Operations cost',
  'reportes.col.costo-luz': 'Electricity cost',
  'reportes.col.costo-total': 'Total cost',
  'reportes.col.margen-bruto': 'Gross margin',
  'reportes.col.margen-bruto-pct': 'Gross margin (%)',
  'reportes.col.visitas': 'Visits',
  'reportes.col.operacion-ingreso': 'Operations / revenue',
  'reportes.col.horas': 'Hours on site',
  'reportes.col.superficie': 'Area',
  'reportes.col.ingreso-m2': 'Revenue / m²',
  'reportes.col.margen-m2': 'Gross margin / m²',
  'reportes.col.consumo': 'Consumption',
  'reportes.col.costo-kwh': 'Cost / kWh',
  'reportes.col.saldo-atribuido': 'Attributed balance',
  'reportes.col.pct-facturacion': '% of billing',
  'reportes.col.tarifa-publicada': 'Published rate',
  'reportes.col.neto-comparable': 'Comparable net',
  'reportes.col.descuento-comision': 'Discount and commission',
  'reportes.col.pct-publicada': '% of published rate',
  'reportes.desglose.periodo': 'Period',
  'reportes.desglose.espacio': 'Space',
  'reportes.desglose.operacion': 'Operations',
  'reportes.desglose.luz': 'Electricity',

  // ── The table ──
  'reportes.tabla.total': 'Total ({n})',
  'reportes.tabla.desglose.ocultar': 'Hide the breakdown by period',
  'reportes.tabla.desglose.ver': 'Show the breakdown by period',
  'reportes.tabla.raya.margen-pct': 'No revenue in the range: there is no percentage to calculate',
  'reportes.tabla.raya.operacion-pct': 'No revenue in the range: there is no ratio to calculate',
  'reportes.tabla.raya.horas': 'No visit in the range has both of its timestamps recorded',
  'reportes.tabla.horas-de': 'of {n} {visitas}',
  'reportes.tabla.visitas.uno': 'visit',
  'reportes.tabla.visitas.otros': 'visits',
  'reportes.tabla.propia': 'owned',
  'reportes.tabla.sin-contrato': 'no contract',

  // ── Rows the engine adds with the empty key ──
  'reportes.fila.sin-asignar': 'Unassigned',
  'reportes.fila.sin-asignar.detalle': 'No legal entity in the source data',
  'reportes.fila.sin-vendedor': 'No sales rep',
  'reportes.fila.sin-vendedor.detalle': 'Campaigns from Sales and proposals before 2026-09-28',

  // ── Row counts ──
  'reportes.cuenta.pantalla.uno': '{n} screen',
  'reportes.cuenta.pantalla.otros': '{n} screens',
  'reportes.cuenta.trimestre.uno': '{n} quarter',
  'reportes.cuenta.trimestre.otros': '{n} quarters',
  'reportes.cuenta.razon-social.uno': '{n} legal entity',
  'reportes.cuenta.razon-social.otros': '{n} legal entities',
  'reportes.cuenta.vendedor.uno': '{n} sales rep',
  'reportes.cuenta.vendedor.otros': '{n} sales reps',
  'reportes.con-movimiento': '{cuenta} with activity',

  // ── Notices the screen builds ──
  'reportes.aviso.en-curso.uno':
    'The period you are viewing overlaps {etiqueta}, which is IN PROGRESS: {corridos} of its {totales} days has gone by. Space rent has already run for that {corridos} full day, but what was sold is billed when the period closes, so the revenue is not in yet and the margin looks worse than it will end up. Do not compare it with a finished quarter.',
  'reportes.aviso.en-curso.otros':
    'The period you are viewing overlaps {etiqueta}, which is IN PROGRESS: {corridos} of its {totales} days have gone by. Space rent has already run for those {corridos} full days, but what was sold is billed when the period closes, so the revenue is not in yet and the margin looks worse than it will end up. Do not compare it with a finished quarter.',
  'reportes.aviso.margen-bruto':
    'The margin in this report is GROSS: it is revenue minus the screen’s DIRECT costs —space, operations and electricity—. It is NOT the net margin, and you do not get to it by subtracting anything in this table: the net would be missing the indirect costs (payroll, office, overhead) and this system records none of them. Until they are recorded, the business’s net margin cannot be calculated here, and it is not hidden on another screen either.',
  'reportes.aviso.m2.todas-las-caras':
    'The area adds up ALL the faces of each screen: a double-sided 3 × 6 screen counts as 36 m², not 18. It is the area that is sold, and each screen contributes that of its own faces.',
  'reportes.aviso.m2.una-cara':
    'The area is that of ONE face: a double-sided 3 × 6 screen counts as 18 m², not 36. It measures the structure’s area and not the area that is sold, so screens with several faces rank better than if all of them were counted.',
  'reportes.aviso.sin-contrato.uno':
    '{cuenta} has no lease contract in the period: its space cost shows as zero because the data is missing, not because it is free, and its margin reads better than it is.',
  'reportes.aviso.sin-contrato.otros':
    '{cuenta} have no lease contract in the period: their space cost shows as zero because the data is missing, not because it is free, and their margin reads better than it is.',
  'reportes.aviso.sin-ingreso.trimestre.uno':
    '{cuenta} with no revenue in the range. It shows as zero on purpose: in a time series a gap reads as “data is missing” and a zero reads as “nothing happened”.',
  'reportes.aviso.sin-ingreso.trimestre.otros':
    '{cuenta} with no revenue in the range. They show as zero on purpose: in a time series a gap reads as “data is missing” and a zero reads as “nothing happened”.',
  'reportes.aviso.sin-ingreso.uno':
    '{cuenta} cost money without selling anything in the period, so it has no percentage margin (the column shows “—”).',
  'reportes.aviso.sin-ingreso.otros':
    '{cuenta} cost money without selling anything in the period, so they have no percentage margin (the column shows “—”).',

  // ── Notes written by the engine ──
  'reportes.nota.ot.sin-visitas':
    'There were no visits in this period, so the operations cost is zero because nobody went to any screen, not because it hasn’t been recorded.',
  'reportes.nota.ot.intro':
    'The operations cost is built from two sources and they are NOT the same: what each visit actually cost, when someone recorded it on its work order, and an ESTIMATE per order type —the one in Settings— when not. The estimate charges a metalwork job of {caro} the same as one of {barato}.',
  'reportes.nota.ot.estimacion.uno':
    '{estimadas} of {total} visit in the period is costed at the per-type estimate ({estimado}) and {reales} at its actual cost ({capturado}). That part of the cost —and the margin that comes from it— is an estimate, not a measurement: recording the cost on the work order replaces it.',
  'reportes.nota.ot.estimacion.una-de-varias':
    '{estimadas} of the {total} visits in the period is costed at the per-type estimate ({estimado}) and {reales} at their actual cost ({capturado}). That part of the cost —and the margin that comes from it— is an estimate, not a measurement: recording the cost on the work order replaces it.',
  'reportes.nota.ot.estimacion.otros':
    '{estimadas} of the {total} visits in the period are costed at the per-type estimate ({estimado}) and {reales} at their actual cost ({capturado}). That part of the cost —and the margin that comes from it— is an estimate, not a measurement: recording the cost on the work order replaces it.',
  'reportes.nota.ot.reales.uno':
    'The period’s only visit is at its ACTUAL recorded cost ({capturado}): there is no estimate here, the operations cost you see is what was paid.',
  'reportes.nota.ot.reales.otros':
    'All {total} visits in the period are at their ACTUAL recorded cost ({capturado}): there is no estimate here, the operations cost you see is what was paid.',
  'reportes.nota.m2.ninguna':
    'No screen was excluded: all the ones with activity are static and have their measurements recorded.',
  'reportes.nota.m2.fuera': 'Left out of the ranking: {partes}.',
  'reportes.nota.m2.digitales.uno': '{n} digital or rotating screen, because its correct denominator is spots, not meters',
  'reportes.nota.m2.digitales.otros':
    '{n} digital or rotating screens, because their correct denominator is spots, not meters',
  'reportes.nota.m2.sin-medidas.uno': '{n} static screen missing its width or height',
  'reportes.nota.m2.sin-medidas.otros': '{n} static screens missing their width or height',
  'reportes.nota.entidad.intro':
    'Operations ({operacion}) and electricity ({luz}) are NOT split among legal entities: no data says in whose name they are paid. That is why this view shows no margin — it would come out better than the real one.',
  'reportes.nota.entidad.sin-emisora.uno':
    '{n} booking in the period has no invoice from an issuing entity: its revenue shows under “Unassigned”.',
  'reportes.nota.entidad.sin-emisora.otros':
    '{n} bookings in the period have no invoice from an issuing entity: their revenue shows under “Unassigned”.',
  'reportes.nota.entidad.sin-entidad.uno': '{n} contract has no legal entity assigned: its rent shows under “Unassigned”.',
  'reportes.nota.entidad.sin-entidad.otros':
    '{n} contracts have no legal entity assigned: their rent shows under “Unassigned”.',
  'reportes.nota.tarifa.intro':
    'The difference between the published rate and the net is the commercial discount PLUS the agency commission: both are frozen together in the proposal and the data does not separate them by screen.',
  'reportes.nota.tarifa.sin-tarifa.uno':
    '{sin} of {total} booking in the period has no published rate to compare against ({ingreso} of revenue): either it was created in Sales —where the stored price ALREADY IS the list rate— or its price does not match the net its proposal froze. Those rows show a dash, not a zero: a zero would say the whole rate was given away.',
  'reportes.nota.tarifa.sin-tarifa.una-de-varias':
    '{sin} of the {total} bookings in the period has no published rate to compare against ({ingreso} of revenue): either it was created in Sales —where the stored price ALREADY IS the list rate— or its price does not match the net its proposal froze. Those rows show a dash, not a zero: a zero would say the whole rate was given away.',
  'reportes.nota.tarifa.sin-tarifa.otros':
    '{sin} of the {total} bookings in the period have no published rate to compare against ({ingreso} of revenue): either they were created in Sales —where the stored price ALREADY IS the list rate— or their price does not match the net their proposal froze. Those rows show a dash, not a zero: a zero would say the whole rate was given away.',
  'reportes.nota.vendedor.intro':
    'The difference between the published rate and the net is the commercial discount PLUS the agency commission: both are frozen together in the proposal and the data does not separate them. Not all of it is a discount the sales rep granted.',
  'reportes.nota.vendedor.sin-propuesta':
    '{n} from campaigns created directly in Sales, which never had a proposal and so have no one to be attributed to',
  'reportes.nota.vendedor.historicas':
    '{n} from proposals before 2026-09-28, when the proposal’s creator was not yet recorded: that data CANNOT BE RECOVERED —the log stores the proposal’s name, not its identifier— so those sales stay without a sales rep for good',
  'reportes.nota.vendedor.sin-vendedor.uno':
    '{sin} of {total} booking in the period shows under “No sales rep” ({ingreso} of revenue): {causas}.',
  'reportes.nota.vendedor.sin-vendedor.una-de-varias':
    '{sin} of the {total} bookings in the period shows under “No sales rep” ({ingreso} of revenue): {causas}.',
  'reportes.nota.vendedor.sin-vendedor.otros':
    '{sin} of the {total} bookings in the period show under “No sales rep” ({ingreso} of revenue): {causas}.',
  'reportes.nota.vendedor.raya':
    'Those rows show a dash, not a zero: a zero in “Discount and commission” would claim none was granted.',
  'reportes.nota.luz.sin-esperados': 'There are no electricity bills to expect in this period.',
  'reportes.nota.luz.completa.uno':
    'No bill is missing: the period’s {esperados} bill is recorded, so the electricity cost is complete.',
  'reportes.nota.luz.completa.otros':
    'No bill is missing: all {esperados} bills for the period are recorded, so the electricity cost is complete.',
  'reportes.nota.luz.faltan.uno':
    'Missing: {faltantes} of {esperados} bill for the period, so the electricity cost you see is INCOMPLETE and the margin looks better than it will end up. A month without a bill is not a month without consumption: it is data nobody has recorded yet.',
  'reportes.nota.luz.faltan.otros':
    'Missing: {faltantes} of {esperados} bills for the period, so the electricity cost you see is INCOMPLETE and the margin looks better than it will end up. A month without a bill is not a month without consumption: it is data nobody has recorded yet.',
  'reportes.nota.luz.sin-destino.uno':
    'Also, {n} bill for {importe} does not appear in any row, because its property has no screens set up yet.',
  'reportes.nota.luz.sin-destino.otros':
    'Also, {n} bills for {importe} do not appear in any row, because their property has no screens set up yet.',
}

// ─── ITALIANO · lote L4 (2026-11-03) ────────────────────────────────────────
// Completo: el tipo es `Record<ClaveReportes, string>` y `tsc` exige cada
// clave, como en el ingles. Traducido del ESPANOL (el ingles solo como apoyo),
// con el glosario de `vault/03-Frontend/italiano-olas.md`.
//
//  · «Pantalla» en los reportes es la del inventario —digital o fija—, asi que
//    es «impianto» (glosario: «schermo» solo para la digital). La pantalla de
//    la APLICACION («escondido en otra pantalla») es «schermata».
//  · Luz = «luce» (la bolleta della luce); recibo = «bolletta».
//  · Las variantes `.una-de-varias` existen porque el sujeto es UNO de varios
//    («1 delle 3 prenotazioni … non ha»): el verbo concuerda con el uno.
//  · `reportes.nota.ot.reales.uno` no lleva cifra en el espanol («Las 1
//    visita…»): en italiano «L’unica visita…».
//  · Las fechas fijas («2026-09-28») se quedan en ISO como en espanol e ingles.
//  · `reportes.nota.luz.faltan.*` va con dos puntos, como el ingles («Mancanti:
//    1 su 3»): el plural depende de las esperadas, no de las que faltan.
export const IT_REPORTES: Record<ClaveReportes, string> = {
  'reportes.titulo': 'Report di redditività',
  'reportes.subtitulo': 'Quanto incassa e quanto costa ogni impianto nel periodo che scegli.',
  'reportes.indicadores': 'Indicatori del periodo',
  'reportes.kpi.ingreso': 'Ricavi del periodo',
  'reportes.kpi.costo-sub': 'Spazio {espacio} · Operazioni {operacion} · Luce {luz}',
  'reportes.kpi.margen': 'Margine sui ricavi',
  'reportes.kpi.margen-sub': 'Margine {monto}',
  'reportes.rango': '{desde} – {hasta}',
  'reportes.resultado': 'Risultato',
  'reportes.periodos': '{n} {periodos}',
  'reportes.periodos.palabra.uno': 'periodo',
  'reportes.periodos.palabra.otros': 'periodi',
  'reportes.error.titulo': 'Impossibile calcolare il report',
  'reportes.error.sin-mensaje': 'Impossibile calcolare il report. La richiesta non è andata a buon fine.',
  'reportes.error.red': 'Impossibile contattare il server. Controlla la connessione e riprova.',
  'reportes.invalido.titulo': 'Controlla il periodo',
  'reportes.vacio.titulo': 'Nessun movimento in questo periodo',
  'reportes.vacio.detalle':
    'Tra {desde} e {hasta} nessun impianto ha registrato ricavi, affitti né ordini di lavoro. Un impianto senza nulla di tutto ciò non compare nel report; prova con un intervallo più ampio.',
  'reportes.notas': 'Note su queste cifre ({n})',
  'reportes.inicial.titulo': 'Scegli un periodo',
  'reportes.inicial.detalle': 'Il report si calcola quando scegli le date.',
  'reportes.filtro.agrupar': 'Raggruppa',
  'reportes.filtro.desde': 'Da',
  'reportes.filtro.hasta': 'A',
  'reportes.filtro.periodos': 'Periodi',
  'reportes.dim.sitio': 'Per impianto',
  'reportes.dim.sitio.ayuda':
    'I ricavi e le tre fonti di costo di ogni impianto —spazio, operazioni e luce—. Prima il margine peggiore.',
  'reportes.dim.trimestre': 'Per trimestre',
  'reportes.dim.trimestre.ayuda': 'Come evolve l’attività: una riga per trimestre solare, in ordine cronologico.',
  'reportes.dim.operacion': 'Per operazioni',
  'reportes.dim.operacion.ayuda': 'Dove vanno i soldi nelle visite: ordini di lavoro, il loro costo e le ore sul posto.',
  'reportes.dim.m2': 'Per metro quadrato',
  'reportes.dim.m2.ayuda': 'Quale superficie statica rende. Gli impianti digitali non entrano: il loro denominatore sono gli spot.',
  'reportes.dim.luz': 'Per consumo di luce',
  'reportes.dim.luz.ayuda': 'Quali impianti divorano l’energia. La bolletta dell’immobile si ripartisce tra i suoi impianti.',
  'reportes.dim.entidad': 'Per ragione sociale',
  'reportes.dim.entidad.ayuda':
    'Quanto fattura e quanto affitto paga ciascuna delle tue ragioni sociali. Le operazioni e la luce non si ripartiscono: nessun dato dice a chi appartengono.',
  'reportes.dim.tarifa': 'Pubblicata vs netta',
  'reportes.dim.tarifa.ayuda':
    'Quale tariffa è stata pubblicata e quanto ne è entrato. Ciò che è stato venduto da Vendite non ha una tariffa pubblicata congelata ed esce con un trattino, non con uno zero.',
  'reportes.dim.vendedor': 'Per commerciale',
  'reportes.dim.vendedor.ayuda':
    'Quanto ha venduto ogni persona e quanto sconto ha concesso. Il commerciale è chi crea la proposta, e si registra dal 2026-09-28: ciò che è precedente esce in «Nessun commerciale» e non si può recuperare.',
  'reportes.gran.mes': 'Mensile',
  'reportes.gran.trimestre': 'Trimestrale',
  'reportes.motivo.sin-inicio': 'Manca la data di inizio del report',
  'reportes.motivo.sin-fin': 'Manca la data di fine del report',
  'reportes.motivo.formato': 'Usa date nel formato AAAA-MM-GG',
  'reportes.motivo.invertido': 'La data di fine non può essere precedente a quella di inizio',
  'reportes.motivo.tope': 'Il report copre al massimo 24 mesi per richiesta. Accorcia l’intervallo di date.',
  'reportes.col.pantalla': 'Impianto',
  'reportes.col.trimestre': 'Trimestre',
  'reportes.col.razon-social': 'Ragione sociale',
  'reportes.col.vendedor': 'Commerciale',
  'reportes.col.ingreso': 'Ricavi',
  'reportes.col.costo-espacio': 'Costo dello spazio',
  'reportes.col.costo-operacion': 'Costo operativo',
  'reportes.col.costo-luz': 'Costo della luce',
  'reportes.col.costo-total': 'Costo totale',
  'reportes.col.margen-bruto': 'Margine lordo',
  'reportes.col.margen-bruto-pct': 'Margine lordo %',
  'reportes.col.visitas': 'Visite',
  'reportes.col.operacion-ingreso': 'Operazioni / ricavi',
  'reportes.col.horas': 'Ore sul posto',
  'reportes.col.superficie': 'Superficie',
  'reportes.col.ingreso-m2': 'Ricavi / m²',
  'reportes.col.margen-m2': 'Margine lordo / m²',
  'reportes.col.consumo': 'Consumo',
  'reportes.col.costo-kwh': 'Costo / kWh',
  'reportes.col.saldo-atribuido': 'Saldo attribuito',
  'reportes.col.pct-facturacion': '% del fatturato',
  'reportes.col.tarifa-publicada': 'Tariffa pubblicata',
  'reportes.col.neto-comparable': 'Netto confrontabile',
  'reportes.col.descuento-comision': 'Sconto e commissione',
  'reportes.col.pct-publicada': '% sulla pubblicata',
  'reportes.desglose.periodo': 'Periodo',
  'reportes.desglose.espacio': 'Spazio',
  'reportes.desglose.operacion': 'Operazioni',
  'reportes.desglose.luz': 'Luce',
  'reportes.tabla.total': 'Totale ({n})',
  'reportes.tabla.desglose.ocultar': 'Nascondi il dettaglio per periodo',
  'reportes.tabla.desglose.ver': 'Mostra il dettaglio per periodo',
  'reportes.tabla.raya.margen-pct': 'Nessun ricavo nell’intervallo: non c’è una percentuale da calcolare',
  'reportes.tabla.raya.operacion-pct': 'Nessun ricavo nell’intervallo: non c’è una proporzione da calcolare',
  'reportes.tabla.raya.horas': 'Nessuna visita dell’intervallo ha registrati entrambi i suoi orari',
  'reportes.tabla.horas-de': 'su {n} {visitas}',
  'reportes.tabla.visitas.uno': 'visita',
  'reportes.tabla.visitas.otros': 'visite',
  'reportes.tabla.propia': 'di proprietà',
  'reportes.tabla.sin-contrato': 'senza contratto',
  'reportes.fila.sin-asignar': 'Non assegnato',
  'reportes.fila.sin-asignar.detalle': 'Nessuna ragione sociale nel dato di origine',
  'reportes.fila.sin-vendedor': 'Nessun commerciale',
  'reportes.fila.sin-vendedor.detalle': 'Campagne da Vendite e proposte precedenti al 2026-09-28',
  'reportes.cuenta.pantalla.uno': '{n} impianto',
  'reportes.cuenta.pantalla.otros': '{n} impianti',
  'reportes.cuenta.trimestre.uno': '{n} trimestre',
  'reportes.cuenta.trimestre.otros': '{n} trimestri',
  'reportes.cuenta.razon-social.uno': '{n} ragione sociale',
  'reportes.cuenta.razon-social.otros': '{n} ragioni sociali',
  'reportes.cuenta.vendedor.uno': '{n} commerciale',
  'reportes.cuenta.vendedor.otros': '{n} commerciali',
  'reportes.con-movimiento': '{cuenta} con movimenti',
  'reportes.aviso.en-curso.uno':
    'Il periodo che stai guardando comprende {etiqueta}, che è IN CORSO: è trascorso {corridos} dei suoi {totales} giorni. L’affitto degli spazi ha già maturato quel {corridos} giorno intero, ma ciò che è stato venduto si fattura alla chiusura, quindi i ricavi non sono ancora dentro e il margine risulta peggiore di quanto sarà. Non confrontarlo con un trimestre concluso.',
  'reportes.aviso.en-curso.otros':
    'Il periodo che stai guardando comprende {etiqueta}, che è IN CORSO: sono trascorsi {corridos} dei suoi {totales} giorni. L’affitto degli spazi ha già maturato quei {corridos} giorni interi, ma ciò che è stato venduto si fattura alla chiusura, quindi i ricavi non sono ancora dentro e il margine risulta peggiore di quanto sarà. Non confrontarlo con un trimestre concluso.',
  'reportes.aviso.margen-bruto':
    'Il margine di questo report è LORDO: sono i ricavi meno i costi DIRETTI dell’impianto —spazio, operazioni e luce—. NON è il margine netto, e non ci si arriva sottraendo nulla di ciò che c’è in questa tabella: al netto mancherebbero i costi indiretti (personale, ufficio, struttura) e questo sistema non ne registra nessuno. Finché non verranno registrati, il margine netto dell’attività non si può calcolare qui, e non è nascosto in un’altra schermata.',
  'reportes.aviso.m2.todas-las-caras':
    'La superficie somma TUTTE le facce di ogni impianto: uno bifacciale da 3 × 6 conta 36 m², non 18. È la superficie che si vende, e ogni impianto apporta quella delle sue facce.',
  'reportes.aviso.m2.una-cara':
    'La superficie è quella di UNA faccia: un impianto bifacciale da 3 × 6 conta 18 m², non 36. Misura la superficie del supporto e non quella che si vende, quindi gli impianti con più facce risultano meglio posizionati che se si contassero tutte.',
  'reportes.aviso.sin-contrato.uno':
    '{cuenta} non ha un contratto di locazione nel periodo: il suo costo dello spazio risulta zero perché manca il dato, non perché sia gratis, e il suo margine sembra migliore di quanto sia.',
  'reportes.aviso.sin-contrato.otros':
    '{cuenta} non hanno un contratto di locazione nel periodo: il loro costo dello spazio risulta zero perché manca il dato, non perché sia gratis, e il loro margine sembra migliore di quanto sia.',
  'reportes.aviso.sin-ingreso.trimestre.uno':
    '{cuenta} senza ricavi nell’intervallo. Compare a zero di proposito: in una serie temporale un vuoto si legge come «mancano dati» e uno zero come «non è successo nulla».',
  'reportes.aviso.sin-ingreso.trimestre.otros':
    '{cuenta} senza ricavi nell’intervallo. Compaiono a zero di proposito: in una serie temporale un vuoto si legge come «mancano dati» e uno zero come «non è successo nulla».',
  'reportes.aviso.sin-ingreso.uno':
    '{cuenta} ha avuto costi senza vendere nulla nel periodo, quindi non ha un margine percentuale (la colonna mostra «—»).',
  'reportes.aviso.sin-ingreso.otros':
    '{cuenta} hanno avuto costi senza vendere nulla nel periodo, quindi non hanno un margine percentuale (la colonna mostra «—»).',
  'reportes.nota.ot.sin-visitas':
    'Non c’è stata nessuna visita in questo periodo, quindi il costo operativo è zero perché non si è andati a nessun impianto, non perché manchi da registrarlo.',
  'reportes.nota.ot.intro':
    'Il costo operativo si compone di due fonti e NON sono la stessa cosa: quanto è costata davvero ogni visita, quando qualcuno l’ha registrato nel suo ordine di lavoro, e una STIMA per tipo di ordine —quella di Configurazione— quando no. La stima addebita allo stesso modo un lavoro di carpenteria metallica da {caro} e uno da {barato}.',
  'reportes.nota.ot.estimacion.uno':
    '{estimadas} su {total} visita del periodo entra con la stima per tipo ({estimado}) e {reales} con il suo costo reale ({capturado}). Quella parte del costo —e il margine che ne deriva— è una stima, non una misura: registrare il costo nell’ordine di lavoro la sostituisce.',
  'reportes.nota.ot.estimacion.una-de-varias':
    '{estimadas} delle {total} visite del periodo entra con la stima per tipo ({estimado}) e {reales} con il loro costo reale ({capturado}). Quella parte del costo —e il margine che ne deriva— è una stima, non una misura: registrare il costo nell’ordine di lavoro la sostituisce.',
  'reportes.nota.ot.estimacion.otros':
    '{estimadas} delle {total} visite del periodo entrano con la stima per tipo ({estimado}) e {reales} con il loro costo reale ({capturado}). Quella parte del costo —e il margine che ne deriva— è una stima, non una misura: registrare il costo nell’ordine di lavoro la sostituisce.',
  'reportes.nota.ot.reales.uno':
    'L’unica visita del periodo è al suo costo REALE registrato ({capturado}): qui non c’è nessuna stima, il costo operativo che vedi è quello che è stato pagato.',
  'reportes.nota.ot.reales.otros':
    'Tutte le {total} visite del periodo sono al loro costo REALE registrato ({capturado}): qui non c’è nessuna stima, il costo operativo che vedi è quello che è stato pagato.',
  'reportes.nota.m2.ninguna':
    'Non è stato escluso nessun impianto: tutti quelli con movimenti sono statici e hanno le misure registrate.',
  'reportes.nota.m2.fuera': 'Sono rimasti fuori dalla classifica: {partes}.',
  'reportes.nota.m2.digitales.uno':
    '{n} impianto digitale o rotativo, perché il suo denominatore corretto sono gli spot e non i metri',
  'reportes.nota.m2.digitales.otros':
    '{n} impianti digitali o rotativi, perché il loro denominatore corretto sono gli spot e non i metri',
  'reportes.nota.m2.sin-medidas.uno': '{n} statico senza larghezza o altezza registrate',
  'reportes.nota.m2.sin-medidas.otros': '{n} statici senza larghezza o altezza registrate',
  'reportes.nota.entidad.intro':
    'Le operazioni ({operacion}) e la luce ({luz}) NON si ripartiscono tra ragioni sociali: nessun dato dice a nome di chi si pagano. Per questo questa vista non mostra il margine — risulterebbe migliore di quello reale.',
  'reportes.nota.entidad.sin-emisora.uno':
    '{n} prenotazione del periodo senza ricevuta con emittente: i suoi ricavi escono in «Non assegnato».',
  'reportes.nota.entidad.sin-emisora.otros':
    '{n} prenotazioni del periodo senza ricevuta con emittente: i loro ricavi escono in «Non assegnato».',
  'reportes.nota.entidad.sin-entidad.uno':
    '{n} contratto senza ragione sociale assegnata: il suo affitto esce in «Non assegnato».',
  'reportes.nota.entidad.sin-entidad.otros':
    '{n} contratti senza ragione sociale assegnata: il loro affitto esce in «Non assegnato».',
  'reportes.nota.tarifa.intro':
    'La differenza tra la tariffa pubblicata e il netto è lo sconto commerciale PIÙ la commissione d’agenzia: i due si congelano insieme nella proposta e il dato non li separa per impianto.',
  'reportes.nota.tarifa.sin-tarifa.uno':
    '{sin} su {total} prenotazione del periodo non ha una tariffa pubblicata con cui confrontarla ({ingreso} di ricavi): o è nata in Vendite —dove il prezzo salvato È GIÀ la tariffa di listino— o il suo prezzo non coincide con il netto congelato dalla sua proposta. Quelle righe escono con un trattino e non con uno zero: uno zero direbbe che è stata regalata l’intera tariffa.',
  'reportes.nota.tarifa.sin-tarifa.una-de-varias':
    '{sin} delle {total} prenotazioni del periodo non ha una tariffa pubblicata con cui confrontarla ({ingreso} di ricavi): o è nata in Vendite —dove il prezzo salvato È GIÀ la tariffa di listino— o il suo prezzo non coincide con il netto congelato dalla sua proposta. Quelle righe escono con un trattino e non con uno zero: uno zero direbbe che è stata regalata l’intera tariffa.',
  'reportes.nota.tarifa.sin-tarifa.otros':
    '{sin} delle {total} prenotazioni del periodo non hanno una tariffa pubblicata con cui confrontarle ({ingreso} di ricavi): o sono nate in Vendite —dove il prezzo salvato È GIÀ la tariffa di listino— o il loro prezzo non coincide con il netto congelato dalla loro proposta. Quelle righe escono con un trattino e non con uno zero: uno zero direbbe che è stata regalata l’intera tariffa.',
  'reportes.nota.vendedor.intro':
    'La differenza tra la tariffa pubblicata e il netto è lo sconto commerciale PIÙ la commissione d’agenzia: i due si congelano insieme nella proposta e il dato non li separa. Non è tutto uno sconto concesso dal commerciale.',
  'reportes.nota.vendedor.sin-propuesta':
    '{n} da campagne create direttamente in Vendite, che non hanno mai avuto una proposta e quindi non hanno nessuno a cui essere attribuite',
  'reportes.nota.vendedor.historicas':
    '{n} da proposte precedenti al 2026-09-28, quando non si registrava ancora chi le creava: quel dato NON SI PUÒ RECUPERARE —il registro salva il nome della proposta, non il suo identificativo— quindi quelle vendite restano senza commerciale per sempre',
  'reportes.nota.vendedor.sin-vendedor.uno':
    '{sin} su {total} prenotazione del periodo esce in «Nessun commerciale» ({ingreso} di ricavi): {causas}.',
  'reportes.nota.vendedor.sin-vendedor.una-de-varias':
    '{sin} delle {total} prenotazioni del periodo esce in «Nessun commerciale» ({ingreso} di ricavi): {causas}.',
  'reportes.nota.vendedor.sin-vendedor.otros':
    '{sin} delle {total} prenotazioni del periodo escono in «Nessun commerciale» ({ingreso} di ricavi): {causas}.',
  'reportes.nota.vendedor.raya':
    'Quelle righe escono con un trattino e non con uno zero: uno zero in «Sconto e commissione» affermerebbe che non ne è stato concesso nessuno.',
  'reportes.nota.luz.sin-esperados': 'Non sono previste bollette della luce in questo periodo.',
  'reportes.nota.luz.completa.uno':
    'Non manca nessuna bolletta: risulta registrata {esperados} bolletta attesa nel periodo, quindi il costo della luce è completo.',
  'reportes.nota.luz.completa.otros':
    'Non manca nessuna bolletta: risultano registrate tutte le {esperados} bollette attese nel periodo, quindi il costo della luce è completo.',
  'reportes.nota.luz.faltan.uno':
    'Mancanti: {faltantes} su {esperados} bolletta del periodo, quindi il costo della luce che vedi è INCOMPLETO e il margine risulta migliore di quanto sarà. Un mese senza bolletta non è un mese senza consumo: è un dato che nessuno ha ancora registrato.',
  'reportes.nota.luz.faltan.otros':
    'Mancanti: {faltantes} su {esperados} bollette del periodo, quindi il costo della luce che vedi è INCOMPLETO e il margine risulta migliore di quanto sarà. Un mese senza bolletta non è un mese senza consumo: è un dato che nessuno ha ancora registrato.',
  'reportes.nota.luz.sin-destino.uno':
    'Inoltre, {n} bolletta da {importe} non compare in nessuna riga, perché il suo immobile non ha ancora impianti registrati.',
  'reportes.nota.luz.sin-destino.otros':
    'Inoltre, {n} bollette da {importe} non compaiono in nessuna riga, perché i loro immobili non hanno ancora impianti registrati.',
}
