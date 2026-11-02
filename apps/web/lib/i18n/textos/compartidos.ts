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
} as const

export type ClaveCompartidos = keyof typeof ES_COMPARTIDOS

export const EN_COMPARTIDOS: Record<ClaveCompartidos, string> = {
  'compartidos.unidad.mensual': 'Monthly',
  'compartidos.unidad.mensual.uno': 'month',
  'compartidos.unidad.mensual.otros': 'months',
  'compartidos.unidad.catorcenal': 'Every 14 days',
  'compartidos.unidad.catorcenal.uno': '14-day period',
  'compartidos.unidad.catorcenal.otros': '14-day periods',
  'compartidos.unidad.semanal': 'Weekly',
  'compartidos.unidad.semanal.uno': 'week',
  'compartidos.unidad.semanal.otros': 'weeks',
  'compartidos.unidad.diaria': 'Daily',
  'compartidos.unidad.diaria.uno': 'day',
  'compartidos.unidad.diaria.otros': 'days',
  'compartidos.unidad.spot': 'CPS · cost per play',
  'compartidos.unidad.spot.uno': 'play',
  'compartidos.unidad.spot.otros': 'plays',
  'compartidos.unidad.hora': 'Hourly',
  'compartidos.unidad.hora.uno': 'hour',
  'compartidos.unidad.hora.otros': 'hours',
  'compartidos.unidad.cpm': 'CPM · cost per thousand impressions',
  'compartidos.unidad.cpm.uno': 'thousand',
  'compartidos.unidad.cpm.otros': 'thousands',

  'compartidos.frecuencia.uno': '{n} play per day',
  'compartidos.frecuencia.otros': '{n} plays per day',

  'compartidos.calc.espacios.uno': '{n} loop slot',
  'compartidos.calc.espacios.otros': '{n} loop slots',
  'compartidos.calc.horas': '{h} h per day',
  'compartidos.calc.prima': 'premium {pct}%',

  'compartidos.calc.motivo.solo-digital': 'The spot calculator only applies to digital screens sold per spot.',
  'compartidos.calc.motivo.sin-loop':
    "The screen doesn't have its number of loop slots entered; enter it on the screen's page before using the calculator.",
  // «every loop slot ({total})» y no «all {total} loop slots»: con un loop de
  // uno, el plural se leeria mal y aqui no hay contador que lo elija.
  'compartidos.calc.motivo.roadblock-todos': 'A Roadblock buys every loop slot ({total}), not {espacios}.',
  'compartidos.calc.motivo.rango-espacios': 'Loop slots go from 1 to {total}.',
  'compartidos.calc.motivo.rango-prima': 'The Roadblock premium goes from 0 to 100%.',
  'compartidos.calc.motivo.prima-sin-roadblock': 'The Roadblock premium only applies to a line marked as Roadblock.',
  'compartidos.calc.motivo.horas':
    'Hours per day go from more than 0 up to {max}: more hours than the screen broadcasts would be spots that never play.',
  'compartidos.calc.motivo.sin-dias': 'The line has no days: check the dates.',
  'compartidos.calc.motivo.cero-spots': 'With those slots and those hours, not a single spot plays in a day.',
  'compartidos.calc.motivo.roadblock-libres': 'A Roadblock needs every loop slot free ({total}), and the screen has {libres}.',
  'compartidos.calc.motivo.pocos-libres.uno': "You're asking for {espacios} loop slot and the screen only has {libres} free.",
  'compartidos.calc.motivo.pocos-libres.otros': "You're asking for {espacios} loop slots and the screen only has {libres} free.",

  'compartidos.periodicidad.diaria': 'Daily',
  'compartidos.periodicidad.semanal': 'Weekly',
  'compartidos.periodicidad.catorcenal': 'Every 14 days',
  'compartidos.periodicidad.quincenal': 'Twice a month',
  'compartidos.periodicidad.mensual': 'Monthly',
  'compartidos.periodicidad.bimestral': 'Every 2 months',
  'compartidos.periodicidad.trimestral': 'Quarterly',
  'compartidos.periodicidad.semestral': 'Every 6 months',
  'compartidos.periodicidad.anual': 'Yearly',

  'compartidos.codigo.pendiente': 'Pending approval',
  'compartidos.codigo.aprobado-por': 'Approved by {nombre}',
  'compartidos.codigo.aprobado': 'Approved',

  'compartidos.franja.aviso':
    'The daypart is a commercial commitment: it is quoted and billed. Publishing to DOOHmain sends its schedule ' +
    'to each screen; on screens run by another CMS, or if the ad was already published, whoever operates the ' +
    'screen has to schedule it manually.',

  'compartidos.periodo.mes': 'This month',
  'compartidos.periodo.mes-anterior': 'Last month',
  'compartidos.periodo.trimestre': 'Quarter',
  'compartidos.periodo.trimestre-anterior': 'Last quarter',
  'compartidos.periodo.anio': 'Year',
  'compartidos.periodo.rango': 'Range',
  'compartidos.periodo.etiqueta.trimestre': 'Q{n} {anio}',
  'compartidos.periodo.etiqueta.rango': '{desde} to {hasta}',

  'compartidos.mapa.cerrar-zona': 'Close area ({n})',
  'compartidos.mapa.limpiar-zona': 'Clear area',
  'compartidos.mapa.indicacion': 'Tap the map to mark the area (min. 3 points)',
  'compartidos.mapa.sin-ubicacion.uno': '1 screen with no location entered',
  'compartidos.mapa.sin-ubicacion.otros': '{n} screens with no location entered',

  'compartidos.campo.obligatorio': ' (required)',
  'compartidos.campo.falta': 'This field is required',
  'compartidos.contrasena.etiqueta': 'Your password',
  'compartidos.migas.aria': 'Breadcrumb',
  'compartidos.candado.pide': 'Your organization requires your password to confirm sensitive changes.',
  'compartidos.candado.falta': 'Enter your password to confirm.',
  'compartidos.candado.confirmar': 'Confirm',
}
