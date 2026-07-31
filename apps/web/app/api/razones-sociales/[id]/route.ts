import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { editarRazonSocialCtrl, borrarRazonSocialCtrl } from '@/lib/server/arrendadores-controller'
import { listarRazonesSociales } from '@/lib/server/arrendadores-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/razones-sociales/[id] → cambia o completa la razón social.
//
// Va con el permiso normal de Arrendadores, igual que el RFC del propietario:
// el candado de cambio sensible del módulo está reservado a los datos bancarios
// —a DÓNDE se paga— que aquí no se tocan. Lo que sí se hace es dejar en la
// bitácora el valor anterior y el nuevo, porque estos datos deciden a nombre de
// quién se factura.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    // Snapshot ANTES de sobrescribir, para que el audit diga de qué a qué.
    const previo = (await listarRazonesSociales()).find((r) => r.id === params.id)
    const rs = await editarRazonSocialCtrl(params.id, body)

    const fmt = (v: string | null | undefined) => (v && v.length ? `"${v}"` : '∅')
    const cambios: string[] = []
    if (previo && previo.razonSocial !== rs.razonSocial) {
      cambios.push(`razón social ${fmt(previo.razonSocial)}→${fmt(rs.razonSocial)}`)
    }
    if (previo && (previo.rfc ?? null) !== (rs.rfc ?? null)) {
      cambios.push(`RFC ${fmt(previo.rfc)}→${fmt(rs.rfc)}`)
    }
    if (previo && (previo.regimen ?? null) !== (rs.regimen ?? null)) {
      cambios.push(`régimen ${fmt(previo.regimen)}→${fmt(rs.regimen)}`)
    }
    await registrarAccion(
      g.usuario,
      'Editó razón social',
      cambios.length ? `${rs.razonSocial} · ${cambios.join('; ')}` : rs.razonSocial,
    )
    return NextResponse.json(rs)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/razones-sociales/[id] → elimina, si ningún contrato la usa.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const previo = (await listarRazonesSociales()).find((r) => r.id === params.id)
    await borrarRazonSocialCtrl(params.id)
    await registrarAccion(g.usuario, 'Eliminó razón social', previo?.razonSocial ?? params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
