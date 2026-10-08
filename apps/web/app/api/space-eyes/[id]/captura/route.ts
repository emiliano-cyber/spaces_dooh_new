import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { equipoDetalle, pedirCaptura, spaceEyeHabilitado } from '@/lib/server/space-eye'
import { respuestaError } from '@/lib/server/errores'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  POST /api/space-eyes/:id/captura — pedirle una foto al equipo, ahora.
// ----------------------------------------------------------------------------
//  Es la ÚNICA ruta de este módulo que escribe algo, y lo que escribe es una
//  orden en Space Eye, no un dato nuestro.
//
//  EL PERMISO ES `inventario.crear` y no `ver`. Mirar el estado de un equipo y
//  encenderle la cámara no son lo mismo: lo segundo gasta datos del plan del
//  sitio y despierta el teléfono. Quien puede editar el inventario puede pedir
//  una foto; quien solo lo consulta, no.
//
//  QUEDA EN ACTIVIDAD. Una foto a demanda la pide una persona, y dentro de un
//  mes la pregunta será quién encendió esa cámara y cuándo. Sin el registro, la
//  única huella estaría en los logs del otro sistema.
// ============================================================================

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('inventario', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  if (!spaceEyeHabilitado()) {
    return NextResponse.json({ error: 'La integración con Space Eye no está configurada' }, { status: 503 })
  }

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Equipo inválido' }, { status: 400 })
  }

  try {
    // Se resuelve el equipo ANTES de pedir nada: así el registro de actividad
    // lleva el nombre del sitio y no un número, y un id de otra instancia se
    // corta aquí con el mismo 404 que da la ficha.
    const equipo = await equipoDetalle(id)
    if (!equipo) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

    const r = await pedirCaptura(id)
    await registrarAccion(g.usuario, 'Pidió una foto a Space Eyes', equipo.nombre)

    return NextResponse.json({
      orden: r.orden,
      enLinea: r.enLinea,
      // Lo que la interfaz tiene que decirle a quien está esperando. Un equipo
      // caído NO es un error: la orden queda encolada y la recoge al volver.
      mensaje: r.enLinea
        ? 'El equipo está tomando la foto. Aparecerá aquí en unos segundos.'
        : 'El equipo no está en línea ahora mismo. La foto quedó pedida y la tomará en cuanto vuelva.',
    })
  } catch (e) {
    return respuestaError(e)
  }
}
