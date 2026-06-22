/**
 * Nomenclatura final de los estados comerciales de un sitio.
 *
 * Un sitio RESERVADO se presenta como "reserva tentativa" (apartado aún por
 * confirmar) y uno OCUPADO como "reserva confirmada" (apartado ya en firme).
 * El resto de estados conserva su nombre. Esta es la ÚNICA fuente de verdad
 * para estas etiquetas: los valores del enum EstComercial (BD/API) NO cambian,
 * solo el texto que ve el usuario.
 */
export const ESTATUS_COMERCIAL_LABELS: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  RESERVADO: 'Reserva tentativa',
  OCUPADO: 'Reserva confirmada',
  BLOQUEADO: 'Bloqueado',
  EN_MANTENIMIENTO: 'En mantenimiento',
  BAJA: 'Baja',
}

export function estatusComercialLabel(estatus: string): string {
  return ESTATUS_COMERCIAL_LABELS[estatus] ?? estatus.replace(/_/g, ' ')
}
