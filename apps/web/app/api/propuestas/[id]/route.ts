import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { cambiarEstatusPropuesta, actualizarPropuesta, PropuestaError, PropuestaCeroError } from '@/lib/server/propuestas-repo'
import { generarCampanaDesdePropuesta, PropuestaCampanaError } from '@/lib/server/campanas-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { notificar } from '@/lib/server/notificaciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/propuestas/[id] → cambia el estatus (enviar/aprobar/rechazar).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => ({}))

  // Actualización de campos editables (descuento comercial / nombre / notas),
  // sin cambio de estatus. Sube versión si renegocia una propuesta ya enviada.
  if (body.estatus == null && (body.descuentoPct != null || body.nombre != null || body.notas !== undefined)) {
    try {
      const prop = await actualizarPropuesta(params.id, {
        descuentoPct: body.descuentoPct,
        nombre: body.nombre,
        notas: body.notas,
      })
      if (!prop) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
      await registrarAccion(g.usuario, `Actualizó propuesta (v${prop.version})`, prop.nombre)
      return NextResponse.json(prop)
    } catch (e) {
      const status = e instanceof PropuestaError ? 409 : 400
      return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo actualizar' }, { status })
    }
  }

  try {
    const prop = await cambiarEstatusPropuesta(params.id, body.estatus, { confirmarCero: body.confirmarCero })
    if (!prop) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    // S1-2: si se aprobó una propuesta en $0 (con confirmación), queda en bitácora.
    const accionTxt = prop.estatus === 'APROBADA' && prop.total <= 0
      ? 'Aprobó propuesta en $0 (confirmado)'
      : `Propuesta → ${prop.estatus}`
    await registrarAccion(g.usuario, accionTxt, prop.nombre)
    if (prop.estatus === 'APROBADA' || prop.estatus === 'RECHAZADA') {
      await notificar({
        tipo: 'PROPUESTA',
        nivel: prop.estatus === 'APROBADA' ? 'ok' : 'warn',
        titulo: prop.estatus === 'APROBADA' ? 'Propuesta aprobada' : 'Propuesta rechazada',
        detalle: `${prop.folio} · ${prop.nombre}`,
        link: '/demo/propuestas',
      })
    }

    // Al aprobar: genera automáticamente la campaña con la info de la propuesta
    // (sus pantallas, fechas, cliente y precios netos). Idempotente.
    let campana = null
    if (prop.estatus === 'APROBADA') {
      try {
        campana = await generarCampanaDesdePropuesta(params.id)
        await registrarAccion(g.usuario, 'Generó campaña desde propuesta', campana.nombre)
        await notificar({
          tipo: 'CAMPANA', nivel: 'ok', titulo: 'Campaña generada desde propuesta',
          detalle: `${campana.folio} · ${campana.nombre}`, link: `/demo/campanas/${campana.id}`,
        })
      } catch (e) {
        // No bloquea la aprobación (p. ej. falta cliente); se puede generar luego.
        if (!(e instanceof PropuestaCampanaError)) throw e
        await notificar({
          tipo: 'CAMPANA', nivel: 'warn', titulo: 'No se pudo generar la campaña',
          detalle: e.message, link: '/demo/propuestas',
        })
      }
    }

    return NextResponse.json({ ...prop, campanaGenerada: campana })
  } catch (e) {
    // S1-2: total $0 sin confirmar → aviso para que el UI reconfirme.
    if (e instanceof PropuestaCeroError) {
      return NextResponse.json({ error: e.message, requiereConfirmacionCero: true }, { status: 409 })
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo actualizar' },
      { status: 400 },
    )
  }
}
