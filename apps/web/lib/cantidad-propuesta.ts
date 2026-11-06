import { crudoDeLectura, type LecturaCifra } from './captura-cifra'

// ============================================================================
//  La cantidad manual de una línea de propuesta (spots, horas o millares de
//  CPM): qué guarda el formulario de lo que entrega `CampoCifra`.
// ----------------------------------------------------------------------------
//  Vive aparte de `propuestas/page.tsx` para poder probarla sin DOM: la prueba
//  reproduce la sesión tecla a tecla con las funciones reales del campo.
//
//  H1 (05/11, DINERO, publicado en la v0.12.6) · hasta este arreglo el
//  formulario hacía `if (lectura.ok) guardar(...)`: lo que no se entendía no
//  cambiaba nada y se quedaba el ÚLTIMO VALOR VÁLIDO. Eso rompe el contrato de
//  `CampoCifra` (CampoCifra.tsx:28-33: lo ilegible llega como 'NaN' y el
//  formulario debe bloquear con él), y el campo, al ver que el formulario
//  guardaba otra cosa, repintaba ESA cifra a mitad del tecleo. El separador se
//  perdía y las cifras siguientes se pegaban: «1.500» en español se guardaba
//  como 100, «1,500» en italiano como 100, «1.5000» como 15 000. Sin aviso,
//  porque el campo de la fila va con `mostrarError={false}`; y la cantidad
//  multiplica la tarifa (en CPM, un ×10 cobra diez veces más).
//
//  Ahora lo ilegible se GUARDA como ilegible: el campo recibe de vuelta lo
//  mismo que emitió ('NaN', o '' si está vacío), así que no repinta y lo tecleado se queda a la
//  vista en rojo; y `errCifras` de la página bloquea el botón con su motivo.
//  `cantidadManual` conserva la última cantidad buena solo para los totales de
//  la pantalla; no se manda mientras haya algo ilegible.
//
//  El campo VACÍO cuenta como ilegible, y no como 1 («vacío vuelve a 1» decía
//  la página): devolver 1 a mitad del tecleo también se repintaba, y borrar la
//  cantidad para teclear otra daba «5 → borrar → 8» = 18.
// ============================================================================

export interface CantidadEnFormulario {
  cantidadManual: number
  /**
   * Lo que el campo entregó cuando NO es una cantidad: 'NaN' (ilegible) o ''
   * (vacío). Ausente = la cantidad buena está en `cantidadManual`. Se guarda
   * tal cual, y no un booleano, porque el campo compara el `valor` que recibe
   * con lo que él emitió: si no coincide, repinta, y ese repintado es el fallo.
   */
  cantidadCruda?: string
}

/** Lo que el formulario guarda al recibir una lectura del campo. */
export function parcheCantidad(lectura: LecturaCifra): Partial<CantidadEnFormulario> {
  if (!lectura.ok || lectura.valor == null) return { cantidadCruda: crudoDeLectura(lectura) }
  return { cantidadManual: Math.max(1, lectura.valor), cantidadCruda: undefined }
}

/** Lo que el formulario le devuelve al campo como `valor`. */
export function valorCampoCantidad(c: CantidadEnFormulario): string | number {
  return c.cantidadCruda ?? c.cantidadManual
}

/** La cantidad no se puede mandar: el botón de guardar se bloquea (`errCifras`). */
export function cantidadIlegible(c: CantidadEnFormulario): boolean {
  return c.cantidadCruda !== undefined
}
