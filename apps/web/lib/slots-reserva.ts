import { crudoDeLectura, type LecturaCifra } from './captura-cifra'

// ============================================================================
//  Los slots que se reservan en una pantalla digital (`ReservaDialog`): qué
//  guarda el formulario de lo que entrega `CampoCifra`.
// ----------------------------------------------------------------------------
//  B93 (05/11) · el gemelo de H1 (`lib/cantidad-propuesta.ts`). Hasta este
//  arreglo el diálogo hacía `Number(crudo) || 0`: lo que no se entendía ('NaN')
//  y el campo vacío se reservaban como 0 slots, y el campo, al ver que el
//  formulario guardaba otra cosa, repintaba ese 0 a media escritura. El
//  separador desaparecía y las cifras siguientes se pegaban.
//
//  Ahora lo ilegible y lo vacío se guardan TAL CUAL en `cruda` y se le devuelven
//  al campo, que así no repinta; el diálogo bloquea «Reservar» con su aviso.
//  `slots` conserva la última cifra buena solo para los totales de la pantalla.
//
//  Lo que NO cambia, a propósito: una cifra válida por encima de los
//  disponibles se acota a ellos y el campo lo repinta. Eso es una corrección
//  que se ve, no un separador que se pierde.
// ============================================================================

export interface SlotsEnFormulario {
  slots: number
  /** Lo que entregó el campo cuando NO es una cifra: 'NaN' o ''. Ausente = vale `slots`. */
  cruda?: string
}

/** Lo que el formulario guarda al recibir una lectura del campo. */
export function parcheSlots(lectura: LecturaCifra, disp: number): Partial<SlotsEnFormulario> {
  if (!lectura.ok || lectura.valor == null) return { cruda: crudoDeLectura(lectura) }
  return { slots: Math.max(0, Math.min(disp, Math.round(lectura.valor))), cruda: undefined }
}

/** Lo que el formulario le devuelve al campo como `valor`. */
export function valorCampoSlots(e: SlotsEnFormulario): string | number {
  return e.cruda ?? e.slots
}

/** Los slots no se pueden mandar: «Reservar» se bloquea. */
export function slotsIlegibles(e: SlotsEnFormulario | undefined): boolean {
  return e?.cruda !== undefined
}
