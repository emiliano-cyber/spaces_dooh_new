import { siguienteNumero } from './numeracion'

// ============================================================================
//  lib/vallas/cuadros-de-sitio.ts — los cuadros que le FALTAN a un sitio VALLA.
// ----------------------------------------------------------------------------
//  Dueño, 24/11: «del inventario se tiene que ver como el resto, como las
//  fijas y las digitales; en su propio módulo es donde se tiene que ver
//  detallado». Hasta hoy un sitio tipo VALLA del inventario NO salía en el
//  módulo Vallas hasta que alguien le daba de alta sus cuadros a mano, uno por
//  uno: en la DEMO, la organización `demo` tenía 3 sitios VALLA en Inventario
//  y la pantalla de Vallas vacía.
//
//  La regla: un sitio VALLA (que no esté de BAJA) SIN NINGÚN cuadro recibe uno
//  por cara, con las medidas del sitio. Un sitio con al menos uno no se toca:
//  ahí ya decidió una persona. Puro, sin servidor: lo aplica
//  `completarCuadrosDeSitiosValla` (vallas-repo.ts) al listar.
//
//  Consecuencia conocida: si alguien borra TODOS los cuadros de un sitio
//  VALLA, vuelven a salir al abrir Vallas. Para sacarlo del módulo hay que
//  cambiarle el tipo al sitio, que es lo que de verdad dice que no es valla.
// ============================================================================

export type SitioParaCuadros = {
  id: string
  tipoMedio: string
  caras: number | null
  ancho: number | null
  alto: number | null
  baja: boolean
}

export type CuadroNuevo = {
  sitioId: string
  numero: string
  cara: number
  ancho: number
  alto: number
  notas: string | null
}

/** La base exige medida > 0 (`vallas_medida_ck`). Sin medida en el sitio no se inventa una. */
export const MEDIDA_POR_CAPTURAR = 'Medida por capturar: el sitio no tenía medidas.'

const PREFIJO = 'V-'
/** `vallas_cara_ck`: cara entre 1 y 50. */
const CARAS_MAX = 50

const medida = (x: number | null) => (x != null && Number(x) > 0 ? Number(x) : null)

export function cuadrosFaltantes(
  sitios: readonly SitioParaCuadros[],
  existentes: readonly { sitioId: string; numero: string }[],
): CuadroNuevo[] {
  const conCuadros = new Set(existentes.map((v) => v.sitioId))
  const numeros = existentes.map((v) => v.numero)
  const nuevos: CuadroNuevo[] = []

  // Por id: el mismo inventario da siempre los mismos números, en el orden que
  // sea que llegue. Dos pantallas abiertas a la vez calculan lo mismo y la
  // segunda choca con el índice único en vez de duplicar.
  const pendientes = sitios
    .filter((s) => s.tipoMedio === 'VALLA' && !s.baja && !conCuadros.has(s.id))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  for (const s of pendientes) {
    const caras = Math.min(CARAS_MAX, Math.max(1, Math.trunc(Number(s.caras) || 1)))
    const ancho = medida(s.ancho)
    const alto = medida(s.alto)
    const sinMedida = ancho == null || alto == null
    for (let cara = 1; cara <= caras; cara++) {
      const numero = siguienteNumero(numeros, PREFIJO)
      numeros.push(numero)
      nuevos.push({
        sitioId: s.id,
        numero,
        cara,
        ancho: ancho ?? 1,
        alto: alto ?? 1,
        notas: sinMedida ? MEDIDA_POR_CAPTURAR : null,
      })
    }
  }
  return nuevos
}
