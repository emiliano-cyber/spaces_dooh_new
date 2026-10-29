import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'
import { enviarPropuestaCtrl } from '@/lib/server/propuestas-envio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/propuestas/[id]/enviar → manda la liga al cliente por correo y deja
// la propuesta ENVIADA (PROP-COMPLETA, 29/10). Ver `lib/server/propuestas-envio.ts`.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('comercial', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    // La misma raíz que las invitaciones: APP_URL manda en las instancias, que
    // corren detrás de nginx y no conocen su nombre público por la petición.
    const baseUrl = process.env.APP_URL || new URL(req.url).origin
    const body = await req.json().catch(() => ({}))
    const r = await enviarPropuestaCtrl(params.id, body, {
      baseUrl,
      remitente: { nombre: g.usuario.nombre, email: g.usuario.email },
    })
    await registrarAccion(
      g.usuario,
      r.correo === 'enviado'
        ? `Envió la propuesta por correo a ${r.para}`
        : 'Propuesta → ENVIADA (el correo no está configurado: la liga se manda a mano)',
      r.propuesta.nombre,
    )
    return NextResponse.json({ ...r.propuesta, correo: r.correo })
  } catch (e) {
    return respuestaError(e)
  }
}
