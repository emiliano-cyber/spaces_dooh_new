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

// ============================================================================
//  avisoDeLicencia — que se pinta, y nada mas. No es una segunda comprobacion:
//  reusa `estadoDeLicencia` y solo traduce dos de sus cinco salidas a un
//  mensaje. Las otras tres (sana, vencida, invalida) devuelven null:
//  - `sana`: el silencio es la senal, no hay nada que avisar.
//  - `invalida`: cubre tambien al hijo administrado, que no tiene licencia
//    montada -- no es un error, es el caso normal de media flota.
//  - `vencida`: en ese estado `update.sh` ya apago el contenedor con
//    `openssl`, FUERA de aqui. Pintar algo describiria un estado que no puede
//    darse con este codigo corriendo (ver BandaLicencia.tsx).
// ============================================================================
export function avisoDeLicencia(
  licencia: unknown,
  ahora: Date,
): { tono: 'aviso' | 'gracia'; vence: string; finGracia: string } | null {
  const estado = estadoDeLicencia(licencia, ahora)
  if (estado !== 'aviso' && estado !== 'gracia') return null

  // `estadoDeLicencia` ya valido forma y tipo de estos campos; se releen aqui
  // porque esa funcion no expone su objeto intermedio.
  const l = licencia as Record<string, unknown>
  const vence = String(l.vence)
  const finGracia = new Date(Date.parse(`${vence}T00:00:00Z`) + Number(l.gracia_dias) * DIA)
    .toISOString()
    .slice(0, 10)

  return { tono: estado, vence, finGracia }
}

/**
 * ¿La licencia de esta instancia enciende el modulo? (`modulos` en la
 * licencia firmada, ADR 0041 etapa 4: Space Eyes se vende aparte).
 *
 *   - sin licencia (`null`: los hijos administrados no llevan) → `null`, o sea
 *     "la licencia no decide": manda la configuracion, como hasta ahora;
 *   - licencia sin el campo `modulos` (las de antes) → `null` tambien;
 *   - con `modulos` (aunque sea `[]`) → si el modulo esta en su lista.
 *
 * Una licencia ilegible tambien devuelve `null`: un archivo roto no puede
 * quitarle a una empresa algo que ya pago. La firma la comprueba update.sh en
 * cada corrida, que es quien apaga de verdad.
 */
export function licenciaIncluyeModulo(crudo: string | null, modulo: string): boolean | null {
  if (crudo == null) return null
  try {
    const l = JSON.parse(crudo) as { modulos?: unknown }
    // Sin el campo, la licencia es de antes de la etapa 4 y no decide: si
    // contara como «sin el modulo», desplegar esta version le quitaria Space
    // Eyes a toda instancia con licencia que ya lo usa (revision del 07/10).
    if (!Array.isArray(l.modulos)) return null
    return l.modulos.includes(modulo)
  } catch {
    return null
  }
}
