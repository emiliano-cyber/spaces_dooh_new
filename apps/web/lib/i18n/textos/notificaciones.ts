// ============================================================================
//  lib/i18n/textos/notificaciones.ts — LOS AVISOS DE LA CAMPANITA.
// ----------------------------------------------------------------------------
//  Ola 6 del ingles (2026-11-03). Las notificaciones se GUARDAN como dato, en
//  espanol, cuando las crea el servidor (`notificar()` y tres `insert` a mano).
//  El dato no cambia: la pantalla las traduce AL PINTARLAS
//  (`lib/i18n/notificaciones.ts`).
//
//  Por eso el espanol de cada clave NO es una frase de interfaz: es la
//  PLANTILLA exacta que escribe el servidor, con los huecos donde el servidor
//  mete un dato. De ella sale el patron que reconoce el texto guardado, y
//  `notificaciones.test.ts` ata cada plantilla al literal de su archivo. Un
//  aviso que no casa con ninguna se pinta tal cual, en espanol.
//
//  Plurales con `.uno/.otros`. En `cobranza.*` el espanol de las dos formas es
//  el mismo («día(s)»), porque es lo que guarda el servidor; el ingles elige
//  por la cifra. En `contrato.*` el servidor ya escribe «día» o «días».
//
//  Ni dinero ni moneda: `{saldo}` lo rearma la pantalla con el formato del
//  idioma (`MX$` en ingles).
//
//  GLOSARIO de este archivo: ODC → PO (como `campanas.ficha.folio-odc`) ·
//  cobranza → collection · saldo → balance · al aire → on air · enviar al
//  dominio → submit for publishing · validacion de publicacion → publication
//  review · contrato sin capturar → contract not entered · un espacio (sin
//  nombre) → a space.
// ============================================================================

export const ES_NOTIFICACIONES = {
  // ── Propuestas (`app/api/propuestas/[id]/route.ts`, `propuestas-repo.ts`) ──
  'notificaciones.propuesta.aprobada': 'Propuesta aprobada',
  'notificaciones.propuesta.rechazada': 'Propuesta rechazada',
  'notificaciones.propuesta.aceptada': 'Propuesta aceptada por el cliente',
  'notificaciones.propuesta.aceptada.detalle': '{propuesta} — aceptada por {nombre}',

  // ── Campañas ──
  'notificaciones.campana.generada': 'Campaña generada desde propuesta',
  'notificaciones.campana.no-generada': 'No se pudo generar la campaña',
  'notificaciones.campana.por-validar': 'Campaña por validar',
  'notificaciones.campana.por-validar.detalle': '{campana} se envió al dominio y espera validación de publicación',
  'notificaciones.publicacion.aprobada': 'Publicación aprobada',
  'notificaciones.publicacion.aprobada.detalle': '{campana} fue validada y está al aire',
  'notificaciones.publicacion.rechazada': 'Publicación rechazada',
  'notificaciones.publicacion.rechazada.detalle': '{campana} fue rechazada',
  'notificaciones.publicacion.rechazada.motivo': '{campana} fue rechazada: {motivo}',

  // ── Finanzas ──
  'notificaciones.factura.emitida': 'Factura emitida',
  'notificaciones.odc.registrada': 'ODC registrada',
  'notificaciones.pago.liquidada': 'Cobranza liquidada',
  'notificaciones.pago.abono': 'Abono registrado',
  'notificaciones.pago.sin-folio': 'cobranza',
  'notificaciones.cobranza.vencida': 'Cobranza vencida',
  'notificaciones.cobranza.recordatorio': 'Recordatorio de cobro',
  'notificaciones.cobranza.vencida.detalle.uno': '{cobranza} — vencida hace {n} día(s) · saldo {saldo}',
  'notificaciones.cobranza.vencida.detalle.otros': '{cobranza} — vencida hace {n} día(s) · saldo {saldo}',
  'notificaciones.cobranza.vence.detalle.uno': '{cobranza} — vence en {n} día(s) · saldo {saldo}',
  'notificaciones.cobranza.vence.detalle.otros': '{cobranza} — vence en {n} día(s) · saldo {saldo}',

  // ── Operaciones (`lib/server/ot-repo.ts`) ──
  'notificaciones.ot.vencida': 'OT vencida',
  'notificaciones.ot.vencida.detalle': '{ot} no se cerró a tiempo',
  'notificaciones.ot.vencida.sin-asignar': '{ot} no se cerró a tiempo (sin asignar)',

  // ── Contratos de arrendamiento (`lib/recordatorios-contratos.ts`) ──
  'notificaciones.contrato.sin-capturar': 'Contrato sin capturar: {contrato}',
  'notificaciones.contrato.sin-capturar.detalle':
    'Le falta el arrendador, el importe de la renta, la periodicidad o la fecha de fin. ' +
    'Mientras siga así no cuenta como costo, no genera calendario de pagos y la pantalla no se puede reservar.',
  'notificaciones.contrato.vencido': 'Contrato vencido: {contrato}',
  'notificaciones.contrato.vencido.detalle.uno':
    'Venció hace {n} día y nadie lo ha renovado. El espacio se sigue ocupando sin acuerdo vigente que lo respalde.',
  'notificaciones.contrato.vencido.detalle.otros':
    'Venció hace {n} días y nadie lo ha renovado. El espacio se sigue ocupando sin acuerdo vigente que lo respalde.',
  'notificaciones.contrato.vence-hoy': 'Contrato vence HOY: {contrato}',
  'notificaciones.contrato.vence-en.uno': 'Contrato vence en {n} día: {contrato}',
  'notificaciones.contrato.vence-en.otros': 'Contrato vence en {n} días: {contrato}',
  'notificaciones.contrato.por-vencer.detalle': 'Si se va a renovar, conviene moverlo antes de que caduque.',
  'notificaciones.contrato.un-espacio': 'un espacio',

  // ── El aviso emergente (`SondeoNotificaciones.tsx`) ──
  'notificaciones.ver': 'Ver',
} as const

export const EN_NOTIFICACIONES: Record<keyof typeof ES_NOTIFICACIONES, string> = {
  'notificaciones.propuesta.aprobada': 'Proposal approved',
  'notificaciones.propuesta.rechazada': 'Proposal rejected',
  'notificaciones.propuesta.aceptada': 'Proposal accepted by the client',
  'notificaciones.propuesta.aceptada.detalle': '{propuesta} — accepted by {nombre}',

  'notificaciones.campana.generada': 'Campaign generated from proposal',
  'notificaciones.campana.no-generada': 'Could not generate the campaign',
  'notificaciones.campana.por-validar': 'Campaign awaiting publication review',
  'notificaciones.campana.por-validar.detalle': '{campana} was submitted for publishing and is awaiting publication review',
  'notificaciones.publicacion.aprobada': 'Publication approved',
  'notificaciones.publicacion.aprobada.detalle': '{campana} was approved and is on air',
  'notificaciones.publicacion.rechazada': 'Publication rejected',
  'notificaciones.publicacion.rechazada.detalle': '{campana} was rejected',
  'notificaciones.publicacion.rechazada.motivo': '{campana} was rejected: {motivo}',

  'notificaciones.factura.emitida': 'Invoice issued',
  'notificaciones.odc.registrada': 'PO recorded',
  'notificaciones.pago.liquidada': 'Paid in full',
  'notificaciones.pago.abono': 'Partial payment recorded',
  'notificaciones.pago.sin-folio': 'collection',
  'notificaciones.cobranza.vencida': 'Overdue collection',
  'notificaciones.cobranza.recordatorio': 'Payment reminder',
  'notificaciones.cobranza.vencida.detalle.uno': '{cobranza} — {n} day overdue · balance {saldo}',
  'notificaciones.cobranza.vencida.detalle.otros': '{cobranza} — {n} days overdue · balance {saldo}',
  'notificaciones.cobranza.vence.detalle.uno': '{cobranza} — due in {n} day · balance {saldo}',
  'notificaciones.cobranza.vence.detalle.otros': '{cobranza} — due in {n} days · balance {saldo}',

  'notificaciones.ot.vencida': 'Overdue work order',
  'notificaciones.ot.vencida.detalle': '{ot} was not closed on time',
  'notificaciones.ot.vencida.sin-asignar': '{ot} was not closed on time (unassigned)',

  'notificaciones.contrato.sin-capturar': 'Contract not entered: {contrato}',
  'notificaciones.contrato.sin-capturar.detalle':
    'It is missing the landlord, the rent amount, the payment frequency or the end date. ' +
    'Until then it does not count as a cost, it does not generate a payment schedule and the screen cannot be booked.',
  'notificaciones.contrato.vencido': 'Contract expired: {contrato}',
  'notificaciones.contrato.vencido.detalle.uno':
    'It expired {n} day ago and nobody has renewed it. The space is still in use with no current agreement to back it.',
  'notificaciones.contrato.vencido.detalle.otros':
    'It expired {n} days ago and nobody has renewed it. The space is still in use with no current agreement to back it.',
  'notificaciones.contrato.vence-hoy': 'Contract expires TODAY: {contrato}',
  'notificaciones.contrato.vence-en.uno': 'Contract expires in {n} day: {contrato}',
  'notificaciones.contrato.vence-en.otros': 'Contract expires in {n} days: {contrato}',
  'notificaciones.contrato.por-vencer.detalle': 'If it is going to be renewed, it’s best to act before it expires.',
  'notificaciones.contrato.un-espacio': 'a space',

  'notificaciones.ver': 'View',
}
