import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import {
  validarCreatividad,
  eliminarCreatividad,
  retirarCreatividadSoft,
  reemplazarCreatividad,
} from '@/lib/server/creativos-repo'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { doohmainHabilitado, retirarCreativoEnDoohmain } from '@/lib/server/doohmain'
import { validarReemplazoCreatividad } from '@/lib/server/creativos-controller'
import { respuestaError } from '@/lib/server/errores'
import { conteo } from '@/lib/plural'

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
  // Autoasignación del creativo único (M14 / INC-02): se anota aparte porque es
  // un cambio en OTRAS filas —las reservas— que el usuario no pidió
  // explícitamente. Que aparezca en el historial es lo que hace que «yo no puse
  // eso» tenga respuesta.
  const autoasignadas = (crea as { autoasignadas?: number }).autoasignadas ?? 0
  if (autoasignadas > 0) {
    await registrarAccion(
      g.usuario,
      `Se asignó automáticamente a ${conteo(autoasignadas, 'pantalla')} por ser el único creativo aprobado`,
      crea.nombre,
    )
  }
  return NextResponse.json(crea)
}

// DELETE /api/creatividades/:id → baja el creativo.
//   · Si estaba publicado en DOOHmain: se finaliza su campaña, pero su arte NO se
//     puede quitar de la lista (la API de DOOHmain no lo permite). En vez de
//     borrarlo, se marca como "retirado — pendiente en DOOHmain" (estado honesto).
//   · Si nunca se publicó: se borra limpio.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const doohmain = doohmainHabilitado()
    ? ((await retirarCreativoEnDoohmain(params.id)) as { ok?: boolean; estado?: string })
    : undefined
  const estabaPublicado = doohmain?.estado === 'retirado'
  const crea = estabaPublicado
    ? await retirarCreatividadSoft(params.id)
    : await eliminarCreatividad(params.id)
  if (!crea) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  await registrarAccion(
    g.usuario,
    estabaPublicado ? 'Retiró creativo (pendiente en DOOHmain)' : 'Eliminó creativo',
    crea.nombre,
  )
  return NextResponse.json({ ...crea, doohmain, pendienteEnDoohmain: estabaPublicado })
}

// PUT /api/creatividades/:id  { nombre?, codigo?, archivoUrl?, formato? }
// Reemplaza el arte: retira el anterior de DOOHmain y deja el creativo en
// PENDIENTE para re-validar y re-publicar con el nuevo arte.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    // Valida ANTES de tocar DOOHmain: si el arte nuevo es inválido, retirar el
    // anterior dejaría el creativo sin arte en ningún lado.
    const arte = validarReemplazoCreatividad(await req.json().catch(() => ({})))
    let doohmain: unknown = undefined
    if (doohmainHabilitado()) {
      doohmain = await retirarCreativoEnDoohmain(params.id)
    }
    const crea = await reemplazarCreatividad(params.id, arte)
    if (!crea) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    await registrarAccion(g.usuario, 'Reemplazó creativo', crea.nombre)
    return NextResponse.json({ ...crea, doohmain })
  } catch (e) {
    return respuestaError(e)
  }
}
