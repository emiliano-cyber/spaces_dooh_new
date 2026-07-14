import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import {
  validarCreatividad,
  eliminarCreatividad,
  reemplazarCreatividad,
} from '@/lib/server/creativos-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { doohmainHabilitado, retirarCreativoEnDoohmain } from '@/lib/server/doohmain'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/creatividades/:id  { aprobar: boolean, motivo?: string }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (typeof body?.aprobar !== 'boolean') {
    return NextResponse.json({ error: 'Falta aprobar (boolean)' }, { status: 400 })
  }
  const crea = await validarCreatividad(params.id, body.aprobar, body.motivo)
  if (!crea) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  await registrarAccion(g.usuario, body.aprobar ? 'Aprobó creativo' : 'Rechazó creativo', crea.nombre)
  return NextResponse.json(crea)
}

// DELETE /api/creatividades/:id → elimina el creativo y lo retira de DOOHmain
// (finaliza su campaña y limpia el tracking).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  // Retira de DOOHmain antes de borrar en SPACES. Un fallo del retiro no impide
  // la eliminación local; se reporta en la respuesta.
  let doohmain: unknown = undefined
  if (doohmainHabilitado()) {
    doohmain = await retirarCreativoEnDoohmain(params.id)
  }
  const crea = await eliminarCreatividad(params.id)
  if (!crea) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  await registrarAccion(g.usuario, 'Eliminó creativo', crea.nombre)
  return NextResponse.json({ ...crea, doohmain })
}

// PUT /api/creatividades/:id  { nombre?, codigo?, archivoUrl?, formato? }
// Reemplaza el arte: retira el anterior de DOOHmain y deja el creativo en
// PENDIENTE para re-validar y re-publicar con el nuevo arte.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = await req.json().catch(() => null)
  if (!body || (!body.codigo && !body.archivoUrl)) {
    return NextResponse.json({ error: 'Falta el nuevo arte (codigo o archivoUrl)' }, { status: 400 })
  }
  let doohmain: unknown = undefined
  if (doohmainHabilitado()) {
    doohmain = await retirarCreativoEnDoohmain(params.id)
  }
  const crea = await reemplazarCreatividad(params.id, {
    nombre: body.nombre ?? null,
    archivoUrl: body.archivoUrl ?? null,
    codigo: body.codigo ?? null,
    formato: body.formato ?? null,
  })
  if (!crea) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  await registrarAccion(g.usuario, 'Reemplazó creativo', crea.nombre)
  return NextResponse.json({ ...crea, doohmain })
}
