import 'server-only'

// ============================================================================
//  lib/server/email.ts — Envío de correo transaccional vía Resend (API REST).
//  Se usa fetch directo (sin dependencia npm) para no tocar el package-lock.
//  Config por env: RESEND_API_KEY y EMAIL_FROM (p. ej. "Space OS
//  <no-reply@pixeled.com.mx>"). Si no está configurado, emailHabilitado()=false
//  y el llamador decide el fallback (en dev: imprimir el enlace en el log).
// ============================================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const EMAIL_FROM = process.env.EMAIL_FROM ?? ''

export function emailHabilitado(): boolean {
  return !!(RESEND_API_KEY && EMAIL_FROM)
}

export async function enviarEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!emailHabilitado()) throw new Error('email_no_configurado')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: opts.to, subject: opts.subject, html: opts.html }),
  })
  if (!r.ok) {
    const detalle = await r.text().catch(() => '')
    throw new Error(`Resend ${r.status}: ${detalle}`)
  }
}

// Plantilla del correo de restablecimiento de contraseña.
export function htmlCorreoReset(nombre: string, link: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#18181b">
    <h2 style="font-size:18px;margin:0 0 12px">Restablecer tu contraseña</h2>
    <p style="font-size:14px;line-height:1.5;color:#3f3f46">
      Hola ${nombre || ''}, recibimos una solicitud para restablecer la contraseña de tu cuenta en Space OS.
      Haz clic en el botón para elegir una nueva. Este enlace vence en 1 hora y solo se puede usar una vez.
    </p>
    <p style="margin:20px 0">
      <a href="${link}" style="display:inline-block;background:#0a66ff;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
        Restablecer contraseña
      </a>
    </p>
    <p style="font-size:12px;color:#71717a;line-height:1.5">
      Si no solicitaste esto, puedes ignorar este correo; tu contraseña no cambiará.
      Si el botón no funciona, copia y pega este enlace:<br>
      <span style="word-break:break-all;color:#0a66ff">${link}</span>
    </p>
  </div>`
}
