import type { AvisoProgramacion, FranjaContratada } from '@/lib/franja-programada'

// ============================================================================
//  lib/data/programacion-api.ts — el cliente HTTP de la franja PROGRAMADA de
//  las campañas (en qué horario se transmiten).   PROG-01.
// ----------------------------------------------------------------------------
//  EL `r.ok` NO SE BORRA, por el mismo motivo que en `rejilla-api.ts`: sin él,
//  un 403 o un 404 se resolverían como éxito y la pantalla cantaría
//  «programada» con la base intacta. El mensaje del servidor se devuelve tal
//  cual: es el que dice que NO se programó ninguna.
// ============================================================================

export type FranjaProgramacionUI = {
  id: string
  nombre: string
  horaInicio: string
  horaFin: string
  activo: boolean
}

export type CampanaProgramacionUI = {
  id: string
  folio: string | null
  nombre: string
  estadoComercial: string
  fechaInicio: string
  fechaFin: string
  franjaProgramadaId: string | null
  contratadas: FranjaContratada[]
  avisos: AvisoProgramacion[]
}

const RUTA = '/api/campanas/franja-programada/'

async function fallar(r: Response, porOmision: string): Promise<never> {
  const d = await r.json().catch(() => ({}))
  throw new Error((d as { error?: string }).error ?? porOmision)
}

export async function programacionApi(
  campanaId?: string,
): Promise<{
  franjas: FranjaProgramacionUI[]
  campanas: CampanaProgramacionUI[]
  /** Lo decide el servidor con la misma regla que el PUT (`comercial.aprobar`). */
  puedeProgramar: boolean
}> {
  const r = await fetch(campanaId ? `${RUTA}?campanaId=${encodeURIComponent(campanaId)}` : RUTA)
  if (!r.ok) return fallar(r, 'No se pudo leer la programación de las campañas')
  return r.json()
}

/** Programa `franjaId` (o la quita, con null) en todas las campañas del lote. Todo o nada. */
export async function programarFranjaApi(franjaId: string | null, campanaIds: string[]): Promise<void> {
  const r = await fetch(RUTA, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ franjaId, campanaIds }),
  })
  if (!r.ok) await fallar(r, 'No se pudo programar la franja')
}
