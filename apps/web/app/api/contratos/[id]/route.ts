import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { editarContratoCtrl } from '@/lib/server/arrendadores-controller'
import { estatusContrato } from '@/lib/server/arrendadores-repo'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/contratos/[id] → editar contrato (recalcula estatus por fechas).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  // Cambio sensible (dinero): exige el permiso del rol Y, si el Dueno activo el
  // control de cambios, que la sesion este desbloqueada.
  //
  // ADR 0001: si el contrato está INCOMPLETO, esta edición es la que fija por
  // primera vez cuánto se le paga al propietario de la pantalla — un compromiso
  // de dinero que hasta ahora no existía. Va en modo ESTRICTO (`sinExenciones`),
  // igual que cambiar los datos bancarios del arrendador: SIN la exención del
  // Dueño, para que ni una sesión suya desatendida pueda comprometer una renta
  // sin reconfirmar la contraseña. Si el control de cambios está apagado, el
  // guard deja pasar igual que en el resto del sistema.
  const incompleto = (await estatusContrato(params.id)) === 'INCOMPLETO'
  const gc = await exigirCambioSensible('arrendadores', 'crear', {
    sinExenciones: incompleto,
  })
  if (!gc.ok) return gc.res
  const g = { usuario: gc.usuario }
  try {
    const contrato = await editarContratoCtrl(params.id, await req.json().catch(() => ({})))
    // El audit distingue completar de editar: son operaciones distintas para
    // quien revise la bitácora después.
    const quedoCompleto = incompleto && contrato.estatus !== 'INCOMPLETO'
    await registrarAccion(
      g.usuario,
      quedoCompleto ? 'Completó contrato de arrendamiento' : 'Editó contrato',
      contrato.id,
    )
    return NextResponse.json(contrato)
  } catch (e) {
    return respuestaError(e)
  }
}
