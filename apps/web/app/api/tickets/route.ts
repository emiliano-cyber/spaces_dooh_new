import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { listarTicketsDelTenant } from '@/lib/server/tickets-repo'
import { crearTicketCtrl } from '@/lib/server/tickets-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/tickets — ADR 0038.
// ----------------------------------------------------------------------------
//  Esta es la puerta del CLIENTE: sesión, `administracion.ver`/`administracion
//  .crear`, y `listarTicketsDelTenant()`/`crearTicketCtrl()` que ya llevan la
//  segunda capa (`and tenant_id = $n`) sobre la RLS.
//
//  La Tarea 6 añadirá AQUÍ, delante del `exigir()` del GET, la rama del panel:
//  con `x-flota-token` válido responde con TODOS los tenants de la instancia
//  (`listarTicketsDeLaInstancia()`, `qRaw`, a propósito); sin esa cabecera cae
//  al camino de sesión de abajo, que no cambia. Por eso el GET de esta tarea no
//  hace nada antes de `exigir()`: dejar ese hueco vacío es lo que permite que la
//  Tarea 6 anteponga su rama sin reescribir esta.
// ============================================================================

// GET /api/tickets → los tickets del tenant en sesión (requiere administracion.ver)
export async function GET() {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarTicketsDelTenant())
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/tickets → abre un ticket para el tenant en sesión (requiere administracion.crear)
export async function POST(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const ticket = await crearTicketCtrl(await req.json().catch(() => ({})), g.usuario.id)
    await registrarAccion(g.usuario, 'Abrió ticket de soporte', ticket.folio)
    return NextResponse.json(ticket, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}
