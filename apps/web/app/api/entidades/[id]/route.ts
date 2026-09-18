import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { editarEntidadCtrl, desactivarEntidadCtrl } from '@/lib/server/entidades-controller'
import { obtenerEntidad } from '@/lib/server/entidades-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/entidades/[id] → una entidad con sus roles.
//
// Una entidad de otra organización responde 404, igual que una que no existe.
// No es descuido: un 403 confirmaría que ese id existe en alguna parte, y desde
// fuera las dos cosas tienen que ser indistinguibles. El `where` del repo lleva
// `and tenant_id` sobre la RLS, así que la que no es mía llega como `null`.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const entidad = await obtenerEntidad(params.id)
    if (!entidad) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json(entidad)
  } catch (e) {
    return respuestaError(e)
  }
}

// PATCH /api/entidades/[id] → cambia o completa la entidad, y sus roles.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    // Snapshot ANTES de sobrescribir, para que la bitácora diga de qué a qué.
    // Estos datos deciden a nombre de quién factura el negocio: saber que
    // cambiaron no basta, hay que poder ver el valor anterior.
    const previo = await obtenerEntidad(params.id)
    const entidad = await editarEntidadCtrl(params.id, body)

    const fmt = (v: string | null | undefined) => (v && v.length ? `"${v}"` : '∅')
    const cambios: string[] = []
    if (previo && previo.razonSocial !== entidad.razonSocial) {
      cambios.push(`razón social ${fmt(previo.razonSocial)}→${fmt(entidad.razonSocial)}`)
    }
    if (previo && (previo.rfc ?? null) !== (entidad.rfc ?? null)) {
      cambios.push(`RFC ${fmt(previo.rfc)}→${fmt(entidad.rfc)}`)
    }
    if (previo && (previo.regimen ?? null) !== (entidad.regimen ?? null)) {
      cambios.push(`régimen ${fmt(previo.regimen)}→${fmt(entidad.regimen)}`)
    }
    if (previo && (previo.cpFiscal ?? null) !== (entidad.cpFiscal ?? null)) {
      cambios.push(`CP fiscal ${fmt(previo.cpFiscal)}→${fmt(entidad.cpFiscal)}`)
    }
    if (previo && (previo.serieFolios ?? null) !== (entidad.serieFolios ?? null)) {
      cambios.push(`serie ${fmt(previo.serieFolios)}→${fmt(entidad.serieFolios)}`)
    }
    if (previo && previo.roles.join(',') !== entidad.roles.join(',')) {
      cambios.push(`roles ${fmt(previo.roles.join(', '))}→${fmt(entidad.roles.join(', '))}`)
    }
    await registrarAccion(
      g.usuario,
      'Editó entidad fiscal',
      cambios.length ? `${entidad.razonSocial} · ${cambios.join('; ')}` : entidad.razonSocial,
    )
    return NextResponse.json(entidad)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/entidades/[id] → baja LÓGICA (`activo = false`).
//
// No borra la fila y es a propósito: la entidad aparece en contratos y en
// comprobantes ya emitidos. Las dos FK son `on delete set null`, así que un
// borrado de verdad no fallaría — dejaría esos documentos sin razón social en
// silencio, que es peor que un error.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const previo = await obtenerEntidad(params.id)
    await desactivarEntidadCtrl(params.id)
    await registrarAccion(
      g.usuario,
      'Dio de baja una entidad fiscal',
      previo?.razonSocial ?? params.id,
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
