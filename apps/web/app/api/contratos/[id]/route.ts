import { NextResponse } from 'next/server'
import { exigirCambioSensible } from '@/lib/server/cambios'
import { estatusContrato } from '@/lib/server/arrendadores-repo'
import { editarContratoCtrl } from '@/lib/server/arrendadores-controller'
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
  // de dinero que hasta ahora no existía.
  //
  // Antes ese caso pedía el modo ESTRICTO (`sinExenciones`) para saltarse la
  // exención del Dueño. Desde el ADR 0009 no hay exención para nadie, así que la
  // distinción desapareció: el guard normal ya exige reautenticación a todos.
  // Si el tenant tiene el control apagado, deja pasar igual que en el resto del
  // sistema.
  const gc = await exigirCambioSensible('arrendadores', 'crear')
  if (!gc.ok) return gc.res
  const g = { usuario: gc.usuario }
  // Se lee ANTES de editar y ya no decide el nivel del guard —eso lo unificó el
  // ADR 0009— sino la bitácora: completar un contrato y editarlo son
  // operaciones distintas para quien la revise después.
  const incompleto = (await estatusContrato(params.id)) === 'INCOMPLETO'
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
