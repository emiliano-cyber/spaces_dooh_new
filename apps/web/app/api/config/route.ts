import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { q } from '@/lib/server/db'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { rowToConfig, obtenerConfigRow } from '@/lib/server/config-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/config → configuración del negocio
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(rowToConfig(await obtenerConfigRow()))
}

// PATCH /api/config → actualiza nombre/moneda/plazos/tipos de tarea
export async function PATCH(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const b = await req.json().catch(() => ({}))
  const row = await obtenerConfigRow()
  const map: Record<string, string> = {
    nombreTenant: 'nombre_tenant', moneda: 'moneda',
    plazosCobranza: 'plazos_cobranza', tiposTarea: 'tipos_tarea',
    logoUrl: 'logo_url', ivaTasas: 'iva_tasas', loopSeg: 'loop_seg', spotSeg: 'spot_seg',
  }
  const sets: string[] = []
  const vals: unknown[] = []
  for (const [k, col] of Object.entries(map)) {
    if (b[k] !== undefined) {
      vals.push(b[k])
      sets.push(`${col} = $${vals.length}`)
    }
  }
  if (sets.length) {
    vals.push(row.id)
    await q(`update config_negocio set ${sets.join(', ')} where id = $${vals.length}`, vals)
    await registrarAccion(g.usuario, 'Actualizó configuración', 'Negocio')
  }
  return NextResponse.json(rowToConfig(await obtenerConfigRow()))
}
