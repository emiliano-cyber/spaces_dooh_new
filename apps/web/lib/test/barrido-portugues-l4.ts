import { textoLegible } from '../i18n/guardias-ingles'
import { espanolPendienteDeOtrosLotes } from './barrido-portugues'
import { CLAVES, DICCIONARIOS, PT_PARCIAL } from '../i18n/diccionario'

// ============================================================================
//  lib/test/barrido-portugues-l4.ts — LAS PALABRAS ESPANOLAS SUELTAS EN UNA
//  PANTALLA PORTUGUESA (lote L4: Campanas, Finanzas, Clientes, Reportes y
//  Dashboard, 2026-11-05).
// ----------------------------------------------------------------------------
//  El barrido por trozos (`culpablesEnItaliano` + `espanolPendienteDeOtrosLotes`,
//  el del L5) busca en el HTML las frases ESPANOLAS e INGLESAS de los
//  diccionarios del lote. No ve un portugues A MEDIAS («Sem movimento en este
//  periodo»): ni el espanol ni el ingles enteros estan a la vista. La leccion
//  de la validacion del L4 italiano (mutante M3) fue esta guardia de palabras.
//
//  En portugues hace falta otra lista que la italiana: «desde», «está»,
//  «tarifa», «vencida», «pago», «ver» o «editar» se escriben igual en los dos
//  idiomas y no prueban nada («buscar» tampoco: es el verbo de pt-BR). Aqui
//  van solo las que NO existen en portugues.
//
//  Y en portugues lo que falta cae al ESPANOL: una pantalla del lote lleva
//  texto de OTROS lotes aun sin traducir (la etapa de Comercial negociacion en
//  Captacion, una etiqueta de propuestas). Antes de buscar se quita ese
//  espanol pendiente (`espanolPendienteDeOtrosLotes`), que se encoge solo a
//  medida que los lotes traducen.
//
//  Lleva el nombre del lote para no pisar el que escriban los otros lotes en
//  paralelo; la costura del portugues puede unificarlos.
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
  for (const a of [...ajenos, ...espanolPendienteDeOtrosLotes(6)]) todo = todo.split(a).join('\n')
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

/**
 * El espanol de las claves de OTRO lote, por prefijo, que todavia no tienen
 * portugues. `espanolPendienteDeOtrosLotes` solo aparta trozos largos (12+
 * letras); las etiquetas cortas de otro lote que COINCIDEN con una del lote
 * («Negociación», «En revisión»: la etapa de Comercial negociacion que pinta
 * Captacion, del L2) se apartan asi, con nombre y apellido. Se vacia sola
 * cuando ese lote las traduzca.
 */
export function espanolPendienteDe(prefijo: string): string[] {
  const es = DICCIONARIOS.es as Record<string, string>
  const pt = PT_PARCIAL as Partial<Record<string, string>>
  return CLAVES.filter((k) => k.startsWith(prefijo) && !pt[k]).map((k) => es[k])
}
