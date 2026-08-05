import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { exigirReautenticacionSiempre, respuestaDesbloqueo } from '@/lib/server/cambios'
import { restablecerPasswordCtrl } from '@/lib/server/usuarios-controller'
import { respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/usuarios/:id/restablecer → contraseña temporal de un solo uso.
//
// Sustituye al viejo `PATCH /api/usuarios/:id { password }`, que dejaba a
// cualquier Dueño FIJAR la contraseña de otro y entrar como esa persona: todo
// lo que hiciera quedaba registrado a nombre de ella, indistinguible de
// actividad legítima (A7). Aquí:
//
//   · se exige reautenticación del actor — con SU contraseña, no con un secreto
//     de equipo (ADR 0009), así que la bitácora sí prueba quién lo hizo;
//   · la temporal la genera el servidor, no la elige el administrador;
//   · queda marcada para cambio obligatorio, así que él no conserva una
//     contraseña utilizable de forma duradera;
//   · se cierran las sesiones vivas del afectado.
//
// OJO OPERATIVO: la respuesta lleva la temporal EN CLARO. Va sobre TLS y se
// muestra una sola vez, pero NO se deben registrar cuerpos de respuesta de esta
// ruta en ningún proxy o log. Cuando haya correo saliente esto pasa a ser una
// liga de un solo uso y el administrador deja de ver ningún secreto.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })

  // Reautenticación INCONDICIONAL, no la del candado configurable: éste está
  // apagado por defecto (y lo está en los cinco tenants de producción), así que
  // `exigirDesbloqueo()` habría dejado pasar sin pedir nada y el reset seguiría
  // siendo exactamente lo que reportó A7. Tocar el acceso de otra persona no es
  // algo que deba depender de un interruptor.
  const d = await exigirReautenticacionSiempre()
  if (!d.ok) return respuestaDesbloqueo(d)

  try {
    const { usuario, temporal } = await restablecerPasswordCtrl(params.id, g.usuario.id)
    await registrarAccion(
      g.usuario,
      'Restableció la contraseña de',
      `${usuario.nombre} · se cerraron sus sesiones y deberá cambiarla al entrar`,
    )
    return NextResponse.json({ ok: true, temporal, usuario })
  } catch (e) {
    return respuestaError(e)
  }
}
