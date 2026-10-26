import type { Sitio } from '@/lib/data/client'

// ============================================================================
//  ¿Se puede vender HOY esta pantalla desde Comercial?
// ----------------------------------------------------------------------------
//  Vivía dentro del `map` de la lista de `app/(app)/(shell)/comercial/page.tsx`.
//  Se saca aquí en el rediseño del 26/10 para que las tarjetas de cifras de
//  arriba («Libres para vender», «Bloqueadas por contrato») y la casilla de cada
//  fila cuenten con LA MISMA regla: dos copias de una condición son como una
//  pantalla acaba diciendo «3 libres» encima de una lista con 2 casillas.
//
//  Las condiciones son las de antes, copiadas tal cual. No las «arregles» aquí
//  sin decidirlo: que el Vendedor sin `arrendadores:ver` vea todo bloqueado
//  (la lista de contratos le llega vacía) es un defecto CONOCIDO y avisado,
//  fuera del alcance de un cambio de presentación.
// ============================================================================

export interface DisponibilidadFila {
  esDigital: boolean
  slotsLibres: number | null
  disponible: boolean
  bloqueadaPorContrato: boolean
  libre: boolean
}

export function disponibilidadFila(
  s: Pick<Sitio, 'id' | 'tipoMedio' | 'esRotativo' | 'exhibicion' | 'estatusComercial' | 'spotsDisponibles' | 'totalSpots'>,
  sinContrato: Set<string>,
): DisponibilidadFila {
  // Ocupación de una pantalla DIGITAL = por slots: es seleccionable
  // mientras le queden slots libres (sin importar el flag heredado),
  // y deja de serlo cuando llega a 0. Las estáticas van por estatus.
  const esDigital =
    s.tipoMedio === 'PANTALLA_DIGITAL' ||
    s.esRotativo ||
    s.exhibicion === 'digital' ||
    s.exhibicion === 'rotativo'
  const slotsLibres = s.spotsDisponibles ?? s.totalSpots ?? null
  const disponible = esDigital
    ? s.estatusComercial !== 'BLOQUEADO' && (slotsLibres == null || slotsLibres > 0)
    : s.estatusComercial === 'DISPONIBLE'
  // Sin contrato completo no hay derecho que vender, aunque el
  // inventario diga que está libre (ADR 0003).
  const bloqueadaPorContrato = sinContrato.has(s.id)
  const libre = disponible && !bloqueadaPorContrato
  return { esDigital, slotsLibres, disponible, bloqueadaPorContrato, libre }
}
