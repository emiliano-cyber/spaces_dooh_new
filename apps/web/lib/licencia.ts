// ============================================================================
//  licencia.ts — los cuatro estados de una licencia, y nada mas.
// ----------------------------------------------------------------------------
//  Funcion PURA: no lee archivos, no sale a la red y no comprueba ninguna firma.
//
//  Lo de la firma no es un olvido. Esta aplicacion corre en la maquina del
//  cliente y el cliente tiene root, asi que su veredicto nunca seria de fiar.
//  El veredicto que cuenta lo da `update.sh` con `openssl`, FUERA del
//  contenedor, y es el unico que apaga algo. Aqui solo se decide que se pinta.
//
//  La misma regla esta escrita en bash dentro de `update.sh`. Que las dos no se
//  separen lo sujeta `infra/licencias/estados.casos.tsv`, que leen las dos
//  suites.
// ============================================================================

export type EstadoLicencia = 'sana' | 'aviso' | 'gracia' | 'vencida' | 'invalida'

const DIA = 24 * 60 * 60 * 1000

function esDiaEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0
}

/** Medianoche UTC de una fecha `YYYY-MM-DD`, o `null` si no lo es. */
function medianocheUTC(valor: unknown): number | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const t = Date.parse(`${valor}T00:00:00Z`)
  return Number.isNaN(t) ? null : t
}

export function estadoDeLicencia(licencia: unknown, ahora: Date): EstadoLicencia {
  if (typeof licencia !== 'object' || licencia === null || Array.isArray(licencia)) {
    return 'invalida'
  }
  const l = licencia as Record<string, unknown>

  const vence = medianocheUTC(l.vence)
  if (vence === null) return 'invalida'
  // Un campo ilegible NO cae a un valor por omision: una licencia a medias es
  // una licencia rota, y elegir por ella seria inventarse lo que se concedio.
  if (!esDiaEntero(l.aviso_dias) || !esDiaEntero(l.gracia_dias)) return 'invalida'

  const t = ahora.getTime()
  const inicioAviso = vence - l.aviso_dias * DIA
  const finGracia = vence + l.gracia_dias * DIA

  if (t < inicioAviso) return 'sana'
  if (t < vence) return 'aviso'
  if (t < finGracia) return 'gracia'
  return 'vencida'
}
