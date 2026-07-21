import { NextResponse } from 'next/server'
import { z } from 'zod'
import { exigir } from '@/lib/server/auth'
import { q } from '@/lib/server/db'
import { tenantActual } from '@/lib/server/tenant'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { obtenerConfigRow, obtenerConfigAdmin } from '@/lib/server/config-repo'
import { respuestaError, validar } from '@/lib/server/errores'
import { LIMITES, uploadZod } from '@/lib/server/uploads'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// El logo entraba como escritura cruda: cualquier cadena iba directa a
// `config_negocio.logo_url`, sin tipo ni tamaño (Bloque D). Ahora pasa por el
// helper compartido; un SVG con `<script>` se rechaza en vez de servirse desde
// nuestro dominio. `null` sigue permitido: es "quitar el logo".
const logo = uploadZod(LIMITES.logoEmpresa.allowlist, LIMITES.logoEmpresa.maxMB)

// Schema del PATCH: campos opcionales (es un parche), pero cada uno tipado.
// `.strict()` evita que un campo con typo se ignore en silencio.
const configSchema = z
  .object({
    nombreTenant: z.string().trim().min(1).max(120),
    moneda: z.string().trim().min(1).max(10),
    plazosCobranza: z.array(z.coerce.number().int().min(0).max(365)),
    tiposTarea: z.array(z.string().trim().min(1).max(60)),
    logoUrl: logo.nullable(),
    ivaTasas: z.array(z.coerce.number().min(0).max(100)),
    loopSeg: z.coerce.number().int().min(1).max(3600),
    spotSeg: z.coerce.number().int().min(1).max(3600),
    razonSocial: z.string().trim().max(200).nullable(),
    nombreComercial: z.string().trim().max(200).nullable(),
  })
  .partial()
  .strict()

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
  try {
  const b = validar(configSchema, await req.json().catch(() => ({}))) as Record<string, unknown>

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
  } catch (e) {
    return respuestaError(e)
  }
}
