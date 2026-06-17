import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { q, q1 } from '@/lib/server/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function rowToConfig(r: any) {
  return {
    nombreTenant: r.nombre_tenant,
    moneda: r.moneda,
    plazosCobranza: r.plazos_cobranza ?? [],
    tiposTarea: r.tipos_tarea ?? [],
  }
}

async function obtenerOcrear() {
  let r = await q1('select * from config_negocio limit 1')
  if (!r) r = (await q('insert into config_negocio (nombre_tenant) values ($1) returning *', ['RGB Catorce']))[0]
  return r
}

// GET /api/config → configuración del negocio
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  return NextResponse.json(rowToConfig(await obtenerOcrear()))
}

// PATCH /api/config → actualiza nombre/moneda/plazos/tipos de tarea
export async function PATCH(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const b = await req.json().catch(() => ({}))
  const row = await obtenerOcrear()
  const map: Record<string, string> = {
    nombreTenant: 'nombre_tenant', moneda: 'moneda',
    plazosCobranza: 'plazos_cobranza', tiposTarea: 'tipos_tarea',
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
  }
  return NextResponse.json(rowToConfig(await obtenerOcrear()))
}
