import type { TipoOT } from '@/lib/data/types'

// ============================================================================
//  lib/costos-ot-payload.ts — qué manda al servidor la tarjeta de costos de
//  mano de obra por tipo de OT (Administración → Configuración), B11.
// ----------------------------------------------------------------------------
//  `PATCH /api/config` trata cada clave presente en `costosOt` como una
//  escritura, y `null` es QUITAR ese tipo (vuelve al respaldo de
//  `COSTOS_OT_RESPALDO`) — la regla vive en `app/api/config/route.ts:64-67`.
//  Un formulario con NUEVE inputs no puede mandar los nueve cada vez: mandar
//  de vuelta un tipo que el usuario no tocó sería reescribirlo con el mismo
//  valor en el mejor caso, y en el peor —si dos pestañas están abiertas—
//  pisar un cambio que hizo otra persona mientras esta pestaña seguía abierta.
//
//  Por eso "tocado" no se rastrea con un Set aparte: se DERIVA comparando el
//  borrador (lo que hay hoy en cada input, como texto) contra el ORIGINAL que
//  trajo el último GET. Si el texto no cambió, no hay nada que mandar.
// ============================================================================

function numeroValido(texto: string): boolean {
  if (texto === '') return false
  const n = Number(texto)
  return Number.isFinite(n) && n >= 0
}

// `original` es `config.costosOt` tal cual lo devuelve el servidor (ya
// saneado): solo trae los tipos que la organización configuró. `borrador` es
// el texto que hay HOY en cada input, incluidos los que el usuario nunca tocó
// (llegan precargados con el valor original, como string).
export function payloadCostosOt(
  original: Partial<Record<TipoOT, number>>,
  borrador: Partial<Record<TipoOT, string>>,
): Partial<Record<TipoOT, number | null>> {
  const payload: Partial<Record<TipoOT, number | null>> = {}
  const tipos = new Set<TipoOT>([
    ...(Object.keys(original) as TipoOT[]),
    ...(Object.keys(borrador) as TipoOT[]),
  ])
  for (const tipo of tipos) {
    const texto = (borrador[tipo] ?? '').trim()
    const textoOriginal = original[tipo] != null ? String(original[tipo]) : ''
    // Sin cambio real: aunque el input exista en el DOM, si su texto es igual
    // al que trajo el GET no hay nada que decirle al servidor.
    if (texto === textoOriginal) continue
    // Vaciado a propósito (había algo, ahora no hay nada, o la clave
    // desapareció del borrador por completo): null explícito, no omisión.
    if (texto === '') {
      payload[tipo] = null
      continue
    }
    // Basura (negativo, texto no numérico): se descarta en vez de mandarla.
    // El servidor la rechazaría igual (`min(0)` en el schema de la ruta), pero
    // rechazar aquí evita que un solo campo mal tecleado tire el PATCH
    // completo — los demás tipos que sí cambiaron se guardan.
    if (numeroValido(texto)) payload[tipo] = Number(texto)
  }
  return payload
}
