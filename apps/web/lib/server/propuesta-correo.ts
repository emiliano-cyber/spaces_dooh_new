import 'server-only'
import { escaparHtml, htmlMembrete } from './email'

// ============================================================================
//  lib/server/propuesta-correo.ts — El correo con el que se ENVÍA una propuesta
//  al cliente (PROP-COMPLETA, decisión del dueño del 29/10).
//
//  Sale por el canal de OPERACIÓN (`lib/server/email.ts`): del buzón verificado
//  de la plataforma, a nombre de la organización, y con su correo en Reply-To.
//  Lleva la LIGA, no la propuesta: los importes viven en la liga, que es la que
//  sabe si el cupón está pendiente (COD-03) y si ya venció. Copiar el total al
//  correo dejaría en el buzón del cliente un número que puede dejar de ser
//  verdad al día siguiente.
//
//  Todo lo que escribe una persona (nombre de la organización, de la propuesta,
//  el mensaje del vendedor) pasa por `escaparHtml`.
// ============================================================================

export interface DatosCorreoPropuesta {
  orgNombre: string
  logoUrl: string | null
  propuestaNombre: string
  folio: string
  liga: string
  /** `DD/MM/AAAA` o null si la propuesta no tiene vigencia. */
  vigenteHasta: string | null
  /** El mensaje que escribió quien la envía. Opcional. */
  mensaje: string | null
  /** Quién la envía, para firmar. */
  remitenteNombre: string | null
}

export function asuntoCorreoPropuesta(d: Pick<DatosCorreoPropuesta, 'orgNombre' | 'propuestaNombre'>): string {
  // Sin saltos de línea: una cabecera con un \n es una cabecera rota (o
  // inyectada). Los nombres los teclea una persona.
  return `Propuesta comercial: ${d.propuestaNombre} · ${d.orgNombre}`.replace(/[\r\n]+/g, ' ')
}

export function htmlCorreoPropuesta(d: DatosCorreoPropuesta): string {
  const mensaje = d.mensaje?.trim()
    ? `<p style="font-size:14px;line-height:1.5;color:#3f3f46;white-space:pre-wrap;margin:0 0 16px">${escaparHtml(d.mensaje.trim())}</p>`
    : ''
  const vigencia = d.vigenteHasta
    ? `<p style="font-size:13px;color:#71717a;margin:12px 0 0">Puedes aceptarla en línea hasta el <b style="color:#18181b">${escaparHtml(d.vigenteHasta)}</b>.</p>`
    : ''
  const firma = d.remitenteNombre
    ? `${escaparHtml(d.remitenteNombre)} · ${escaparHtml(d.orgNombre)}`
    : escaparHtml(d.orgNombre)
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b">
    ${htmlMembrete(d.logoUrl, d.orgNombre)}
    <h2 style="font-size:18px;margin:0 0 4px">${escaparHtml(d.propuestaNombre)}</h2>
    <p style="font-size:12px;color:#71717a;margin:0 0 16px">Folio ${escaparHtml(d.folio)}</p>
    ${mensaje}
    <p style="font-size:14px;line-height:1.5;color:#3f3f46;margin:0 0 16px">
      Te compartimos nuestra propuesta comercial. En la liga puedes revisar las pantallas, las fechas,
      los importes y los términos, y aceptarla si estás de acuerdo.
    </p>
    <p style="margin:0">
      <a href="${escaparHtml(d.liga)}"
         style="display:inline-block;background:#0a66ff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:6px">
        Ver la propuesta
      </a>
    </p>
    ${vigencia}
    <p style="font-size:12px;color:#71717a;margin:20px 0 0;word-break:break-all">
      Si el botón no abre, copia esta dirección en tu navegador:<br/>${escaparHtml(d.liga)}
    </p>
    <p style="font-size:12px;color:#71717a;margin-top:20px">${firma}</p>
  </div>`
}
