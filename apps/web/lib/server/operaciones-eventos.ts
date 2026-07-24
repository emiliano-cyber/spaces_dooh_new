import 'server-only'
import { crearOT } from './ot-repo'
import { q1 } from './db'

// ============================================================================
//  lib/server/operaciones-eventos.ts — Integración Arrendadores ↔ Operaciones
//  (Fase 2). Ciertos eventos del ciclo de vida de un predio/contrato DISPARAN
//  automáticamente una orden de trabajo (OT):
//    · cancelar un contrato   → OT de RETIRO (desmontaje) de la pantalla.
//    · alta de pantalla nueva → OT de MONTAJE (instalación) — solo fijas.
//
//  Todo es "mejor esfuerzo": si la OT no se puede crear, NO se rompe la acción
//  principal (el contrato igual se cancela / la pantalla igual se da de alta).
//  Las OT nacen PENDIENTE y con nota de origen; Operaciones las ve y puede
//  cancelarlas si no aplican.
// ============================================================================

// Crea una OT sin dejar que un fallo tumbe la acción que la disparó.
async function dispararOT(
  input: Parameters<typeof crearOT>[0],
  contexto: string,
): Promise<{ folio: string } | null> {
  try {
    const ot = await crearOT(input)
    return { folio: (ot as { folio: string }).folio }
  } catch (e) {
    console.error(`[operaciones-eventos] no se pudo crear la OT (${contexto}):`, e)
    return null
  }
}

// Contrato cancelado → OT de retiro (desmontaje) de la pantalla del contrato.
export async function otRetiroPorCancelacion(sitioId: string | null | undefined): Promise<{ folio: string } | null> {
  if (!sitioId) return null
  return dispararOT(
    {
      tipo: 'DESMONTAJE',
      sitioId,
      descripcion: 'Retiro de pantalla por cancelación del contrato de arrendamiento.',
      instrucciones: 'Generada automáticamente al cancelar el contrato (integración Arrendadores → Operaciones).',
      prioridad: 'ALTA',
    },
    'cancelación de contrato',
  )
}

// Alta de pantalla nueva → OT de montaje (instalación). Solo pantallas FIJAS: el
// "montaje digital" es obsoleto (el arte se sube por DOOHmain).
export async function otMontajePorAlta(sitioId: string | null | undefined): Promise<{ folio: string } | null> {
  if (!sitioId) return null
  const s = await q1<{ tipo_medio: string; es_rotativo: boolean; exhibicion: string }>(
    'select tipo_medio, es_rotativo, exhibicion from sitios where id = $1',
    [sitioId],
  )
  if (!s) return null
  const digital =
    s.tipo_medio === 'PANTALLA_DIGITAL' || s.es_rotativo === true || s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
  if (digital) return null // las digitales no llevan OT de montaje
  return dispararOT(
    {
      tipo: 'MONTAJE_LONA',
      sitioId,
      descripcion: 'Montaje / instalación de pantalla nueva.',
      instrucciones: 'Generada automáticamente al dar de alta la pantalla en Arrendadores.',
      prioridad: 'ALTA',
    },
    'alta de pantalla',
  )
}

// Reubicación de pantalla → OT (tarea física de mover el inventario).
export async function otReubicacion(
  sitioId: string,
  predioDestino: string,
): Promise<{ folio: string } | null> {
  return dispararOT(
    {
      tipo: 'OTRO',
      sitioId,
      descripcion: `Reubicación de pantalla hacia el predio "${predioDestino}".`,
      instrucciones: 'Generada automáticamente al reubicar la pantalla (Arrendadores → Operaciones).',
      prioridad: 'ALTA',
    },
    'reubicación de pantalla',
  )
}
