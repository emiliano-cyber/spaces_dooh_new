// ============================================================================
//  lib/i18n/textos/energia.ts — LOS TEXTOS DE CONSUMO DE LUZ (`/energia`).
// ----------------------------------------------------------------------------
//  3.ª oleada del ingles (2026-11-02), lote «operaciones (parte 2)». Mismas
//  reglas que `textos/propuestas.ts`: claves en espanol, espanol LITERAL,
//  `EN_ENERGIA` como `Record`, ni dinero ni moneda, frases enteras con huecos.
//
//  SOLO LA INTERFAZ. La lectura de los recibos de CFE, sus cifras y la moneda
//  no se tocan. `energia.motivo.*`, `energia.cobertura.*`, `energia.borrado.*`
//  y `energia.lectura.*` son los textos de `components/demo/energia/captura.ts`
//  y `recibos.ts`, que ganaron `idioma` con 'es' por omision: el espanol es el
//  literal de alli (lo ata `textos/energia.test.ts`). Los avisos que manda el
//  SERVIDOR sobre cada PDF siguen en espanol (I18N-05).
//
//  GLOSARIO de este archivo (decision del agente): recibo de luz → electricity
//  bill · consumo → consumption · predio → property · medidor → meter ·
//  numero de servicio → service number · punto de medicion → metering point ·
//  pantalla suelta → standalone screen · capturar → enter · hueco → gap ·
//  tanda → batch · renglon → row · alumbrado publico → street lighting ·
//  adeudos → past-due balances · recibo BIMESTRAL → bill issued EVERY TWO
//  MONTHS (las periodicidades van en letra; «bimonthly» es ambiguo).
//  El titulo de la pagina es el del menu (`nav.energia`, «Power usage»).
// ============================================================================

export const ES_ENERGIA = {
  // ── La pagina ──
  'energia.descripcion': 'Un recibo por predio y por mes. Se reparte entre sus pantallas igual que la renta.',
  'energia.error.cargar': 'No se pudo cargar la captura de consumos',
  'energia.error.contactar': 'No se pudo contactar al servidor. Revisa la conexión y vuelve a intentar.',
  'energia.error.guardar-recibo': 'No se pudo guardar el recibo',
  'energia.error.borrar-recibo': 'No se pudo borrar el recibo',
  'energia.capturar': 'Capturar un recibo',
  'energia.cargando-puntos': 'Cargando los puntos de medición…',
  'energia.sin-donde-abajo': 'No hay dónde capturar todavía: el motivo está abajo.',
  'energia.cobertura.titulo': 'Qué está capturado y qué falta',
  'energia.meses.uno': '{n} mes',
  'energia.meses.otros': '{n} meses',
  'energia.puntos.uno': '{n} punto',
  'energia.puntos.otros': '{n} puntos',
  'energia.resumen': '{meses} · {puntos}',
  'energia.vacio.error': 'No se pudo cargar la captura',
  'energia.vacio.periodo': 'Revisa el periodo',
  'energia.vacio.sin-puntos': 'Todavía no hay dónde capturar',
  'energia.vacio.sin-puntos-detalle':
    'Un recibo de luz cuelga de un predio con pantallas, o de una pantalla sin predio. Da de alta el inventario y esta pantalla se llena sola.',

  // ── Indicadores ──
  'energia.kpi.capturados': 'Recibos capturados',
  'energia.kpi.no-cargar': 'no se pudo cargar',
  'energia.kpi.faltan': 'Faltan',
  'energia.kpi.importe': 'Importe del periodo',
  'energia.kpi.kwh': 'kWh del periodo',
  'energia.kpi.de': '{a} de {b}',
  'energia.kpi.del-periodo': 'del periodo',
  'energia.kpi.menos-luz': 'el reporte enseña menos luz de la real',
  'energia.kpi.completa': 'captura completa',
  'energia.kpi.solo-capturado': 'solo lo capturado',
  'energia.kpi.sin-pantalla.uno': 'solo lo capturado · {n} recibo sin pantalla',
  'energia.kpi.sin-pantalla.otros': 'solo lo capturado · {n} recibos sin pantalla',

  // ── Formulario y rejilla ──
  'energia.predio-o-pantalla': 'Predio o pantalla',
  'energia.opcion.pantallas.uno': ' · {n} pantalla',
  'energia.opcion.pantallas.otros': ' · {n} pantallas',
  'energia.opcion.suelta': ' · pantalla suelta',
  'energia.mes-recibo': 'Mes del recibo',
  'energia.medidor': 'Medidor',
  'energia.importe': 'Importe',
  'energia.guardar-recibo': 'Guardar recibo',
  'energia.rejilla.faltan': 'Faltan',
  'energia.rejilla.pantallas.uno': '{n} pantalla',
  'energia.rejilla.pantallas.otros': '{n} pantallas',
  'energia.rejilla.suelta': 'Pantalla suelta',
  'energia.rejilla.hueco': 'Sin recibo capturado: no es un consumo de cero, es un dato que falta',
  'energia.rejilla.borrar-este': 'Borrar este recibo',
  'energia.rejilla.borrar-aria': 'Borrar el recibo del medidor {medidor}',
  'energia.rejilla.borrar': 'Borrar el recibo',
  'energia.sin-numero': 'sin número',

  // ── Subir PDF ──
  'energia.subir.error-leer': 'No se pudieron leer los archivos',
  'energia.subir.no-guardar': 'No se pudo guardar',
  'energia.subir.no-contactar': 'No se pudo contactar al servidor',
  'energia.subir.pregunta': '1 · ¿Cuántos meses de calendario cubre cada recibo de esta tanda?',
  'energia.subir.elige-antes': '— elige antes de subir —',
  'energia.subir.opcion.1': '1 mes de calendario — un periodo corto, dentro de un solo mes',
  'energia.subir.opcion.2': '2 meses de calendario — lo normal en un recibo MENSUAL',
  'energia.subir.opcion.3': '3 meses de calendario — lo normal en un recibo BIMESTRAL',
  'energia.subir.opcion.4': '4 meses de calendario — un periodo largo o atrasado',
  'energia.subir.explica':
    'Se cuentan los meses de calendario que {toca} el periodo, no lo que dura. Un recibo mensual empieza a mitad de mes, así que casi siempre toca {dos}; uno bimestral, {tres}. Si mezclas mensuales y bimestrales en la misma tanda, muchos saldrán marcados: súbelos por separado.',
  'energia.subir.toca': 'toca',
  'energia.subir.dos': 'dos',
  'energia.subir.tres': 'tres',
  'energia.subir.leyendo': 'Leyendo…',
  'energia.subir.subir': '2 · Subir PDF del recibo',
  'energia.subir.elige-arriba': 'Elige arriba cuántos meses esperas antes de subir los archivos.',
  'energia.subir.se-leen': 'Se leen en el servidor y no se guarda nada: revisa cada renglón contra el recibo y confírmalo.',
  'energia.subir.col.mes': 'Mes',
  'energia.subir.col.dias': 'Días',
  'energia.subir.elige': '— elige —',
  'energia.subir.escribelo': 'escríbelo',
  'energia.subir.guardado': 'Guardado',
  'energia.subir.guardando': 'Guardando…',
  'energia.subir.guardar': 'Guardar',
  'energia.subir.declaraste.uno': 'Declaraste {n} mes y este recibo cubre {pdf}. Se repartió según el PDF.',
  'energia.subir.declaraste.otros': 'Declaraste {n} meses y este recibo cubre {pdf}. Se repartió según el PDF.',
  'energia.subir.ya-capturado': 'Ya hay uno capturado en {mes}: {kwh} kWh por {monto}. Guardar otra vez DUPLICA el costo de ese mes.',

  // ── components/demo/energia/captura.ts ──
  'energia.motivo.falta-inicio': 'Falta el mes de inicio',
  'energia.motivo.falta-fin': 'Falta el mes de fin',
  'energia.motivo.formato': 'Usa fechas con formato AAAA-MM-DD',
  'energia.motivo.orden': 'El mes de fin no puede ser anterior al de inicio',
  'energia.motivo.punto': 'Elige a qué predio o pantalla corresponde el recibo',
  'energia.motivo.mes': 'Elige el mes del recibo',
  'energia.motivo.kwh.falta': 'Captura los kWh del recibo',
  'energia.motivo.importe.falta': 'Captura el importe del recibo',
  'energia.motivo.kwh.numero': 'los kWh tiene que ser un número',
  'energia.motivo.importe.numero': 'el importe tiene que ser un número',
  'energia.motivo.kwh.mayor': 'los kWh tiene que ser mayor que cero',
  'energia.motivo.importe.mayor': 'el importe tiene que ser mayor que cero',
  'energia.motivo.futuro': 'Ese mes todavía no ha terminado: no puede haber recibo',
  'energia.cobertura.huerfanos.uno':
    '{n} recibo capturado por {monto} no llega a ninguna pantalla, porque su predio no tiene ninguna dada de alta. Ese dinero no aparece en el reporte de rentabilidad.',
  'energia.cobertura.huerfanos.otros':
    '{n} recibos capturados por {monto} no llegan a ninguna pantalla, porque su predio no tiene ninguna dada de alta. Ese dinero no aparece en el reporte de rentabilidad.',
  'energia.cobertura.sin-puntos':
    'Todavía no hay dónde capturar recibos: hace falta al menos un predio con pantallas, o una pantalla sin predio.',
  'energia.cobertura.completa.uno':
    'Captura completa: están los {n} recibos del periodo. El costo de la luz del reporte de rentabilidad es el total de verdad.',
  'energia.cobertura.completa.otros':
    'Captura completa: están los {n} recibos del periodo. El costo de la luz del reporte de rentabilidad es el total de verdad.',
  'energia.cobertura.faltan':
    'Faltan {faltan} de {esperados} recibos del periodo. Mientras falten, el reporte de rentabilidad suma solo lo capturado y enseña un costo de luz MENOR del real, sin avisar de nada: un mes sin recibo no es un mes sin consumo.',
  'energia.borrado.confirmacion':
    'Se borra el recibo del medidor {medidor}, de {mes}, por {monto}. No se puede deshacer: ese mes vuelve a contar como un hueco, y hasta que lo captures otra vez el reporte de rentabilidad enseñará un costo de luz menor del real.',

  // ── components/demo/energia/recibos.ts ──
  'energia.lectura.punto': 'Elige a qué predio o pantalla corresponde este recibo',
  'energia.lectura.kwh.falta': 'Escribe los kWh: no se pudieron leer del PDF',
  'energia.lectura.importe.falta': 'Escribe el importe: no se pudieron leer del PDF',
  'energia.lectura.no-recibo.uno': '{n} archivo no es un recibo de CFE',
  'energia.lectura.no-recibo.otros': '{n} archivos no son un recibo de CFE',
  'energia.lectura.desajuste.uno': '{n} no coincide con los {esperados} meses que declaraste',
  'energia.lectura.desajuste.otros': '{n} no coinciden con los {esperados} meses que declaraste',
  'energia.lectura.cubre.uno': '{base}: cubre {unico} meses de calendario',
  'energia.lectura.cubre.otros': '{base}: los {n} cubren {unico} meses de calendario',
  'energia.lectura.sin-predio': '{n} sin predio: eligelo tú',
  'energia.lectura.sin-cifra': '{n} con una cifra que no se pudo leer',
  'energia.lectura.repetidos': '{n} ya capturados: volver a guardarlos DUPLICA el costo',
  'energia.lectura.alerta': 'Se leyeron {leidos} de {total} archivos y salen {filas} renglones. Revisa antes de confirmar: {pegas}.',
  'energia.lectura.ninguno': 'No salió ningún renglón de estos archivos.',
  'energia.lectura.ok.uno':
    'Se leyeron los {total} {archivos} y salen {filas} {renglones}. Míralos contra el recibo y confírmalos: nada se guarda hasta que le des a guardar.',
  'energia.lectura.ok.otros':
    'Se leyeron los {total} {archivos} y salen {filas} {renglones}. Míralos contra el recibo y confírmalos: nada se guarda hasta que le des a guardar.',
  'energia.lectura.archivo.uno': 'archivo',
  'energia.lectura.archivo.otros': 'archivos',
  'energia.lectura.renglon.uno': 'renglón',
  'energia.lectura.renglon.otros': 'renglones',
  'energia.leido.servicio': 'servicio {n}',
  'energia.leido.medidor': 'medidor {n}',
  'energia.leido.periodo': 'periodo {desde} → {hasta}',
  'energia.leido.pdf-dice': 'el PDF dice {kwh} kWh',
  'energia.leido.facturacion': 'facturación {monto}',
  'energia.leido.alumbrado': 'alumbrado {monto}',
  'energia.leido.total': 'Total del recibo {monto} (incluye adeudos y pagos)',
} as const

export type ClaveEnergia = keyof typeof ES_ENERGIA

export const EN_ENERGIA: Record<ClaveEnergia, string> = {
  'energia.descripcion': 'One bill per property per month. It is split among its screens the same way as the rent.',
  'energia.error.cargar': 'Could not load the consumption entries',
  'energia.error.contactar': 'Could not reach the server. Check your connection and try again.',
  'energia.error.guardar-recibo': 'Could not save the bill',
  'energia.error.borrar-recibo': 'Could not delete the bill',
  'energia.capturar': 'Enter a bill',
  'energia.cargando-puntos': 'Loading the metering points…',
  'energia.sin-donde-abajo': 'There is nowhere to enter bills yet: the reason is below.',
  'energia.cobertura.titulo': 'What’s entered and what’s missing',
  'energia.meses.uno': '{n} month',
  'energia.meses.otros': '{n} months',
  'energia.puntos.uno': '{n} metering point',
  'energia.puntos.otros': '{n} metering points',
  'energia.resumen': '{meses} · {puntos}',
  'energia.vacio.error': 'Could not load the entries',
  'energia.vacio.periodo': 'Check the period',
  'energia.vacio.sin-puntos': 'Nowhere to enter bills yet',
  'energia.vacio.sin-puntos-detalle':
    'An electricity bill belongs to a property with screens, or to a screen with no property. Set up the inventory and this page fills itself in.',

  'energia.kpi.capturados': 'Bills entered',
  'energia.kpi.no-cargar': 'could not be loaded',
  'energia.kpi.faltan': 'Missing',
  'energia.kpi.importe': 'Period amount',
  'energia.kpi.kwh': 'Period kWh',
  'energia.kpi.de': '{a} of {b}',
  'energia.kpi.del-periodo': 'in the period',
  'energia.kpi.menos-luz': 'the report shows less electricity than the real figure',
  'energia.kpi.completa': 'all entered',
  'energia.kpi.solo-capturado': 'entered only',
  'energia.kpi.sin-pantalla.uno': 'entered only · {n} bill with no screen',
  'energia.kpi.sin-pantalla.otros': 'entered only · {n} bills with no screen',

  'energia.predio-o-pantalla': 'Property or screen',
  'energia.opcion.pantallas.uno': ' · {n} screen',
  'energia.opcion.pantallas.otros': ' · {n} screens',
  'energia.opcion.suelta': ' · standalone screen',
  'energia.mes-recibo': 'Bill month',
  'energia.medidor': 'Meter',
  'energia.importe': 'Amount',
  'energia.guardar-recibo': 'Save bill',
  'energia.rejilla.faltan': 'Missing',
  'energia.rejilla.pantallas.uno': '{n} screen',
  'energia.rejilla.pantallas.otros': '{n} screens',
  'energia.rejilla.suelta': 'Standalone screen',
  'energia.rejilla.hueco': 'No bill entered: this is not zero consumption, it is missing data',
  'energia.rejilla.borrar-este': 'Delete this bill',
  'energia.rejilla.borrar-aria': 'Delete the bill for meter {medidor}',
  'energia.rejilla.borrar': 'Delete the bill',
  'energia.sin-numero': '(no number)',

  'energia.subir.error-leer': 'Could not read the files',
  'energia.subir.no-guardar': 'Could not save',
  'energia.subir.no-contactar': 'Could not reach the server',
  'energia.subir.pregunta': '1 · How many calendar months does each bill in this batch cover?',
  'energia.subir.elige-antes': '— choose before uploading —',
  'energia.subir.opcion.1': '1 calendar month — a short period, within a single month',
  'energia.subir.opcion.2': '2 calendar months — the usual for a MONTHLY bill',
  'energia.subir.opcion.3': '3 calendar months — the usual for a bill issued EVERY TWO MONTHS',
  'energia.subir.opcion.4': '4 calendar months — a long or late period',
  'energia.subir.explica':
    'Count the calendar months the period {toca}, not how long it lasts. A monthly bill starts mid-month, so it almost always touches {dos}; one issued every two months, {tres}. If you mix monthly bills and bills issued every two months in the same batch, many will be flagged: upload them separately.',
  'energia.subir.toca': 'touches',
  'energia.subir.dos': 'two',
  'energia.subir.tres': 'three',
  'energia.subir.leyendo': 'Reading…',
  'energia.subir.subir': '2 · Upload the bill PDF',
  'energia.subir.elige-arriba': 'Choose above how many months you expect before uploading the files.',
  'energia.subir.se-leen': 'They are read on the server and nothing is saved: check each row against the bill and confirm it.',
  'energia.subir.col.mes': 'Month',
  'energia.subir.col.dias': 'Days',
  'energia.subir.elige': '— choose —',
  'energia.subir.escribelo': 'type it',
  'energia.subir.guardado': 'Saved',
  'energia.subir.guardando': 'Saving…',
  'energia.subir.guardar': 'Save',
  'energia.subir.declaraste.uno': 'You declared {n} month and this bill covers {pdf}. It was split according to the PDF.',
  'energia.subir.declaraste.otros': 'You declared {n} months and this bill covers {pdf}. It was split according to the PDF.',
  'energia.subir.ya-capturado': 'One is already entered for {mes}: {kwh} kWh for {monto}. Saving again DOUBLES that month’s cost.',

  'energia.motivo.falta-inicio': 'The start month is missing',
  'energia.motivo.falta-fin': 'The end month is missing',
  'energia.motivo.formato': 'Use dates in YYYY-MM-DD format',
  'energia.motivo.orden': 'The end month cannot be before the start month',
  'energia.motivo.punto': 'Choose which property or screen the bill belongs to',
  'energia.motivo.mes': 'Choose the bill month',
  'energia.motivo.kwh.falta': 'Enter the bill’s kWh',
  'energia.motivo.importe.falta': 'Enter the bill amount',
  'energia.motivo.kwh.numero': 'The kWh must be a number',
  'energia.motivo.importe.numero': 'The amount must be a number',
  'energia.motivo.kwh.mayor': 'The kWh must be greater than zero',
  'energia.motivo.importe.mayor': 'The amount must be greater than zero',
  'energia.motivo.futuro': 'That month hasn’t ended yet: there can’t be a bill for it',
  'energia.cobertura.huerfanos.uno':
    '{n} entered bill for {monto} doesn’t reach any screen, because its property has none set up. That money does not appear in the profitability report.',
  'energia.cobertura.huerfanos.otros':
    '{n} entered bills for {monto} don’t reach any screen, because their property has none set up. That money does not appear in the profitability report.',
  'energia.cobertura.sin-puntos':
    'There is nowhere to enter bills yet: you need at least one property with screens, or a screen with no property.',
  'energia.cobertura.completa.uno':
    'All entered: the period’s {n} bill is in. The electricity cost in the profitability report is the real total.',
  'energia.cobertura.completa.otros':
    'All entered: all {n} bills for the period are in. The electricity cost in the profitability report is the real total.',
  'energia.cobertura.faltan':
    '{faltan} of {esperados} bills for the period are missing. Until they are entered, the profitability report adds up only what has been entered and shows an electricity cost LOWER than the real one, with no warning: a month with no bill is not a month with no consumption.',
  'energia.borrado.confirmacion':
    'This deletes the bill for meter {medidor}, for {mes}, for {monto}. It cannot be undone: that month counts as a gap again, and until you enter it again the profitability report will show an electricity cost lower than the real one.',

  'energia.lectura.punto': 'Choose which property or screen this bill belongs to',
  'energia.lectura.kwh.falta': 'Enter the kWh: they could not be read from the PDF',
  'energia.lectura.importe.falta': 'Enter the amount: it could not be read from the PDF',
  'energia.lectura.no-recibo.uno': '{n} file is not a CFE bill',
  'energia.lectura.no-recibo.otros': '{n} files are not CFE bills',
  'energia.lectura.desajuste.uno': '{n} doesn’t match the number of months you declared ({esperados})',
  'energia.lectura.desajuste.otros': '{n} don’t match the number of months you declared ({esperados})',
  'energia.lectura.cubre.uno': '{base}: the number of calendar months it covers is {unico}',
  'energia.lectura.cubre.otros': '{base}: the number of calendar months covered by those {n} is {unico}',
  'energia.lectura.sin-predio': '{n} with no property: choose it yourself',
  'energia.lectura.sin-cifra': '{n} with a figure that could not be read',
  'energia.lectura.repetidos': '{n} already entered: saving them again DOUBLES the cost',
  'energia.lectura.alerta': 'Files read: {leidos} of {total}; rows: {filas}. Check before confirming: {pegas}.',
  'energia.lectura.ninguno': 'These files produced no rows.',
  'energia.lectura.ok.uno':
    '{total} {archivos} was read and it produces {filas} {renglones}. Check each row against the bill and confirm it: nothing is saved until you click save.',
  'energia.lectura.ok.otros':
    '{total} {archivos} were read and they produce {filas} {renglones}. Check them against the bill and confirm them: nothing is saved until you click save.',
  'energia.lectura.archivo.uno': 'file',
  'energia.lectura.archivo.otros': 'files',
  'energia.lectura.renglon.uno': 'row',
  'energia.lectura.renglon.otros': 'rows',
  'energia.leido.servicio': 'service {n}',
  'energia.leido.medidor': 'meter {n}',
  'energia.leido.periodo': 'period {desde} → {hasta}',
  'energia.leido.pdf-dice': 'the PDF says {kwh} kWh',
  'energia.leido.facturacion': 'period charges {monto}',
  'energia.leido.alumbrado': 'street lighting {monto}',
  'energia.leido.total': 'Bill total {monto} (includes past-due balances and payments)',
}

// ─── ITALIANO · ola 0 (2026-11-03) ──────────────────────────────────────────
// PARCIAL a proposito: lo rellena el lote de traduccion de este ambito
// (`vault/03-Frontend/italiano-olas.md`). Mientras falte una clave, la
// pantalla la pinta en INGLES (`diccionario.ts`, `DICCIONARIOS.it`) y la
// prueba de cobertura (`cobertura-italiano.test.ts`) la cuenta como pendiente.
// Cuando el lote termine, el tipo pasa a `Record<ClaveEnergia, string>` y `tsc`
// vuelve a exigir cada clave, como en el ingles.
export const IT_ENERGIA: Partial<Record<ClaveEnergia, string>> = {}
