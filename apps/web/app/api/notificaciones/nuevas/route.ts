import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { notificacionesDesde } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/notificaciones/nuevas?desde=<ISO> → solo las creadas después de esa
// marca. Endpoint DELIBERADAMENTE mínimo: lo llama un sondeo cada pocos
// segundos mientras la pestaña está visible, así que devolver el estado
// completo (que pesa megas) sería insostenible.
//
// Sin `desde` no devuelve nada: la primera carga ya trae las notificaciones por
// /api/estado, y responder el histórico entero aquí dispararía un aviso por cada
// notificación vieja al abrir la aplicación.
export async function GET(req: Request) {
  const g = await exigir()
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  const desde = new URL(req.url).searchParams.get('desde')
  if (!desde || Number.isNaN(Date.parse(desde))) {
    return NextResponse.json({ notificaciones: [] })
  }
  // El repo filtra por tenant; un usuario nunca ve las de otra organización.
  return NextResponse.json({ notificaciones: await notificacionesDesde(desde) })
}
