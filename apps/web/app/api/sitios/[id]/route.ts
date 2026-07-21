import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirDesbloqueo, respuestaDesbloqueo } from '@/lib/server/cambios'
import { actualizarSitioCtrl, borrarSitioCtrl } from '@/lib/server/sitios-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Campos de DINERO de la pantalla: tocarlos mueve el margen (tarifas y costos) o
// a quién se le paga la renta. Editar el nombre, la dirección o las notas no.
// Por eso el candado aquí es por campo y no por ruta: el trabajo diario del
// equipo comercial no debería pedir contraseña.
const CAMPOS_SENSIBLES = [
  'tarifaPublicada', 'tarifaMensual', 'costoCompra', 'precioM2', 'tarifaImpresion',
  'arrendadorId', 'predioId',
]

// PATCH /api/sitios/:id  → edición parcial. Body { toggleNetwork:true } alterna red.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const body = await req.json().catch(() => ({}))
    // Se lee el cuerpo ANTES para saber si toca dinero. Si no, no hay candado.
    const tocaDinero =
      body && typeof body === 'object' && CAMPOS_SENSIBLES.some((c) => c in (body as object))
    if (tocaDinero) {
      const d = await exigirDesbloqueo()
      if (!d.ok) return respuestaDesbloqueo(d)
    }
    const { sitio, toggled } = await actualizarSitioCtrl(params.id, body)
    await registrarAccion(
      g.usuario,
      toggled ? (sitio.enNetwork ? 'Compartió en Network' : 'Quitó de Network') : 'Editó pantalla',
      sitio.nombre,
    )
    return NextResponse.json(sitio)
  } catch (e) {
    return respuestaError(e)
  }
}

// DELETE /api/sitios/:id → catálogo: borrar inventario siempre es sensible.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const d = await exigirDesbloqueo()
  if (!d.ok) return respuestaDesbloqueo(d)
  try {
    const nombre = await borrarSitioCtrl(params.id)
    await registrarAccion(g.usuario, 'Eliminó pantalla', nombre)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return respuestaError(e)
  }
}
