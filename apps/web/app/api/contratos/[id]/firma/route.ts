import { NextResponse } from 'next/server'
import { exigir, tienePermiso } from '@/lib/server/auth'
import { enviarAFirma, firmasDeContrato, firmarComoArrendatario, huellaDatosContrato } from '@/lib/server/firmas-repo'
import { datosContrato } from '@/lib/server/contrato-expediente'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { ipDeRequest, uaDeRequest } from '@/lib/server/peticion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/contratos/[id]/firma → estado de las firmas + detección de invalidez.
//
// Ver el estado va con `ver`; el ENLACE del arrendador solo se entrega a quien
// tiene `crear`. Con el token se firma desde la ruta pública sin sesión, así que
// darlo a un permiso de solo lectura saltaba el candado que el POST de aquí
// abajo pone justo para eso. La UI ya contempla que no venga: sin token no pinta
// el botón de copiar el enlace.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('arrendadores', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const incluirToken = await tienePermiso(g.usuario.rol, 'arrendadores', 'crear')
    // La huella de los datos actuales va con el estado: es lo que el POST de
    // `enviar` exige de vuelta (23/10). No es secreta: no abre nada, solo dice
    // «revisé esto».
    const datos = await datosContrato(params.id)
    return NextResponse.json({
      ...(await firmasDeContrato(params.id, { incluirToken })),
      huellaDatos: datos ? huellaDatosContrato(datos) : null,
    })
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/contratos/[id]/firma → congela el documento y abre el proceso.
//   { accion: 'enviar' }  → congela y genera el enlace del arrendador
//   { accion: 'firmar' }  → firma la parte interna con la sesión actual
export async function POST(req: Request, { params }: { params: { id: string } }) {
  // Firmar compromete a la empresa, así que exige permiso de creación en
  // Arrendadores, igual que capturar el contrato.
  const g = await exigir('arrendadores', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  const body = (await req.json().catch(() => ({}))) as { accion?: string; huellaRevisada?: unknown }
  try {
    if (body.accion === 'firmar') {
      await firmarComoArrendatario({
        contratoId: params.id,
        usuarioId: g.usuario.id,
        nombre: g.usuario.nombre,
        ip: ipDeRequest(req),
        userAgent: uaDeRequest(req),
      })
      await registrarAccion(g.usuario, 'Firmó contrato (arrendatario)', params.id)
      // Aquí el token sí viaja: este handler ya exigió `crear` arriba.
      return NextResponse.json(await firmasDeContrato(params.id, { incluirToken: true }))
    }

    // CONTRATO-FIRMADO-EDITABLE (23/10): no se congela nada sin que alguien haya
    // revisado los datos que el contrato va a recitar. La pantalla manda la
    // huella de lo que enseñó; `enviarAFirma` la compara con la de ahora.
    if (typeof body.huellaRevisada !== 'string' || !body.huellaRevisada) {
      return NextResponse.json(
        { error: 'Revisa los datos del contrato antes de enviarlo a firma.' },
        { status: 400 },
      )
    }
    const { token } = await enviarAFirma(params.id, {
      huellaRevisada: body.huellaRevisada,
      usuario: { id: g.usuario.id, nombre: g.usuario.nombre },
    })
    await registrarAccion(g.usuario, 'Envió contrato a firma', params.id)
    return NextResponse.json({ token, ...(await firmasDeContrato(params.id, { incluirToken: true })) })
  } catch (e) {
    return respuestaError(e)
  }
}
