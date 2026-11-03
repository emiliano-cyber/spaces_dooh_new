// ============================================================================
//  lib/i18n/textos/compartidos.ts — LOS TEXTOS DE LOS MODULOS COMPARTIDOS.
// ----------------------------------------------------------------------------
//  Lote «compartidos» de la version en ingles (2026-11-02). Son los textos que
//  NO son de ninguna pantalla en concreto sino de piezas que usan muchas:
//  las unidades de contratacion (`lib/periodos.ts`), la calculadora de spots
//  (`lib/calculadora-spots.ts`), las periodicidades de renta
//  (`lib/renta-periodicidad.ts`), el estado del cupon
//  (`lib/codigo-aprobacion.ts`), el aviso de la franja (`lib/rejilla.ts`), los
//  periodos del tablero (`OPCIONES_PERIODO`, `lib/finanzas-periodo.ts`), la
//  barra de dibujo del mapa y los controles de `components/demo/ui/`.
//
//  Mismas reglas que `propuestas.ts`, sin excepcion:
//
//    · CLAVES `compartidos.<modulo>.<elemento>[.matiz]`, en espanol, sin
//      acentos. La clave NO es la frase.
//    · El ESPANOL es una copia LITERAL de lo que ya decia el modulo. Donde el
//      modulo conserva su tabla (`UNIDADES`, `PERIODICIDAD_RENTA_LABEL`,
//      `OPCIONES_PERIODO`), `compartidos.test.ts` exige que las dos copias
//      digan lo mismo, igual que el menu con `nav.ts`.
//    · Plurales con `.uno` / `.otros`. El espanol de las dos es el de siempre.
//    · Ni una cifra de dinero ni un simbolo de moneda: `formatMontoCorto` NO
//      entra aqui (sus sufijos son «k» y «M», que no son palabras).
//    · Ingles sin espacio antes de `%`.
// ============================================================================

export const ES_COMPARTIDOS = {
  // ── Unidades de contratacion (`UNIDADES` de `lib/periodos.ts`) ──
  'compartidos.unidad.mensual': 'Mensual',
  'compartidos.unidad.mensual.uno': 'mes',
  'compartidos.unidad.mensual.otros': 'meses',
  'compartidos.unidad.catorcenal': 'Catorcenal',
  'compartidos.unidad.catorcenal.uno': 'catorcena',
  'compartidos.unidad.catorcenal.otros': 'catorcenas',
  'compartidos.unidad.semanal': 'Semanal',
  'compartidos.unidad.semanal.uno': 'semana',
  'compartidos.unidad.semanal.otros': 'semanas',
  'compartidos.unidad.diaria': 'Diaria',
  'compartidos.unidad.diaria.uno': 'día',
  'compartidos.unidad.diaria.otros': 'días',
  'compartidos.unidad.spot': 'CPS · costo por salida',
  'compartidos.unidad.spot.uno': 'salida',
  'compartidos.unidad.spot.otros': 'salidas',
  'compartidos.unidad.hora': 'Por hora',
  'compartidos.unidad.hora.uno': 'hora',
  'compartidos.unidad.hora.otros': 'horas',
  'compartidos.unidad.cpm': 'CPM · costo por millar',
  'compartidos.unidad.cpm.uno': 'millar',
  'compartidos.unidad.cpm.otros': 'millares',

  // ── La frecuencia de la programacion (`etiquetaFrecuencia`) ──
  'compartidos.frecuencia.uno': '{n} pase al día',
  'compartidos.frecuencia.otros': '{n} pases al día',

  // ── La linea de la calculadora en la ficha (`etiquetaCalculadora`) ──
  'compartidos.calc.espacios.uno': '{n} espacio del loop',
  'compartidos.calc.espacios.otros': '{n} espacios del loop',
  'compartidos.calc.horas': '{h} h al día',
  'compartidos.calc.prima': 'prima {pct} %',

  // ── Por que la calculadora no da cifra (`previsualizarCalculadora`) ──
  'compartidos.calc.motivo.solo-digital': 'La calculadora de spots solo aplica a pantallas digitales vendidas por spot.',
  'compartidos.calc.motivo.sin-loop':
    'La pantalla no tiene capturado cuántos espacios tiene su loop; captúralo en su ficha antes de usar la calculadora.',
  'compartidos.calc.motivo.roadblock-todos': 'Un Roadblock compra los {total} espacios del loop, no {espacios}.',
  'compartidos.calc.motivo.rango-espacios': 'Los espacios del loop van de 1 a {total}.',
  'compartidos.calc.motivo.rango-prima': 'La prima de Roadblock va de 0 a 100 %.',
  'compartidos.calc.motivo.prima-sin-roadblock': 'La prima de Roadblock solo aplica a una línea marcada como Roadblock.',
  'compartidos.calc.motivo.horas':
    'Las horas al día van de más de 0 a {max}: más horas de las que transmite la pantalla serían spots que no salen.',
  'compartidos.calc.motivo.sin-dias': 'La línea no tiene días: revisa las fechas.',
  'compartidos.calc.motivo.cero-spots': 'Con esos espacios y esas horas no sale ni un spot al día.',
  'compartidos.calc.motivo.roadblock-libres': 'Un Roadblock necesita los {total} espacios del loop libres, y la pantalla tiene {libres}.',
  'compartidos.calc.motivo.pocos-libres.uno': 'Pides {espacios} espacios del loop y la pantalla solo tiene {libres} libres.',
  'compartidos.calc.motivo.pocos-libres.otros': 'Pides {espacios} espacios del loop y la pantalla solo tiene {libres} libres.',

  // ── Periodicidades de la renta (`PERIODICIDAD_RENTA_LABEL`) ──
  'compartidos.periodicidad.diaria': 'Diaria',
  'compartidos.periodicidad.semanal': 'Semanal',
  'compartidos.periodicidad.catorcenal': 'Catorcenal (cada 14 días)',
  'compartidos.periodicidad.quincenal': 'Quincenal',
  'compartidos.periodicidad.mensual': 'Mensual',
  'compartidos.periodicidad.bimestral': 'Bimestral',
  'compartidos.periodicidad.trimestral': 'Trimestral',
  'compartidos.periodicidad.semestral': 'Semestral',
  'compartidos.periodicidad.anual': 'Anual',

  // ── Estado del codigo de negociacion (`etiquetaEstadoCodigo`) ──
  'compartidos.codigo.pendiente': 'Pendiente de aprobación',
  'compartidos.codigo.aprobado-por': 'Aprobado por {nombre}',
  'compartidos.codigo.aprobado': 'Aprobado',

  // ── El aviso de la franja (`AVISO_FRANJA_NO_VIAJA_AL_CMS`) ──
  'compartidos.franja.aviso':
    'La franja horaria es un compromiso comercial: se cotiza y se cobra. Al publicar en DOOHmain se envía su horario ' +
    'a cada pantalla; en las pantallas que opera otro CMS, o si el anuncio ya estaba ' +
    'publicado, quien opere la pantalla tiene que programarla manualmente.',

  // ── El selector de periodo (`OPCIONES_PERIODO`) y su etiqueta ──
  'compartidos.periodo.mes': 'Este mes',
  'compartidos.periodo.mes-anterior': 'Mes pasado',
  'compartidos.periodo.trimestre': 'Trimestre',
  'compartidos.periodo.trimestre-anterior': 'Trimestre pasado',
  'compartidos.periodo.anio': 'Año',
  'compartidos.periodo.rango': 'Rango',
  // La etiqueta que manda el servidor (`periodoDe`), rearmada en el idioma.
  'compartidos.periodo.etiqueta.trimestre': '{n}.º trimestre {anio}',
  'compartidos.periodo.etiqueta.rango': '{desde} a {hasta}',
  // Lo que rodea al selector en los dos tableros (retoque de la costura):
  // el aria, el aviso sin fechas y las dos fechas del rango con su «a».
  'compartidos.periodo.aria': 'Periodo',
  'compartidos.periodo.elige': 'Elige la fecha de inicio y la de fin.',
  'compartidos.periodo.desde': 'Desde',
  'compartidos.periodo.hasta': 'Hasta',
  'compartidos.periodo.a': 'a',

  // ── Lo que se manda a DOOHmain (`lib/doohmain-programacion.ts`) ──
  // Costura (2026-11-02). El espanol es el literal del modulo.
  'compartidos.doohmain.todo-el-dia': 'Todo el día (sin franja)',
  'compartidos.doohmain.horario': '{desde} a {hasta}',
  'compartidos.doohmain.las-que-quepan': 'Las que quepan',
  'compartidos.doohmain.origen.ficha': 'escrita en esta ficha',
  'compartidos.doohmain.origen.mapa': 'del mapa del servidor (no está escrita en la ficha)',
  'compartidos.doohmain.origen.servidor': 'la pantalla por omisión del servidor (no está escrita en la ficha)',
  'compartidos.doohmain.origen.ninguna': 'ninguna: al publicar, esta pantalla no recibiría nada',
  // Los dias abreviados de `NOMBRE_DIA` (0 = domingo), en minusculas.
  'compartidos.dia.0': 'dom',
  'compartidos.dia.1': 'lun',
  'compartidos.dia.2': 'mar',
  'compartidos.dia.3': 'mié',
  'compartidos.dia.4': 'jue',
  'compartidos.dia.5': 'vie',
  'compartidos.dia.6': 'sáb',

  // ── A que razon social se asigna (`razones-sociales/asignacion.ts`) ──
  // Costura (2026-11-02). Literal del modulo, sin acento incluido.
  'compartidos.asignacion.sin-asignar': 'Sin asignar',
  'compartidos.asignacion.baja': '{nombre} (dada de baja)',
  'compartidos.asignacion.no-disponible': 'Razon social no disponible',

  // ── La barra de dibujo del mapa (`MapView`) ──
  'compartidos.mapa.cerrar-zona': 'Cerrar zona ({n})',
  'compartidos.mapa.limpiar-zona': 'Limpiar zona',
  'compartidos.mapa.indicacion': 'Toca el mapa para marcar la zona (mín. 3 puntos)',
  'compartidos.mapa.sin-ubicacion.uno': '1 pantalla sin ubicación capturada',
  'compartidos.mapa.sin-ubicacion.otros': '{n} pantallas sin ubicación capturada',

  // ── Controles de `components/demo/ui/` ──
  // Lleva el espacio delante: va pegado al rotulo, solo para lector de pantalla.
  'compartidos.campo.obligatorio': ' (obligatorio)',
  'compartidos.campo.falta': 'Falta este dato',
  'compartidos.contrasena.etiqueta': 'Tu contraseña',
  'compartidos.migas.aria': 'Ruta de navegación',
  'compartidos.candado.pide': 'Tu organización pide la contraseña para confirmar los cambios sensibles.',
  'compartidos.candado.falta': 'Escribe tu contraseña para confirmar.',
  'compartidos.candado.confirmar': 'Confirmar',
  // El galon de `CardColapsable` (ola 5): el aria-label del boton, con el titulo por hueco.
  'compartidos.plegar.minimizar': 'Minimizar {titulo}',
  'compartidos.plegar.expandir': 'Expandir {titulo}',

  // ── lib/captura-cifra.ts · los motivos de CampoCifra (lote catalogos) ──
  // El espanol es el literal del modulo; las cifras de ejemplo van por hueco.
  'compartidos.cifra.forma': 'Escribe solo cifras: la coma separa miles y el punto, decimales. Ejemplo: {ejemplo}',
  'compartidos.cifra.comas': 'Las comas van cada tres cifras, como en {ejemplo}. Si querías decimales, usa punto: {decimal}',
  'compartidos.cifra.europeo': 'Aquí el punto es decimal y la coma separa miles: escribe {ejemplo}',
  'compartidos.cifra.puntos': 'Solo puede haber un punto, y es el decimal. Para miles usa coma: {ejemplo}',
  'compartidos.cifra.vacia': 'Escribe una cifra',
  'compartidos.cifra.punto-decimal': 'En México el punto es decimal: «{texto}» sería {decimal}. Para {miles} escribe {sinComas} o {miles}',
  'compartidos.cifra.enteras': 'Solo cifras enteras, sin decimales',
  'compartidos.cifra.max-decimales.uno': 'Máximo {n} decimal',
  'compartidos.cifra.max-decimales.otros': 'Máximo {n} decimales',
  'compartidos.cifra.grande': 'Esa cifra es demasiado grande',
  'compartidos.cifra.negativo': 'No puede ser negativo',
  'compartidos.cifra.menor': 'No puede ser menor que {n}',
  'compartidos.cifra.mayor': 'No puede ser mayor que {n}',
} as const

export type ClaveCompartidos = keyof typeof ES_COMPARTIDOS

export const EN_COMPARTIDOS: Record<ClaveCompartidos, string> = {
  'compartidos.unidad.mensual': 'Monthly',
  'compartidos.unidad.mensual.uno': 'month',
  'compartidos.unidad.mensual.otros': 'months',
  // «two-week» y no «14-day»: «3 14-day periods» pega dos cifras y se lee
  // «314». Ni «biweekly», que en EE. UU. tambien quiere decir dos por semana.
  'compartidos.unidad.catorcenal': 'Every two weeks',
  'compartidos.unidad.catorcenal.uno': 'two-week period',
  'compartidos.unidad.catorcenal.otros': 'two-week periods',
  'compartidos.unidad.semanal': 'Weekly',
  'compartidos.unidad.semanal.uno': 'week',
  'compartidos.unidad.semanal.otros': 'weeks',
  'compartidos.unidad.diaria': 'Daily',
  'compartidos.unidad.diaria.uno': 'day',
  'compartidos.unidad.diaria.otros': 'days',
  'compartidos.unidad.spot': 'CPS · cost per play',
  'compartidos.unidad.spot.uno': 'play',
  'compartidos.unidad.spot.otros': 'plays',
  'compartidos.unidad.hora': 'Per hour',
  'compartidos.unidad.hora.uno': 'hour',
  'compartidos.unidad.hora.otros': 'hours',
  'compartidos.unidad.cpm': 'CPM · cost per thousand impressions',
  // Invariable tras un numero («2 thousand»), como el piloto
  // (`propuestas.alta.cpm.equivale`: «thousand = {n} impressions»).
  'compartidos.unidad.cpm.uno': 'thousand',
  'compartidos.unidad.cpm.otros': 'thousand',

  'compartidos.frecuencia.uno': '{n} play per day',
  'compartidos.frecuencia.otros': '{n} plays per day',

  'compartidos.calc.espacios.uno': '{n} loop slot',
  'compartidos.calc.espacios.otros': '{n} loop slots',
  'compartidos.calc.horas': '{h} h per day',
  'compartidos.calc.prima': 'premium {pct}%',

  'compartidos.calc.motivo.solo-digital': 'The spot calculator only applies to digital screens sold per spot.',
  'compartidos.calc.motivo.sin-loop':
    "This screen’s number of loop slots hasn’t been entered; add it on the screen’s profile before using the calculator.",
  // «every loop slot ({total})» y no «all {total} loop slots»: con un loop de
  // uno, el plural se leeria mal y aqui no hay contador que lo elija.
  'compartidos.calc.motivo.roadblock-todos': 'A Roadblock buys every loop slot ({total}), not {espacios}.',
  'compartidos.calc.motivo.rango-espacios': 'Loop slots go from 1 to {total}.',
  'compartidos.calc.motivo.rango-prima': 'The Roadblock premium goes from 0 to 100%.',
  'compartidos.calc.motivo.prima-sin-roadblock': 'The Roadblock premium only applies to a line marked as Roadblock.',
  'compartidos.calc.motivo.horas':
    'Hours per day must be greater than 0 and at most {max}: hours beyond what the screen broadcasts would be spots that never play.',
  'compartidos.calc.motivo.sin-dias': 'The line has no days: check the dates.',
  'compartidos.calc.motivo.cero-spots': 'With these slots and hours, not a single spot would play per day.',
  'compartidos.calc.motivo.roadblock-libres': 'A Roadblock needs every loop slot free ({total}); the screen has {libres} free.',
  'compartidos.calc.motivo.pocos-libres.uno': "You’re asking for {espacios} loop slot and the screen only has {libres} free.",
  'compartidos.calc.motivo.pocos-libres.otros': "You’re asking for {espacios} loop slots and the screen only has {libres} free.",

  'compartidos.periodicidad.diaria': 'Daily',
  'compartidos.periodicidad.semanal': 'Weekly',
  'compartidos.periodicidad.catorcenal': 'Every two weeks',
  'compartidos.periodicidad.quincenal': 'Twice a month',
  'compartidos.periodicidad.mensual': 'Monthly',
  'compartidos.periodicidad.bimestral': 'Every two months',
  'compartidos.periodicidad.trimestral': 'Quarterly',
  'compartidos.periodicidad.semestral': 'Every six months',
  'compartidos.periodicidad.anual': 'Yearly',

  'compartidos.codigo.pendiente': 'Pending approval',
  'compartidos.codigo.aprobado-por': 'Approved by {nombre}',
  'compartidos.codigo.aprobado': 'Approved',

  'compartidos.franja.aviso':
    'The daypart is a commercial commitment: it is quoted and billed. Publishing to DOOHmain sends its schedule ' +
    'to each screen; on screens run by another CMS, or if the ad was already published, whoever operates the ' +
    'screen has to schedule it manually.',

  // «This quarter» y no «Quarter»: junto a «Last quarter», el suelto no dice
  // que es el trimestre EN CURSO, que es lo que da `periodoDe('trimestre')`.
  'compartidos.periodo.mes': 'This month',
  'compartidos.periodo.mes-anterior': 'Last month',
  'compartidos.periodo.trimestre': 'This quarter',
  'compartidos.periodo.trimestre-anterior': 'Last quarter',
  'compartidos.periodo.anio': 'This year',
  'compartidos.periodo.rango': 'Custom range',
  'compartidos.periodo.etiqueta.trimestre': 'Q{n} {anio}',
  'compartidos.periodo.etiqueta.rango': '{desde} to {hasta}',
  'compartidos.periodo.aria': 'Period',
  'compartidos.periodo.elige': 'Choose the start and end dates.',
  'compartidos.periodo.desde': 'From',
  'compartidos.periodo.hasta': 'To',
  'compartidos.periodo.a': 'to',

  // «daypart», como el glosario; «profile» es la ficha (lote comercial).
  'compartidos.doohmain.todo-el-dia': 'All day (no daypart)',
  'compartidos.doohmain.horario': '{desde} to {hasta}',
  'compartidos.doohmain.las-que-quepan': 'As many as fit',
  'compartidos.doohmain.origen.ficha': 'entered on this profile',
  'compartidos.doohmain.origen.mapa': 'from the server map (not entered on the profile)',
  'compartidos.doohmain.origen.servidor': 'the server’s default screen (not entered on the profile)',
  'compartidos.doohmain.origen.ninguna': 'none: when publishing, this screen would receive nothing',
  'compartidos.dia.0': 'Sun',
  'compartidos.dia.1': 'Mon',
  'compartidos.dia.2': 'Tue',
  'compartidos.dia.3': 'Wed',
  'compartidos.dia.4': 'Thu',
  'compartidos.dia.5': 'Fri',
  'compartidos.dia.6': 'Sat',

  // «Unassigned», como el selector de Comercial (`comercial.editar.sin-asignar`);
  // razon social → legal entity, como Finanzas.
  'compartidos.asignacion.sin-asignar': 'Unassigned',
  'compartidos.asignacion.baja': '{nombre} (deactivated)',
  'compartidos.asignacion.no-disponible': 'Legal entity not available',

  'compartidos.mapa.cerrar-zona': 'Close area ({n})',
  'compartidos.mapa.limpiar-zona': 'Clear area',
  // «Click», como la ayuda del mismo mapa en el alta (`propuestas.alta.mapa.ayuda`).
  'compartidos.mapa.indicacion': 'Click the map to mark the area (at least 3 points)',
  'compartidos.mapa.sin-ubicacion.uno': '1 screen with no location entered',
  'compartidos.mapa.sin-ubicacion.otros': '{n} screens with no location entered',

  'compartidos.campo.obligatorio': ' (required)',
  'compartidos.campo.falta': 'This field is required',
  'compartidos.contrasena.etiqueta': 'Your password',
  'compartidos.migas.aria': 'Breadcrumb',
  'compartidos.candado.pide': 'Your organization requires your password to confirm sensitive changes.',
  'compartidos.candado.falta': 'Enter your password to confirm.',
  'compartidos.candado.confirmar': 'Confirm',
  'compartidos.plegar.minimizar': 'Collapse {titulo}',
  'compartidos.plegar.expandir': 'Expand {titulo}',

  // ── lib/captura-cifra.ts · los motivos de CampoCifra (lote catalogos) ──
  'compartidos.cifra.forma': 'Enter digits only: the comma separates thousands and the period, decimals. Example: {ejemplo}',
  'compartidos.cifra.comas': 'Commas go every three digits, as in {ejemplo}. If you meant decimals, use a period: {decimal}',
  'compartidos.cifra.europeo': 'Here the period is the decimal point and the comma separates thousands: enter {ejemplo}',
  'compartidos.cifra.puntos': 'There can be only one period, and it is the decimal point. For thousands use a comma: {ejemplo}',
  'compartidos.cifra.vacia': 'Enter a number',
  'compartidos.cifra.punto-decimal': 'Here the period is the decimal point: “{texto}” would be {decimal}. For {miles} enter {sinComas} or {miles}',
  'compartidos.cifra.enteras': 'Whole numbers only, no decimals',
  'compartidos.cifra.max-decimales.uno': 'At most {n} decimal place',
  'compartidos.cifra.max-decimales.otros': 'At most {n} decimal places',
  'compartidos.cifra.grande': 'That number is too large',
  'compartidos.cifra.negativo': 'It cannot be negative',
  'compartidos.cifra.menor': 'Must not be less than {n}',
  'compartidos.cifra.mayor': 'Must not be greater than {n}',
}

// ─── ITALIANO · lote L5 (2026-11-03) ────────────────────────────────────────
// COMPLETO: `Record`, asi que una clave nueva sin italiano no compila, como
// en el ingles. Traducido desde el ESPANOL (el ingles, solo de apoyo), con
// el glosario de `vault/03-Frontend/italiano-olas.md`.
export const IT_COMPARTIDOS: Record<ClaveCompartidos, string> = {
  // Es el glosario comun de TODAS las pantallas (unidades, periodicidades,
  // periodos): los demas lotes lo copian tal cual.
  // Las unidades son femeninas («la tariffa mensile / giornaliera»).
  'compartidos.unidad.mensual': 'Mensile',
  'compartidos.unidad.mensual.uno': 'mese',
  'compartidos.unidad.mensual.otros': 'mesi',
  // «periodo di due settimane» y no «quindicina»: «quindicinale» se confunde
  // con la quincena (dos veces al mes), y aqui son 14 dias exactos.
  'compartidos.unidad.catorcenal': 'Ogni due settimane',
  'compartidos.unidad.catorcenal.uno': 'periodo di due settimane',
  'compartidos.unidad.catorcenal.otros': 'periodi di due settimane',
  'compartidos.unidad.semanal': 'Settimanale',
  'compartidos.unidad.semanal.uno': 'settimana',
  'compartidos.unidad.semanal.otros': 'settimane',
  'compartidos.unidad.diaria': 'Giornaliera',
  'compartidos.unidad.diaria.uno': 'giorno',
  'compartidos.unidad.diaria.otros': 'giorni',
  'compartidos.unidad.spot': 'CPS · costo per passaggio',
  'compartidos.unidad.spot.uno': 'passaggio',
  'compartidos.unidad.spot.otros': 'passaggi',
  'compartidos.unidad.hora': 'All’ora',
  'compartidos.unidad.hora.uno': 'ora',
  'compartidos.unidad.hora.otros': 'ore',
  'compartidos.unidad.cpm': 'CPM · costo per migliaio di impression',
  'compartidos.unidad.cpm.uno': 'migliaio',
  'compartidos.unidad.cpm.otros': 'migliaia',

  'compartidos.frecuencia.uno': '{n} passaggio al giorno',
  'compartidos.frecuencia.otros': '{n} passaggi al giorno',

  // «slot», invariable en italiano, como lo dice el sector (y el espanol de la
  // app en «Sin slots capturados»).
  'compartidos.calc.espacios.uno': '{n} slot del loop',
  'compartidos.calc.espacios.otros': '{n} slot del loop',
  'compartidos.calc.horas': '{h} h al giorno',
  'compartidos.calc.prima': 'maggiorazione {pct}%',

  'compartidos.calc.motivo.solo-digital': 'Il calcolatore di spot si applica solo agli schermi digitali venduti a spot.',
  'compartidos.calc.motivo.sin-loop':
    'Per questo schermo non è stato inserito il numero di slot del loop: inseriscilo nella sua scheda prima di usare il calcolatore.',
  'compartidos.calc.motivo.roadblock-todos': 'Un Roadblock acquista tutti gli slot del loop ({total}), non {espacios}.',
  'compartidos.calc.motivo.rango-espacios': 'Gli slot del loop vanno da 1 a {total}.',
  'compartidos.calc.motivo.rango-prima': 'La maggiorazione Roadblock va da 0 a 100%.',
  'compartidos.calc.motivo.prima-sin-roadblock': 'La maggiorazione Roadblock si applica solo a una riga contrassegnata come Roadblock.',
  'compartidos.calc.motivo.horas':
    'Le ore al giorno devono essere più di 0 e al massimo {max}: le ore oltre quelle che lo schermo trasmette sarebbero spot che non vanno mai in onda.',
  'compartidos.calc.motivo.sin-dias': 'La riga non ha giorni: controlla le date.',
  'compartidos.calc.motivo.cero-spots': 'Con questi slot e queste ore non va in onda nemmeno uno spot al giorno.',
  // «ne ha liberi … {libres}»: se lee bien con 1 y con 30, sin plural que elegir.
  'compartidos.calc.motivo.roadblock-libres': 'Un Roadblock richiede liberi tutti gli slot del loop ({total}); lo schermo ne ha liberi {libres}.',
  'compartidos.calc.motivo.pocos-libres.uno': 'Chiedi {espacios} slot del loop e lo schermo ne ha liberi solo {libres}.',
  'compartidos.calc.motivo.pocos-libres.otros': 'Chiedi {espacios} slot del loop e lo schermo ne ha liberi solo {libres}.',

  // En letra, como el glosario: nunca «bimestrale» (ambiguo) ni «ogni 2 mesi».
  'compartidos.periodicidad.diaria': 'Giornaliera',
  'compartidos.periodicidad.semanal': 'Settimanale',
  'compartidos.periodicidad.catorcenal': 'Ogni due settimane',
  'compartidos.periodicidad.quincenal': 'Due volte al mese',
  'compartidos.periodicidad.mensual': 'Mensile',
  'compartidos.periodicidad.bimestral': 'Ogni due mesi',
  'compartidos.periodicidad.trimestral': 'Trimestrale',
  'compartidos.periodicidad.semestral': 'Ogni sei mesi',
  'compartidos.periodicidad.anual': 'Annuale',

  'compartidos.codigo.pendiente': 'In attesa di approvazione',
  'compartidos.codigo.aprobado-por': 'Approvato da {nombre}',
  'compartidos.codigo.aprobado': 'Approvato',

  'compartidos.franja.aviso':
    'La fascia oraria è un impegno commerciale: si quota e si fattura. Pubblicando su DOOHmain si invia il suo orario ' +
    'a ogni schermo; sugli schermi gestiti da un altro CMS, o se l’annuncio era già pubblicato, chi gestisce lo ' +
    'schermo deve programmarla manualmente.',

  'compartidos.periodo.mes': 'Questo mese',
  'compartidos.periodo.mes-anterior': 'Mese scorso',
  'compartidos.periodo.trimestre': 'Questo trimestre',
  'compartidos.periodo.trimestre-anterior': 'Trimestre scorso',
  'compartidos.periodo.anio': 'Quest’anno',
  'compartidos.periodo.rango': 'Intervallo personalizzato',
  // La letra del trimestre de `FORMATO_IDIOMA.it` (T), provisional (P2).
  'compartidos.periodo.etiqueta.trimestre': 'T{n} {anio}',
  // Raya y no «dal … al»: con la fecha italiana («8 dic») pediria «dall’8».
  'compartidos.periodo.etiqueta.rango': '{desde} – {hasta}',
  'compartidos.periodo.aria': 'Periodo',
  'compartidos.periodo.elige': 'Scegli la data di inizio e quella di fine.',
  'compartidos.periodo.desde': 'Dal',
  'compartidos.periodo.hasta': 'Al',
  'compartidos.periodo.a': 'al',

  // Lo que se le asigna en DOOHmain es un SCHERMO (masculino).
  'compartidos.doohmain.todo-el-dia': 'Tutto il giorno (senza fascia oraria)',
  'compartidos.doohmain.horario': '{desde}–{hasta}',
  'compartidos.doohmain.las-que-quepan': 'Quanti ne entrano',
  'compartidos.doohmain.origen.ficha': 'inserito in questa scheda',
  'compartidos.doohmain.origen.mapa': 'dalla mappa del server (non inserito nella scheda)',
  'compartidos.doohmain.origen.servidor': 'lo schermo predefinito del server (non inserito nella scheda)',
  'compartidos.doohmain.origen.ninguna': 'nessuno: pubblicando, questo schermo non riceverebbe nulla',
  'compartidos.dia.0': 'dom',
  'compartidos.dia.1': 'lun',
  'compartidos.dia.2': 'mar',
  'compartidos.dia.3': 'mer',
  'compartidos.dia.4': 'gio',
  'compartidos.dia.5': 'ven',
  'compartidos.dia.6': 'sab',

  // La ragione sociale es femenina.
  'compartidos.asignacion.sin-asignar': 'Non assegnata',
  'compartidos.asignacion.baja': '{nombre} (disattivata)',
  'compartidos.asignacion.no-disponible': 'Ragione sociale non disponibile',

  // «impianto»: el mapa es de inventario, no solo de pantallas digitales.
  'compartidos.mapa.cerrar-zona': 'Chiudi zona ({n})',
  'compartidos.mapa.limpiar-zona': 'Cancella zona',
  'compartidos.mapa.indicacion': 'Clicca sulla mappa per segnare la zona (min. 3 punti)',
  'compartidos.mapa.sin-ubicacion.uno': '1 impianto senza posizione inserita',
  'compartidos.mapa.sin-ubicacion.otros': '{n} impianti senza posizione inserita',

  'compartidos.campo.obligatorio': ' (obbligatorio)',
  'compartidos.campo.falta': 'Manca questo dato',
  'compartidos.contrasena.etiqueta': 'La tua password',
  'compartidos.migas.aria': 'Percorso di navigazione',
  'compartidos.candado.pide': 'La tua organizzazione richiede la password per confermare le modifiche sensibili.',
  'compartidos.candado.falta': 'Inserisci la password per confermare.',
  'compartidos.candado.confirmar': 'Conferma',
  'compartidos.plegar.minimizar': 'Riduci {titulo}',
  'compartidos.plegar.expandir': 'Espandi {titulo}',

  // `CampoCifra` lee la cifra a la mexicana (coma de miles, punto decimal) en
  // TODOS los idiomas: el italiano lo dice tal cual, sin prometer otra cosa.
  'compartidos.cifra.forma': 'Scrivi solo cifre: la virgola separa le migliaia e il punto i decimali. Esempio: {ejemplo}',
  'compartidos.cifra.comas': 'Le virgole vanno ogni tre cifre, come in {ejemplo}. Se volevi i decimali, usa il punto: {decimal}',
  'compartidos.cifra.europeo': 'Qui il punto separa i decimali e la virgola le migliaia: scrivi {ejemplo}',
  'compartidos.cifra.puntos': 'Può esserci un solo punto, quello dei decimali. Per le migliaia usa la virgola: {ejemplo}',
  'compartidos.cifra.vacia': 'Inserisci una cifra',
  'compartidos.cifra.punto-decimal': 'Qui il punto separa i decimali: «{texto}» sarebbe {decimal}. Per {miles} scrivi {sinComas} o {miles}',
  'compartidos.cifra.enteras': 'Solo cifre intere, senza decimali',
  'compartidos.cifra.max-decimales.uno': 'Massimo {n} decimale',
  'compartidos.cifra.max-decimales.otros': 'Massimo {n} decimali',
  'compartidos.cifra.grande': 'Questa cifra è troppo grande',
  'compartidos.cifra.negativo': 'Non può essere negativo',
  'compartidos.cifra.menor': 'Non può essere minore di {n}',
  'compartidos.cifra.mayor': 'Non può essere maggiore di {n}',
}
