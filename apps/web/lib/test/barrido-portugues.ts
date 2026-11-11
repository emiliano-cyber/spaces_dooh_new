import { textoLegible } from '../i18n/guardias-ingles'

// ============================================================================
//  lib/test/barrido-portugues.ts — LAS PALABRAS ESPANOLAS SUELTAS EN UNA
//  PANTALLA PORTUGUESA.
// ----------------------------------------------------------------------------
//  El barrido por trozos del italiano (`culpablesEnItaliano`,
//  `barrido-italiano.ts`) sirve tal cual para el portugues: busca en el HTML
//  las frases ESPANOLAS e INGLESAS de los diccionarios de un ambito. No ve un
//  portugues A MEDIAS («Sem movimento en este periodo»): ni el espanol ni el
//  ingles enteros estan a la vista. Para eso, esta guardia de palabras (lote
//  L4, 05/11; la leccion del mutante M3 del italiano L4).
//
//  En portugues hace falta otra lista que la italiana: «desde», «está»,
//  «tarifa», «vencida», «pago», «ver» o «editar» se escriben igual en los dos
//  idiomas y no prueban nada («buscar» tampoco: es el verbo de pt-BR). Aqui
//  van solo las que NO existen en portugues.
//
//  ─── LA COSTURA (05/11) ─────────────────────────────────────────────────
//  Hasta la costura este archivo traia `espanolPendienteDeOtrosLotes()` (L5)
//  y `barrido-portugues-l4.ts` traia `espanolPendienteDe(prefijo)` (L4): el
//  espanol de las claves de OTROS lotes aun sin portugues, que cada barrido
//  apartaba con `ignorar` porque caia al espanol sin ser culpa del lote. Con
//  los cinco lotes cerrados no queda ninguna clave sin portugues
//  (`cobertura-portugues.test.ts` lo exige), las dos devolvian [] y se
//  retiraron: un barrido ya no aparta nada que no sea un dato de su prueba.
//  Los dos archivos se unificaron en este.
// ============================================================================

export const PALABRAS_SOLO_ESPANOL = [
  'y', 'el', 'los', 'las', 'del', 'pero', 'hay', 'aquí', 'están', 'todavía', 'ningún', 'ninguna', 'hasta', 'cuando',
  'según', 'fecha', 'fechas', 'pantalla', 'pantallas', 'campaña', 'campañas', 'factura', 'facturas', 'cobranza',
  'renta', 'monto', 'reporte', 'reportes', 'sitio', 'sitios', 'guardar', 'borrar', 'nuevo', 'nueva', 'días', 'año',
  'sin', 'cuota', 'cuotas', 'arrendador', 'predio', 'propuesta', 'propuestas', 'también', 'aún', 'quitar', 'agregar',
  'eliminar', 'subir', 'bajar', 'cargando', 'guardando', 'cerrar', 'movimiento', 'libre', 'libres', 'cobro',
]

/** Las palabras que solo existen en espanol, con su contexto, en el texto legible de un HTML portugues. */
export function palabrasEspanolasEnPortugues(html: string, ajenos: readonly string[] = []): string[] {
  let todo = textoLegible(html)
  for (const a of ajenos) todo = todo.split(a).join('\n')
  const vistas = new Set<string>()
  for (const p of PALABRAS_SOLO_ESPANOL) {
    const m = todo.match(new RegExp(`(?:^|[^\\p{L}])(${p})(?=$|[^\\p{L}])`, 'iu'))
    if (m) {
      const i = m.index ?? 0
      vistas.add(`«${p}» en «${todo.slice(Math.max(0, i - 25), i + p.length + 25).replace(/\s+/g, ' ').trim()}»`)
    }
  }
  return [...vistas]
}
