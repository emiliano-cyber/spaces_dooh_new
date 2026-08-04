import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { generarCampanaDesdePropuesta, PropuestaCampanaError } from '@/lib/server/campanas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/propuestas/[id]/generar-campana → deriva una campaña de la propuesta
// APROBADA (solo sitios aprobados, precio neto de comisión). Idempotente.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const { campana, yaExistia } = await generarCampanaDesdePropuesta(params.id)
    // Solo se registra y notifica si REALMENTE se creó. Al ser idempotente, un
    // segundo envío devuelve la campaña que ya existía: anotarlo en la bitácora
    // inventa una creación que no ocurrió (A-5 de la auditoría QA) y dispara un
    // aviso repetido. 200 en vez de 201 para que el cliente también lo distinga.
    if (!yaExistia) {
      await registrarAccion(g.usuario, 'Generó campaña desde propuesta', campana.nombre)
      await notificar({
        tipo: 'CAMPANA', nivel: 'ok', titulo: 'Campaña generada desde propuesta',
        detalle: `${campana.folio} · ${campana.nombre}`, link: `/campanas/${campana.id}`,
      })
    }
    return NextResponse.json(campana, { status: yaExistia ? 200 : 201 })
  } catch (e) {
    if (e instanceof PropuestaCampanaError) return NextResponse.json({ error: e.message }, { status: 409 })
    throw e
  }
}
