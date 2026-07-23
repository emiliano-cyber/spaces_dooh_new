import { NextResponse } from 'next/server'
import { limitar, ipDe } from '@/lib/server/rate-limit'
import { crearReset } from '@/lib/server/password-reset-repo'
import { enviarEmail, emailHabilitado, htmlCorreoReset } from '@/lib/server/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/auth/forgot  { email } → genera un token y envía el enlace por correo.
// PÚBLICO. Responde SIEMPRE lo mismo (exista o no el correo) para no filtrar qué
// correos están registrados. En dev (sin correo configurado) imprime el enlace
// en el log del servidor para poder probar el flujo.
export async function POST(req: Request) {
  const limIp = limitar(`forgot:${ipDe(req)}`, 5, 15 * 60_000)
  if (!limIp.ok) {
    return NextResponse.json({ error: `Demasiados intentos. Espera ${limIp.retrySeg}s.` }, { status: 429 })
  }

  const body = (await req.json().catch(() => ({}))) as { email?: unknown }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const mensaje = 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.'
  if (!email) return NextResponse.json({ ok: true, mensaje })

  // Límite adicional por correo (evita floodear a un usuario con correos).
  const limMail = limitar(`forgot:mail:${email.toLowerCase()}`, 3, 60 * 60_000)
  if (!limMail.ok) return NextResponse.json({ ok: true, mensaje })

  // En dev SIN correo configurado, devolvemos el enlace para poder probar sin
  // buscar en el log. NUNCA en producción (NODE_ENV=production).
  let enlaceDev: string | undefined
  try {
    const reset = await crearReset(email)
    if (reset) {
      const base = process.env.APP_URL || new URL(req.url).origin
      const link = `${base}/spaces-dooh/demo/recuperar/${reset.token}`
      if (emailHabilitado()) {
        try {
          await enviarEmail({
            to: reset.email,
            subject: 'Restablece tu contraseña · Space OS',
            html: htmlCorreoReset(reset.nombre, link),
          })
        } catch (e) {
          // No revelamos el fallo al cliente (anti-enumeración); se registra.
          console.error('[forgot] no se pudo enviar el correo:', e)
        }
      } else {
        console.log(`[forgot] Correo no configurado. Enlace de reseteo para ${reset.email}:\n  ${link}`)
        if (process.env.NODE_ENV !== 'production') enlaceDev = link
      }
    }
  } catch (e) {
    console.error('[forgot] error:', e)
  }
  return NextResponse.json({ ok: true, mensaje, ...(enlaceDev ? { enlaceDev } : {}) })
}
