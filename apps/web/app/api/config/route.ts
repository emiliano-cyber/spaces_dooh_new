import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { q } from '@/lib/server/db'
import { tenantActual } from '@/lib/server/tenant'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { obtenerConfigRow, obtenerConfigAdmin } from '@/lib/server/config-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/config → configuración del negocio (global) + razón social / nombre
// comercial del tenant actual.
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(await obtenerConfigAdmin())
}

// PATCH /api/config → actualiza nombre/moneda/plazos/tipos de tarea (global) y
// razón social / nombre comercial (POR TENANT → tabla tenants).
export async function PATCH(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const b = await req.json().catch(() => ({}))

  // Campos globales → config_negocio (fila única).
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
    const row = await obtenerConfigRow()
    vals.push(row.id)
    await q(`update config_negocio set ${sets.join(', ')} where id = $${vals.length}`, vals)
  }

  // Campos POR TENANT → tabla tenants (organización actual).
  const tenantMap: Record<string, string> = {
    razonSocial: 'razon_social', nombreComercial: 'nombre_comercial',
  }
  const tSets: string[] = []
  const tVals: unknown[] = []
  for (const [k, col] of Object.entries(tenantMap)) {
    if (b[k] !== undefined) {
      tVals.push(b[k])
      tSets.push(`${col} = $${tVals.length}`)
    }
  }
  if (tSets.length) {
    tVals.push(await tenantActual())
    await q(`update tenants set ${tSets.join(', ')} where id = $${tVals.length}`, tVals)
  }

  if (sets.length || tSets.length) {
    await registrarAccion(g.usuario, 'Actualizó configuración', 'Negocio')
  }
  return NextResponse.json(await obtenerConfigAdmin())
}
