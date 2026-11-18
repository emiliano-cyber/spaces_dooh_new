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

// ─── ITALIANO · lote L1 «Space Eyes y luz» (2026-11-03) ─────────────────────
// COMPLETO: el tipo es `Record<ClaveEnergia, string>` y `tsc` exige cada clave,
// como en el ingles. Se traduce desde el ESPANOL (el original), con el ingles
// solo de apoyo. Registro de tu, mayuscula solo al inicio, apostrofo
// tipografico (’), comillas « » y sin espacio antes de «%». Las cifras con
// decimales del texto van con coma («0,5x», «1,5 MB»); el dinero, las fechas y
// las cifras de datos las pone el formato por idioma (`formato-idioma.ts`).
//
// GLOSARIO DEL LOTE (decision del traductor; el dueño puede cambiarla):
// recibo de luz → bolletta (della luce) · predio → immobile · pantalla →
// impianto (inventario) · pantalla suelta → impianto isolato · medidor →
// contatore · punto de medicion → punto di prelievo (POD) · capturar → registrare /
// inserire · hueco → buco / dato mancante · tanda → lotto · renglon → riga ·
// alumbrado publico → illuminazione pubblica · adeudos → arretrati · recibo
// BIMESTRAL → bolletta emessa OGNI DUE MESI (periodicidad en letra) · reporte
// de rentabilidad → report di redditività · archivo → file.
export const IT_ENERGIA: Record<ClaveEnergia, string> = {
  // ── La pagina ──
  'energia.descripcion': 'Una bolletta per immobile e per mese. Si ripartisce tra i suoi impianti come l’affitto.',
  'energia.error.cargar': 'Impossibile caricare i consumi registrati',
  'energia.error.contactar': 'Impossibile contattare il server. Controlla la connessione e riprova.',
  'energia.error.guardar-recibo': 'Impossibile salvare la bolletta',
  'energia.error.borrar-recibo': 'Impossibile eliminare la bolletta',
  'energia.capturar': 'Registra una bolletta',
  'energia.cargando-puntos': 'Caricamento dei punti di prelievo (POD)…',
  'energia.sin-donde-abajo': 'Non c’è ancora dove registrare bollette: il motivo è qui sotto.',
  'energia.cobertura.titulo': 'Cosa è registrato e cosa manca',
  'energia.meses.uno': '{n} mese',
  'energia.meses.otros': '{n} mesi',
  'energia.puntos.uno': '{n} punto di prelievo',
  'energia.puntos.otros': '{n} punti di prelievo',
  'energia.resumen': '{meses} · {puntos}',
  'energia.vacio.error': 'Impossibile caricare le registrazioni',
  'energia.vacio.periodo': 'Controlla il periodo',
  'energia.vacio.sin-puntos': 'Non c’è ancora dove registrare bollette',
  'energia.vacio.sin-puntos-detalle':
    'Una bolletta della luce appartiene a un immobile con impianti, o a un impianto senza immobile. Registra l’inventario e questa pagina si riempie da sola.',

  // ── Indicadores ──
  'energia.kpi.capturados': 'Bollette registrate',
  'energia.kpi.no-cargar': 'impossibile caricare',
  'energia.kpi.faltan': 'Mancanti',
  'energia.kpi.importe': 'Importo del periodo',
  'energia.kpi.kwh': 'kWh del periodo',
  'energia.kpi.de': '{a} di {b}',
  'energia.kpi.del-periodo': 'del periodo',
  'energia.kpi.menos-luz': 'il report mostra meno elettricità di quella reale',
  'energia.kpi.completa': 'registrazione completa',
  'energia.kpi.solo-capturado': 'solo il registrato',
  'energia.kpi.sin-pantalla.uno': 'solo il registrato · {n} bolletta senza impianto',
  'energia.kpi.sin-pantalla.otros': 'solo il registrato · {n} bollette senza impianto',

  // ── Formulario y rejilla ──
  'energia.predio-o-pantalla': 'Immobile o impianto',
  'energia.opcion.pantallas.uno': ' · {n} impianto',
  'energia.opcion.pantallas.otros': ' · {n} impianti',
  'energia.opcion.suelta': ' · impianto isolato',
  'energia.mes-recibo': 'Mese della bolletta',
  'energia.medidor': 'Contatore',
  'energia.importe': 'Importo',
  'energia.guardar-recibo': 'Salva bolletta',
  'energia.rejilla.faltan': 'Mancanti',
  'energia.rejilla.pantallas.uno': '{n} impianto',
  'energia.rejilla.pantallas.otros': '{n} impianti',
  'energia.rejilla.suelta': 'Impianto isolato',
  'energia.rejilla.hueco': 'Nessuna bolletta registrata: non è un consumo pari a zero, è un dato mancante',
  'energia.rejilla.borrar-este': 'Elimina questa bolletta',
  'energia.rejilla.borrar-aria': 'Elimina la bolletta del contatore {medidor}',
  'energia.rejilla.borrar': 'Elimina la bolletta',
  'energia.sin-numero': '(senza numero)',

  // ── Subir PDF ──
  'energia.subir.error-leer': 'Impossibile leggere i file',
  'energia.subir.no-guardar': 'Impossibile salvare',
  'energia.subir.no-contactar': 'Impossibile contattare il server',
  'energia.subir.pregunta': '1 · Quanti mesi di calendario copre ogni bolletta di questo lotto?',
  'energia.subir.elige-antes': '— scegli prima di caricare —',
  'energia.subir.opcion.1': '1 mese di calendario — un periodo breve, dentro un solo mese',
  'energia.subir.opcion.2': '2 mesi di calendario — il caso normale per una bolletta MENSILE',
  'energia.subir.opcion.3': '3 mesi di calendario — il caso normale per una bolletta emessa OGNI DUE MESI',
  'energia.subir.opcion.4': '4 mesi di calendario — un periodo lungo o arretrato',
  'energia.subir.explica':
    'Si contano i mesi di calendario che il periodo {toca}, non quanto dura. Una bolletta mensile inizia a metà mese, quindi quasi sempre ne tocca {dos}; una emessa ogni due mesi, {tres}. Se mescoli bollette mensili e bollette emesse ogni due mesi nello stesso lotto, molte risulteranno segnalate: caricale separatamente.',
  'energia.subir.toca': 'tocca',
  'energia.subir.dos': 'due',
  'energia.subir.tres': 'tre',
  'energia.subir.leyendo': 'Lettura…',
  'energia.subir.subir': '2 · Carica il PDF della bolletta',
  'energia.subir.elige-arriba': 'Scegli qui sopra quanti mesi ti aspetti prima di caricare i file.',
  'energia.subir.se-leen': 'Vengono letti sul server e non si salva nulla: controlla ogni riga con la bolletta e confermala.',
  'energia.subir.col.mes': 'Mese',
  'energia.subir.col.dias': 'Giorni',
  'energia.subir.elige': '— scegli —',
  'energia.subir.escribelo': 'scrivilo',
  'energia.subir.guardado': 'Salvato',
  'energia.subir.guardando': 'Salvataggio…',
  'energia.subir.guardar': 'Salva',
  'energia.subir.declaraste.uno': 'Hai dichiarato {n} mese e questa bolletta ne copre {pdf}. È stata ripartita secondo il PDF.',
  'energia.subir.declaraste.otros': 'Hai dichiarato {n} mesi e questa bolletta ne copre {pdf}. È stata ripartita secondo il PDF.',
  'energia.subir.ya-capturado': 'Ce n’è già una registrata per {mes}: {kwh} kWh per {monto}. Salvarla di nuovo RADDOPPIA il costo di quel mese.',

  // ── components/demo/energia/captura.ts ──
  'energia.motivo.falta-inicio': 'Manca il mese di inizio',
  'energia.motivo.falta-fin': 'Manca il mese di fine',
  'energia.motivo.formato': 'Usa date nel formato AAAA-MM-GG',
  'energia.motivo.orden': 'Il mese di fine non può essere precedente a quello di inizio',
  'energia.motivo.punto': 'Scegli a quale immobile o impianto corrisponde la bolletta',
  'energia.motivo.mes': 'Scegli il mese della bolletta',
  'energia.motivo.kwh.falta': 'Inserisci i kWh della bolletta',
  'energia.motivo.importe.falta': 'Inserisci l’importo della bolletta',
  'energia.motivo.kwh.numero': 'i kWh devono essere un numero',
  'energia.motivo.importe.numero': 'l’importo deve essere un numero',
  'energia.motivo.kwh.mayor': 'i kWh devono essere maggiori di zero',
  'energia.motivo.importe.mayor': 'l’importo deve essere maggiore di zero',
  'energia.motivo.futuro': 'Quel mese non è ancora finito: non può esserci una bolletta',
  'energia.cobertura.huerfanos.uno':
    '{n} bolletta registrata per {monto} non arriva a nessun impianto, perché il suo immobile non ne ha nessuno registrato. Quel denaro non compare nel report di redditività.',
  'energia.cobertura.huerfanos.otros':
    '{n} bollette registrate per {monto} non arrivano a nessun impianto, perché il loro immobile non ne ha nessuno registrato. Quel denaro non compare nel report di redditività.',
  'energia.cobertura.sin-puntos':
    'Non c’è ancora dove registrare bollette: serve almeno un immobile con impianti, o un impianto senza immobile.',
  'energia.cobertura.completa.uno':
    'Registrazione completa: è presente la bolletta del periodo ({n}). Il costo della luce nel report di redditività è il totale reale.',
  'energia.cobertura.completa.otros':
    'Registrazione completa: ci sono tutte le {n} bollette del periodo. Il costo della luce nel report di redditività è il totale reale.',
  'energia.cobertura.faltan':
    'Bollette mancanti nel periodo: {faltan} su {esperados}. Finché mancano, il report di redditività somma solo il registrato e mostra un costo della luce MINORE di quello reale, senza nessun avviso: un mese senza bolletta non è un mese senza consumo.',
  'energia.borrado.confirmacion':
    'Verrà eliminata la bolletta del contatore {medidor}, di {mes}, per {monto}. Non si può annullare: quel mese torna a contare come un buco, e finché non la registri di nuovo il report di redditività mostrerà un costo della luce minore di quello reale.',

  // ── components/demo/energia/recibos.ts ──
  'energia.lectura.punto': 'Scegli a quale immobile o impianto corrisponde questa bolletta',
  'energia.lectura.kwh.falta': 'Scrivi i kWh: non è stato possibile leggerli dal PDF',
  'energia.lectura.importe.falta': 'Scrivi l’importo: non è stato possibile leggerlo dal PDF',
  'energia.lectura.no-recibo.uno': '{n} file non è una bolletta CFE',
  'energia.lectura.no-recibo.otros': '{n} file non sono bollette CFE',
  'energia.lectura.desajuste.uno': '{n} non corrisponde al numero di mesi che hai dichiarato ({esperados})',
  'energia.lectura.desajuste.otros': '{n} non corrispondono al numero di mesi che hai dichiarato ({esperados})',
  'energia.lectura.cubre.uno': '{base}: i mesi di calendario che copre sono {unico}',
  'energia.lectura.cubre.otros': '{base}: i mesi di calendario coperti da quei {n} sono {unico}',
  'energia.lectura.sin-predio': '{n} senza immobile: sceglilo tu',
  'energia.lectura.sin-cifra': '{n} con una cifra che non è stato possibile leggere',
  'energia.lectura.repetidos': '{n} con il mese già registrato: salvare di nuovo RADDOPPIA il costo',
  'energia.lectura.alerta': 'File letti: {leidos} su {total}; righe: {filas}. Controlla prima di confermare: {pegas}.',
  'energia.lectura.ninguno': 'Da questi file non è uscita nessuna riga.',
  'energia.lectura.ok.uno':
    'È stato letto {total} {archivos} e contiene {filas} {renglones}. Controlla ogni riga con la bolletta e confermala: non si salva nulla finché non clicchi salva.',
  'energia.lectura.ok.otros':
    'Sono stati letti {total} {archivos} e contengono {filas} {renglones}. Controlla ogni riga con la bolletta e confermala: non si salva nulla finché non clicchi salva.',
  'energia.lectura.archivo.uno': 'file',
  'energia.lectura.archivo.otros': 'file',
  'energia.lectura.renglon.uno': 'riga',
  'energia.lectura.renglon.otros': 'righe',
  'energia.leido.servicio': 'servizio {n}',
  'energia.leido.medidor': 'contatore {n}',
  'energia.leido.periodo': 'periodo {desde} → {hasta}',
  'energia.leido.pdf-dice': 'il PDF indica {kwh} kWh',
  'energia.leido.facturacion': 'fatturazione {monto}',
  'energia.leido.alumbrado': 'illuminazione pubblica {monto}',
  'energia.leido.total': 'Totale della bolletta {monto} (include arretrati e pagamenti)',
}

// ─── PORTUGUES (pt-BR) · lote L1 «Space Eyes y luz» (2026-11-05) ────────────
// COMPLETO: el tipo es `Record<ClaveEnergia, string>` y `tsc` exige cada clave.
// Traducido desde el ESPANOL, con el glosario comun (`portugues-olas.md` §2
// bis) y el del lote (subseccion «Lote L1»): recibo de luz → conta de luz ·
// predio → imóvel · pantalla → ponto · pantalla suelta → ponto avulso ·
// punto de medicion → unidade consumidora (la UC de las contas brasilenas; no
// «ponto», que es la pantalla del inventario) · medidor → medidor · capturar →
// registrar · hueco → lacuna · tanda → lote · renglon → linha · reporte de
// rentabilidad → relatório de rentabilidade · adeudos → débitos anteriores.
// Lo que el usuario ve EN EL PAPEL de la CFE se nombra como alli: la CFE, y el
// «DAP» (derecho de alumbrado publico) junto a su nombre en portugues.
export const PT_ENERGIA: Record<ClaveEnergia, string> = {
  // ── La pagina ──
  'energia.descripcion': 'Uma conta por imóvel e por mês. É rateada entre os pontos dele do mesmo jeito que o aluguel.',
  'energia.error.cargar': 'Não foi possível carregar os registros de consumo',
  'energia.error.contactar': 'Não foi possível contatar o servidor. Verifique a conexão e tente de novo.',
  'energia.error.guardar-recibo': 'Não foi possível salvar a conta',
  'energia.error.borrar-recibo': 'Não foi possível excluir a conta',
  'energia.capturar': 'Registrar uma conta',
  'energia.cargando-puntos': 'Carregando as unidades consumidoras…',
  'energia.sin-donde-abajo': 'Ainda não há onde registrar: o motivo está abaixo.',
  'energia.cobertura.titulo': 'O que está registrado e o que falta',
  'energia.meses.uno': '{n} mês',
  'energia.meses.otros': '{n} meses',
  'energia.puntos.uno': '{n} unidade consumidora',
  'energia.puntos.otros': '{n} unidades consumidoras',
  'energia.resumen': '{meses} · {puntos}',
  'energia.vacio.error': 'Não foi possível carregar os registros',
  'energia.vacio.periodo': 'Revise o período',
  'energia.vacio.sin-puntos': 'Ainda não há onde registrar',
  'energia.vacio.sin-puntos-detalle':
    'Uma conta de luz pertence a um imóvel com pontos, ou a um ponto sem imóvel. Cadastre o inventário e esta página se preenche sozinha.',

  // ── Indicadores ──
  'energia.kpi.capturados': 'Contas registradas',
  'energia.kpi.no-cargar': 'não foi possível carregar',
  'energia.kpi.faltan': 'Faltam',
  'energia.kpi.importe': 'Valor do período',
  'energia.kpi.kwh': 'kWh do período',
  'energia.kpi.de': '{a} de {b}',
  'energia.kpi.del-periodo': 'do período',
  'energia.kpi.menos-luz': 'o relatório mostra menos energia que a real',
  'energia.kpi.completa': 'registro completo',
  'energia.kpi.solo-capturado': 'só o registrado',
  'energia.kpi.sin-pantalla.uno': 'só o registrado · {n} conta sem ponto',
  'energia.kpi.sin-pantalla.otros': 'só o registrado · {n} contas sem ponto',

  // ── Formulario y rejilla ──
  'energia.predio-o-pantalla': 'Imóvel ou ponto',
  'energia.opcion.pantallas.uno': ' · {n} ponto',
  'energia.opcion.pantallas.otros': ' · {n} pontos',
  'energia.opcion.suelta': ' · ponto avulso',
  'energia.mes-recibo': 'Mês da conta',
  'energia.medidor': 'Medidor',
  'energia.importe': 'Valor',
  'energia.guardar-recibo': 'Salvar conta',
  'energia.rejilla.faltan': 'Faltam',
  'energia.rejilla.pantallas.uno': '{n} ponto',
  'energia.rejilla.pantallas.otros': '{n} pontos',
  'energia.rejilla.suelta': 'Ponto avulso',
  'energia.rejilla.hueco': 'Nenhuma conta registrada: não é consumo zero, é um dado que falta',
  'energia.rejilla.borrar-este': 'Excluir esta conta',
  'energia.rejilla.borrar-aria': 'Excluir a conta do medidor {medidor}',
  'energia.rejilla.borrar': 'Excluir a conta',
  'energia.sin-numero': 'sem número',

  // ── Subir PDF ──
  'energia.subir.error-leer': 'Não foi possível ler os arquivos',
  'energia.subir.no-guardar': 'Não foi possível salvar',
  'energia.subir.no-contactar': 'Não foi possível contatar o servidor',
  'energia.subir.pregunta': '1 · Quantos meses do calendário cada conta deste lote abrange?',
  'energia.subir.elige-antes': '— escolha antes de enviar —',
  'energia.subir.opcion.1': '1 mês do calendário — um período curto, dentro de um único mês',
  'energia.subir.opcion.2': '2 meses do calendário — o normal numa conta MENSAL',
  'energia.subir.opcion.3': '3 meses do calendário — o normal numa conta BIMESTRAL',
  'energia.subir.opcion.4': '4 meses do calendário — um período longo ou atrasado',
  'energia.subir.explica':
    'Contam-se os meses do calendário que o período {toca}, não quanto ele dura. Uma conta mensal começa no meio do mês, então quase sempre abrange {dos}; uma bimestral, {tres}. Se você misturar mensais e bimestrais no mesmo lote, muitas sairão marcadas: envie-as separadamente.',
  'energia.subir.toca': 'abrange',
  'energia.subir.dos': 'dois',
  'energia.subir.tres': 'três',
  'energia.subir.leyendo': 'Lendo…',
  'energia.subir.subir': '2 · Enviar o PDF da conta',
  'energia.subir.elige-arriba': 'Escolha acima quantos meses você espera antes de enviar os arquivos.',
  'energia.subir.se-leen': 'Eles são lidos no servidor e nada é salvo: confira cada linha com a conta e confirme.',
  'energia.subir.col.mes': 'Mês',
  'energia.subir.col.dias': 'Dias',
  'energia.subir.elige': '— escolha —',
  'energia.subir.escribelo': 'digite',
  'energia.subir.guardado': 'Salvo',
  'energia.subir.guardando': 'Salvando…',
  'energia.subir.guardar': 'Salvar',
  'energia.subir.declaraste.uno': 'Você declarou {n} mês e esta conta abrange {pdf}. Foi rateada conforme o PDF.',
  'energia.subir.declaraste.otros': 'Você declarou {n} meses e esta conta abrange {pdf}. Foi rateada conforme o PDF.',
  'energia.subir.ya-capturado': 'Já existe uma registrada para {mes}: {kwh} kWh por {monto}. Salvar outra vez DUPLICA o custo desse mês.',

  // ── components/demo/energia/captura.ts ──
  'energia.motivo.falta-inicio': 'Falta o mês de início',
  'energia.motivo.falta-fin': 'Falta o mês de fim',
  'energia.motivo.formato': 'Use datas no formato AAAA-MM-DD',
  'energia.motivo.orden': 'O mês de fim não pode ser anterior ao de início',
  'energia.motivo.punto': 'Escolha a que imóvel ou ponto a conta corresponde',
  'energia.motivo.mes': 'Escolha o mês da conta',
  'energia.motivo.kwh.falta': 'Informe os kWh da conta',
  'energia.motivo.importe.falta': 'Informe o valor da conta',
  'energia.motivo.kwh.numero': 'os kWh precisam ser um número',
  'energia.motivo.importe.numero': 'o valor precisa ser um número',
  'energia.motivo.kwh.mayor': 'os kWh precisam ser maiores que zero',
  'energia.motivo.importe.mayor': 'o valor precisa ser maior que zero',
  'energia.motivo.futuro': 'Esse mês ainda não terminou: não pode haver conta',
  'energia.cobertura.huerfanos.uno':
    '{n} conta registrada de {monto} não chega a nenhum ponto, porque o imóvel dela não tem nenhum cadastrado. Esse dinheiro não aparece no relatório de rentabilidade.',
  'energia.cobertura.huerfanos.otros':
    '{n} contas registradas de {monto} não chegam a nenhum ponto, porque o imóvel delas não tem nenhum cadastrado. Esse dinheiro não aparece no relatório de rentabilidade.',
  'energia.cobertura.sin-puntos':
    'Ainda não há onde registrar contas: é preciso pelo menos um imóvel com pontos, ou um ponto sem imóvel.',
  'energia.cobertura.completa.uno':
    'Registro completo: o período tem {n} conta e ela está lá. O custo de energia do relatório de rentabilidade é o total real.',
  'energia.cobertura.completa.otros':
    'Registro completo: as {n} contas do período estão lá. O custo de energia do relatório de rentabilidade é o total real.',
  'energia.cobertura.faltan':
    'Faltam {faltan} de {esperados} contas do período. Enquanto faltarem, o relatório de rentabilidade soma só o registrado e mostra um custo de energia MENOR que o real, sem avisar nada: um mês sem conta não é um mês sem consumo.',
  'energia.borrado.confirmacion':
    'A conta do medidor {medidor}, referente a {mes}, de {monto}, será excluída. Não é possível desfazer: esse mês volta a contar como uma lacuna e, até você registrá-la de novo, o relatório de rentabilidade vai mostrar um custo de energia menor que o real.',

  // ── components/demo/energia/recibos.ts ──
  'energia.lectura.punto': 'Escolha a que imóvel ou ponto esta conta corresponde',
  'energia.lectura.kwh.falta': 'Digite os kWh: não foi possível lê-los do PDF',
  'energia.lectura.importe.falta': 'Digite o valor: não foi possível lê-lo do PDF',
  'energia.lectura.no-recibo.uno': '{n} arquivo não é uma conta de luz da CFE',
  'energia.lectura.no-recibo.otros': '{n} arquivos não são contas de luz da CFE',
  'energia.lectura.desajuste.uno': '{n} não confere com o número de meses que você declarou ({esperados})',
  'energia.lectura.desajuste.otros': '{n} não conferem com o número de meses que você declarou ({esperados})',
  'energia.lectura.cubre.uno': '{base}: o número de meses do calendário que ela abrange é {unico}',
  'energia.lectura.cubre.otros': '{base}: o número de meses do calendário que essas {n} abrangem é {unico}',
  'energia.lectura.sin-predio': '{n} sem imóvel: escolha manualmente',
  'energia.lectura.sin-cifra': '{n} com um número que não foi possível ler',
  'energia.lectura.repetidos': '{n} com o mês já registrado: salvar de novo DUPLICA o custo',
  'energia.lectura.alerta': 'Arquivos lidos: {leidos} de {total}; linhas: {filas}. Revise antes de confirmar: {pegas}.',
  'energia.lectura.ninguno': 'Estes arquivos não geraram nenhuma linha.',
  'energia.lectura.ok.uno':
    '{total} {archivos} foi lido e gera {filas} {renglones}. Confira com a conta e confirme: nada é salvo até você clicar em salvar.',
  'energia.lectura.ok.otros':
    'Os {total} {archivos} foram lidos e geram {filas} {renglones}. Confira com as contas e confirme: nada é salvo até você clicar em salvar.',
  'energia.lectura.archivo.uno': 'arquivo',
  'energia.lectura.archivo.otros': 'arquivos',
  'energia.lectura.renglon.uno': 'linha',
  'energia.lectura.renglon.otros': 'linhas',
  'energia.leido.servicio': 'nº de serviço {n}',
  'energia.leido.medidor': 'medidor nº {n}',
  'energia.leido.periodo': 'período {desde} → {hasta}',
  'energia.leido.pdf-dice': 'o PDF diz {kwh} kWh',
  'energia.leido.facturacion': 'valor faturado {monto}',
  'energia.leido.alumbrado': 'iluminação pública (DAP) {monto}',
  'energia.leido.total': 'Total da conta {monto} (inclui débitos anteriores e pagamentos)',
}
