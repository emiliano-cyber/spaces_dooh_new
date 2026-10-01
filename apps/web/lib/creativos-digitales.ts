// ============================================================================
//  lib/creativos-digitales.ts — Qué campañas y qué reservas salen en Creativos.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-09-30: «en creativos no deben de salir ninguna
//  campaña de pantalla fija». Los creativos de esta pantalla son los que se
//  reproducen en pantallas DIGITALES; una lona o un espectacular no se gestiona
//  aquí.
//
//  Digital = `tipoMedio === 'PANTALLA_DIGITAL'`, la MISMA regla que `esDigital()`
//  en `lib/data/derive.ts` (S0-3: el tipo de medio gobierna las reglas). NO se
//  usa `spotsReservados != null`, que es la señal que la pantalla miraba antes
//  para decidir el modo de cada reserva: una digital sin slots capturados lo
//  tiene a null y se habría tomado por fija, desapareciendo justo la campaña a
//  la que le falta trabajo.
//
//  Reglas:
//   · Una campaña cuyas reservas son TODAS fijas no sale.
//   · Una mixta sale, con SOLO sus reservas digitales.
//   · Una sin reservas se queda (tiene creativos y no se sabe que sea fija).
//   · Una reserva cuyo sitio no se conoce no cuenta como digital.
// ============================================================================

const DIGITAL = 'PANTALLA_DIGITAL'

export function soloDigitales<
  C extends { id: string },
  R extends { campanaId: string; sitioId: string | null },
  S extends { id: string; tipoMedio?: string | null },
>(campanas: C[], reservas: R[], sitios: S[]): { campanas: C[]; reservas: R[] } {
  const digitales = new Set(sitios.filter((s) => s.tipoMedio === DIGITAL).map((s) => s.id))
  const conReservas = new Set(reservas.map((r) => r.campanaId))
  const reservasDigitales = reservas.filter((r) => r.sitioId != null && digitales.has(r.sitioId))
  const conDigital = new Set(reservasDigitales.map((r) => r.campanaId))
  return {
    campanas: campanas.filter((c) => conDigital.has(c.id) || !conReservas.has(c.id)),
    reservas: reservasDigitales,
  }
}
