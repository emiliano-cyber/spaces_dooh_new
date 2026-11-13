// ============================================================================
//  lib/correo-proveedor.ts — POR DONDE SALE EL CORREO: Resend o Brevo.
// ----------------------------------------------------------------------------
//  AVISOS-CANAL (12/11). Decision del dueno: dejar listos los dos proveedores
//  sin contratar ninguno todavia. Se elige por entorno:
//
//    EMAIL_PROVEEDOR=resend   (o vacio)  → RESEND_API_KEY
//    EMAIL_PROVEEDOR=brevo               → BREVO_API_KEY
//
//  y `EMAIL_FROM` es el mismo para los dos. Por eso vacio = Resend: es lo que
//  tenia toda la flota antes de esta tarea, y una instancia que no toque su
//  `.env` sigue exactamente igual.
//
//  Va en un modulo PURO (sin `server-only`, sin `fetch`) porque lo unico que
//  cambia entre proveedores es la forma del pedido —URL, cabecera de la llave y
//  cuerpo—, y eso se prueba entero sin red. El envio lo hace `enviarEmail()`
//  (`lib/server/email.ts`), igual para los dos.
//
//  Sin dependencia npm, por lo mismo que `email.ts` desde el principio: un
//  paquete nuevo cambia el `package-lock` y la imagen de toda la flota.
// ============================================================================

export type ProveedorCorreo = 'resend' | 'brevo'

type Entorno = Record<string, string | undefined>

/**
 * El proveedor configurado. Un valor DESCONOCIDO devuelve `null` —correo
 * apagado— y no cae a Resend: con un error de dedo se intentaria mandar con
 * una llave que no existe, y el fallo se leeria como «Resend 401», que manda a
 * buscar en el sitio equivocado.
 */
export function proveedorDeCorreo(env: Entorno): ProveedorCorreo | null {
  const v = (env.EMAIL_PROVEEDOR ?? '').trim().toLowerCase()
  if (v === '' || v === 'resend') return 'resend'
  if (v === 'brevo') return 'brevo'
  return null
}

export function llaveDelProveedor(p: ProveedorCorreo | null, env: Entorno): string {
  if (p === 'resend') return (env.RESEND_API_KEY ?? '').trim()
  if (p === 'brevo') return (env.BREVO_API_KEY ?? '').trim()
  return ''
}

/**
 * `"Nombre" <correo>` → partes. Brevo pide el remitente como objeto
 * `{ name, email }`, no como cabecera. Desescapa lo que mete
 * `remitenteConNombre` (`lib/email-remitente.ts`) al citar el nombre de la
 * organizacion, que lo escribe una persona.
 */
export function partesDelRemitente(from: string): { nombre: string | null; email: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from ?? '')
  if (!m) return { nombre: null, email: (from ?? '').trim() }
  let nombre = m[1].trim()
  if (nombre.startsWith('"') && nombre.endsWith('"') && nombre.length >= 2) {
    nombre = nombre.slice(1, -1).replace(/\\(["\\])/g, '$1')
  }
  return { nombre: nombre || null, email: m[2].trim() }
}

export interface MensajeCorreo {
  from: string
  to: string
  subject: string
  html: string
  replyTo?: string | null
  cc?: string | null
}

export interface PedidoCorreo {
  url: string
  headers: Record<string, string>
  body: string
}

export function pedidoDeCorreo(p: ProveedorCorreo, llave: string, m: MensajeCorreo): PedidoCorreo {
  if (p === 'brevo') {
    const { nombre, email } = partesDelRemitente(m.from)
    return {
      url: 'https://api.brevo.com/v3/smtp/email',
      headers: { 'api-key': llave, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: nombre ? { name: nombre, email } : { email },
        to: [{ email: m.to }],
        subject: m.subject,
        htmlContent: m.html,
        ...(m.replyTo ? { replyTo: { email: m.replyTo } } : {}),
        ...(m.cc ? { cc: [{ email: m.cc }] } : {}),
      }),
    }
  }
  return {
    url: 'https://api.resend.com/emails',
    headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: m.from,
      to: m.to,
      subject: m.subject,
      html: m.html,
      // Se omiten si no hay: mandar `reply_to: null` hace que Resend responda
      // 422 en vez de ignorarlo. Igual `cc`.
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      ...(m.cc ? { cc: m.cc } : {}),
    }),
  }
}

/** El nombre que sale en los errores y en el registro del servidor. */
export function nombreDelProveedor(p: ProveedorCorreo): string {
  return p === 'brevo' ? 'Brevo' : 'Resend'
}
