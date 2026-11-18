import 'server-only'
import { traducir } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/email.ts — Envío de correo transaccional vía Resend (API REST).
//  Se usa fetch directo (sin dependencia npm) para no tocar el package-lock.
//  Config por env: RESEND_API_KEY y EMAIL_FROM (p. ej. "Space OS
//  <no-reply@pixeled.com.mx>"). Si no está configurado, emailHabilitado()=false
//  y el llamador decide el fallback (en dev: imprimir el enlace en el log).
//
//  DOS CANALES, y la diferencia importa (ver lib/email-remitente.ts):
//    · SISTEMA    — contraseñas, invitaciones. Sale con `EMAIL_FROM` tal cual.
//    · OPERACIÓN  — avisos de negocio. Mismo buzón verificado, pero a nombre de
//      la organización (`from`) y con SU correo en `replyTo`, que es lo que se
//      guarda en `config_negocio.email_remitente`.
//
//  `from` NUNCA se toma de datos del cliente sin pasar por `remitenteConNombre`:
//  ahí es donde se citan y sanean los nombres de organización, que los escribe
//  una persona.
// ============================================================================

import { remitenteConNombre } from '@/lib/email-remitente'

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? ''
const EMAIL_FROM = process.env.EMAIL_FROM ?? ''

export function emailHabilitado(): boolean {
  return !!(RESEND_API_KEY && EMAIL_FROM)
}

// El remitente de OPERACIÓN de un tenant: el buzón de la plataforma con el
// nombre de la organización delante. Vive aquí y no en el llamador para que
// nadie construya la cabecera a mano — es el mismo motivo por el que
// `tarifaDeSitio` es la única fuente de la tarifa (A8).
export function remitenteDeOrganizacion(nombre: string): string {
  return remitenteConNombre(EMAIL_FROM, nombre)
}

export async function enviarEmail(opts: {
  to: string
  subject: string
  html: string
  // Ausente = canal de SISTEMA (`EMAIL_FROM` a secas).
  from?: string
  replyTo?: string | null
  // PROP-COMPLETA (29/10) · copia. La usa el envío de propuestas para que el
  // vendedor tenga en su buzón lo que se le mandó al cliente.
  cc?: string | null
}): Promise<void> {
  if (!emailHabilitado()) throw new Error('email_no_configurado')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from || EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      // Se omite si no hay: mandar `reply_to: null` hace que Resend responda
      // 422 en vez de ignorarlo.
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      // Igual que `reply_to`: ausente si no hay, nunca `null`.
      ...(opts.cc ? { cc: opts.cc } : {}),
    }),
  })
  if (!r.ok) {
    const detalle = await r.text().catch(() => '')
    throw new Error(`Resend ${r.status}: ${detalle}`)
  }
}

// Membrete con el logo de la organización para los correos de OPERACIÓN.
//
// El logo va por URL http (`/api/logo/<token>`) y NO como el data URL que
// guarda `config_negocio.logo_url`: Gmail y la mayoría de clientes de correo
// descartan las imágenes embebidas en base64, así que un data URL aquí se ve
// como un hueco. Esa ruta existe justo para esto.
//
// `max-height` en el atributo `style` Y en `height`: Outlook ignora buena parte
// del CSS y se queda con los atributos HTML.
export function htmlMembrete(logoUrl: string | null, nombreOrg: string): string {
  if (!logoUrl) return ''
  // `src` se escapa igual que `alt`. La URL la construimos nosotros, pero lleva
  // dentro `config_negocio.logo_token`, que es una columna `text`: una comilla
  // ahí cerraría el atributo y lo que siguiera entraría como HTML. Hoy el token
  // solo lo escribe el DEFAULT de la tabla (hexadecimal) y hay un CHECK que lo
  // acota, pero escapar donde se interpola no depende de que esas dos cosas
  // sigan siendo verdad dentro de un año.
  return `
    <div style="margin:0 0 20px">
      <img src="${escaparHtml(logoUrl)}" alt="${escaparHtml(nombreOrg)}" height="40"
           style="height:40px;max-height:40px;width:auto;display:block;border:0" />
    </div>`
}

export function escaparHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Asunto del correo de restablecimiento. Cierre de idiomas (04/11): en el
// idioma de la instancia (ADR 0049), como la invitacion; en espanol, el literal.
export function asuntoCorreoReset(idioma: Idioma = 'es'): string {
  if (idioma === 'es') return 'Restablece tu contraseña · Space OS'
  return traducir(idioma, 'cuenta.correo.reset.asunto')
}

// Plantilla del correo de restablecimiento de contraseña.
//
// Cierre de idiomas (04/11): en ingles e italiano se arma con las piezas del
// diccionario, como la invitacion. En ESPANOL sale el literal de abajo byte a
// byte (lo ata `correos-idioma.test.ts`), incluido el enlace sin escapar en el
// `href`, que es como estaba: el token es hexadecimal y la base, `APP_URL`.
export function htmlCorreoReset(nombre: string, link: string, idioma: Idioma = 'es'): string {
  if (idioma !== 'es') {
    const t = (c: Parameters<typeof traducir>[1], v?: Record<string, string>) => escaparHtml(traducir(idioma, c, v))
    return htmlCorreoConBoton({
      titulo: t('cuenta.correo.reset.titulo'),
      // El nombre va escapado UNA vez: se escapa el texto ya armado.
      cuerpo: t('cuenta.correo.reset.cuerpo', { nombre }),
      boton: t('cuenta.correo.reset.boton'),
      pie: t('cuenta.correo.reset.pie'),
      href: escaparHtml(link),
    })
  }
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#18181b">
    <h2 style="font-size:18px;margin:0 0 12px">Restablecer tu contraseña</h2>
    <p style="font-size:14px;line-height:1.5;color:#3f3f46">
      Hola ${escaparHtml(nombre)}, recibimos una solicitud para restablecer la contraseña de tu cuenta en Space OS.
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

// ─── ADR 0049 · los correos van en el idioma de los DOCUMENTOS de la instancia ─
//
// Decision del dueno (03/11): «todo debe salir en el idioma que se configuro el
// programa». Quien llama pasa `idiomaDeLaInstancia()`. En ESPANOL cada plantilla
// es la literal de siempre, byte a byte (la ata `correos-idioma.test.ts`); en
// ingles e italiano se arma con las MISMAS piezas desde el diccionario, y el
// italiano cae al ingles mientras su lote no las traduzca.
//
// Esta forma es la de los correos con boton (invitacion): titulo, parrafo,
// boton y pie con el enlace en claro.
export function htmlCorreoConBoton(o: { titulo: string; cuerpo: string; boton: string; pie: string; href: string }): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#18181b">
    <h2 style="font-size:18px;margin:0 0 12px">${o.titulo}</h2>
    <p style="font-size:14px;line-height:1.5;color:#3f3f46">${o.cuerpo}</p>
    <p style="margin:20px 0">
      <a href="${o.href}" style="display:inline-block;background:#0a66ff;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
        ${o.boton}
      </a>
    </p>
    <p style="font-size:12px;color:#71717a;line-height:1.5">
      ${o.pie}<br>
      <span style="word-break:break-all;color:#0a66ff">${o.href}</span>
    </p>
  </div>`
}

export function asuntoCorreoInvitacion(idioma: Idioma = 'es'): string {
  if (idioma === 'es') return 'Te dieron acceso a Space OS · elige tu contraseña'
  return traducir(idioma, 'cuenta.correo.invitacion.asunto')
}

// Plantilla de la invitación a un usuario recién dado de alta (ADR 0044). Canal
// de SISTEMA. El nombre se escapa: lo escribe el administrador en el alta, y
// sin escapar una etiqueta en él entraría como HTML en el correo de otro.
export function htmlCorreoInvitacion(nombre: string, link: string, idioma: Idioma = 'es'): string {
  const href = escaparHtml(link)
  if (idioma !== 'es') {
    const t = (c: Parameters<typeof traducir>[1], v?: Record<string, string>) => escaparHtml(traducir(idioma, c, v))
    return htmlCorreoConBoton({
      titulo: t('cuenta.correo.invitacion.titulo'),
      // El nombre va escapado UNA vez: se escapa el texto ya armado.
      cuerpo: t('cuenta.correo.invitacion.cuerpo', { nombre }),
      boton: t('cuenta.correo.invitacion.boton'),
      pie: t('cuenta.correo.invitacion.pie'),
      href,
    })
  }
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#18181b">
    <h2 style="font-size:18px;margin:0 0 12px">Te dieron acceso a Space OS</h2>
    <p style="font-size:14px;line-height:1.5;color:#3f3f46">
      Hola ${escaparHtml(nombre)}, se creó una cuenta para ti en Space OS.
      Haz clic en el botón para elegir tu contraseña. Este enlace vence en 72 horas y solo se puede usar una vez.
    </p>
    <p style="margin:20px 0">
      <a href="${href}" style="display:inline-block;background:#0a66ff;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
        Elegir mi contraseña
      </a>
    </p>
    <p style="font-size:12px;color:#71717a;line-height:1.5">
      Si el enlace venció, pide a quien te dio de alta que te envíe otro.
      Si el botón no funciona, copia y pega este enlace:<br>
      <span style="word-break:break-all;color:#0a66ff">${href}</span>
    </p>
  </div>`
}
