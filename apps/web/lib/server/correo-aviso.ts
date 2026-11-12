import { escaparHtml, htmlMembrete } from './email'
import { traducir } from '@/lib/i18n/diccionario'
import { traducirNotificacion } from '@/lib/i18n/notificaciones'
import type { Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/correo-aviso.ts — el correo de UN aviso de la campana.
// ----------------------------------------------------------------------------
//  AVISOS-CANAL (12/11). Cuando `notificar()` crea un aviso nuevo, se manda
//  este correo a quien lo encendió en Mi cuenta → Avisos. Es el mismo aviso
//  que la campana: mismo título y mismo detalle, en el idioma de los
//  DOCUMENTOS de la instancia (ADR 0049), traducido con la misma regla que la
//  campana (`traducirNotificacion`). Lo que no se reconoce sale tal cual.
//
//  Fuera de un `route.ts` para poder probarlo (como `correo-recordatorios.ts`).
// ============================================================================

export interface AvisoParaCorreo {
  titulo: string
  detalle: string | null
  link: string | null
}

export interface IdentidadOrgAviso {
  nombreOrg: string
  replyTo: string | null
  logoUrl: string | null
}

/**
 * La ruta interna del aviso (`/finanzas`) → la dirección completa. Sin base
 * (`APP_URL` vacío) no hay botón: `notificar()` no tiene petición de la que
 * sacar el origen, y un botón a `localhost` es peor que ninguno.
 *
 * Solo rutas internas que empiezan por UNA barra. El enlace lo escribe el
 * servidor, pero `//otro.com` sería una dirección de otro sitio con la cara
 * de una ruta propia.
 */
export function enlaceDelAviso(base: string, link: string | null): string | null {
  if (!base || !link || !link.startsWith('/') || link.startsWith('//')) return null
  const ruta = link.endsWith('/') ? link : `${link}/`
  // Con barra final: la app corre con `trailingSlash` (ver `lib/medios-url.ts`).
  return `${base.replace(/\/+$/, '')}/spaces-dooh${ruta}`
}

export function asuntoCorreoAviso(aviso: AvisoParaCorreo, org: IdentidadOrgAviso, idioma: Idioma): string {
  const { titulo } = traducirNotificacion({ titulo: aviso.titulo, detalle: aviso.detalle }, idioma)
  return `${titulo} · ${org.nombreOrg}`
}

export function htmlCorreoAviso(
  aviso: AvisoParaCorreo,
  org: IdentidadOrgAviso,
  enlace: string | null,
  idioma: Idioma,
): string {
  const t = traducirNotificacion({ titulo: aviso.titulo, detalle: aviso.detalle }, idioma)
  const boton = enlace
    ? `<p style="margin:20px 0">
      <a href="${escaparHtml(enlace)}" style="display:inline-block;background:#0a66ff;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px">
        ${escaparHtml(traducir(idioma, 'notificaciones.correo.aviso.boton'))}
      </a>
    </p>`
    : ''
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b">
    ${htmlMembrete(org.logoUrl, org.nombreOrg)}
    <h2 style="font-size:18px;margin:0 0 12px">${escaparHtml(t.titulo)}</h2>
    ${t.detalle ? `<p style="font-size:14px;line-height:1.5;color:#3f3f46;margin:0">${escaparHtml(t.detalle)}</p>` : ''}
    ${boton}
    <p style="font-size:12px;color:#71717a;margin-top:20px;line-height:1.5">
      ${escaparHtml(traducir(idioma, 'notificaciones.correo.aviso.pie', { org: org.nombreOrg }))}
    </p>
  </div>`
}
