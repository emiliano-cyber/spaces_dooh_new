import { escaparHtml, htmlMembrete } from './email'
import { resumenRecordatorios, type Recordatorio } from '@/lib/recordatorios-contratos'
import { traducir } from '@/lib/i18n/diccionario'
import { traducirNotificacion } from '@/lib/i18n/notificaciones'
import type { Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  lib/server/correo-recordatorios.ts — el correo diario de contratos.
// ----------------------------------------------------------------------------
//  Vivia dentro de `app/api/recordatorios/route.ts`. Salio de ahi (ADR 0049)
//  para poder probarlo: un `route.ts` solo puede exportar sus manejadores.
// ============================================================================

export interface IdentidadOrg {
  nombreOrg: string
  replyTo: string | null
  logoUrl: string | null
}

// ADR 0049 · en el idioma de los DOCUMENTOS de la instancia. En espanol, las
// plantillas literales de siempre; en ingles e italiano, el diccionario
// (`notificaciones.correo.*`) y, para cada aviso, la misma traduccion que la
// campanita (`traducirNotificacion`, ola 6 del ingles).
export function asuntoRecordatorios(avisos: Recordatorio[], idioma: Idioma = 'es'): string {
  if (idioma !== 'es') {
    return traducir(idioma, 'notificaciones.correo.contratos.asunto', { resumen: resumenTraducido(avisos, idioma) })
  }
  return `Contratos que necesitan atención: ${resumenRecordatorios(avisos)}`
}

function resumenTraducido(avisos: Recordatorio[], idioma: Idioma): string {
  const n = (m: Recordatorio['motivo']) => avisos.filter((a) => a.motivo === m).length
  const vencidos = n('VENCIDO')
  return [
    vencidos
      ? traducir(idioma, vencidos === 1 ? 'notificaciones.correo.resumen.vencido.uno' : 'notificaciones.correo.resumen.vencido.otros', { n: vencidos })
      : '',
    n('POR_VENCER') ? traducir(idioma, 'notificaciones.correo.resumen.por-vencer', { n: n('POR_VENCER') }) : '',
    n('INCOMPLETO') ? traducir(idioma, 'notificaciones.correo.resumen.sin-capturar', { n: n('INCOMPLETO') }) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function htmlRecordatorios(avisos: Recordatorio[], org: IdentidadOrg, idioma: Idioma = 'es'): string {
  if (idioma !== 'es') return htmlRecordatoriosTraducido(avisos, org, idioma)
  const item = (a: Recordatorio) => `
    <li style="margin:0 0 10px;font-size:14px;line-height:1.45;color:#3f3f46">
      <b style="color:#18181b">${escapar(a.titulo)}</b><br/>${escapar(a.detalle)}
    </li>`
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b">
    ${htmlMembrete(org.logoUrl, org.nombreOrg)}
    <h2 style="font-size:18px;margin:0 0 12px">Contratos que necesitan atención</h2>
    <ul style="padding-left:18px;margin:0">${avisos.map(item).join('')}</ul>
    <p style="font-size:12px;color:#71717a;margin-top:20px">
      ${escapar(org.nombreOrg)} · este aviso se envía una vez al día y solo cuando hay algo nuevo.
    </p>
  </div>`
}

// El título lleva nombres de predio y arrendador, que los escribe una persona.
// Se reexporta el de `email.ts` en vez de tener una copia: dos escapadores para
// lo mismo acaban divergiendo, y aquí el que se quedara corto no daría un fallo
// visible — daría un correo con HTML inyectado. Es el mismo motivo por el que
// `TIPO_LABEL` dejó de estar copiado en cinco componentes (M10).
const escapar = escaparHtml

function htmlRecordatoriosTraducido(avisos: Recordatorio[], org: IdentidadOrg, idioma: Idioma): string {
  const item = (original: Recordatorio) => {
    const a = traducirNotificacion(original, idioma)
    return `
    <li style="margin:0 0 10px;font-size:14px;line-height:1.45;color:#3f3f46">
      <b style="color:#18181b">${escapar(a.titulo)}</b><br/>${escapar(a.detalle)}
    </li>`
  }
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b">
    ${htmlMembrete(org.logoUrl, org.nombreOrg)}
    <h2 style="font-size:18px;margin:0 0 12px">${escapar(traducir(idioma, 'notificaciones.correo.contratos.titulo'))}</h2>
    <ul style="padding-left:18px;margin:0">${avisos.map(item).join('')}</ul>
    <p style="font-size:12px;color:#71717a;margin-top:20px">
      ${escapar(traducir(idioma, 'notificaciones.correo.contratos.pie', { org: org.nombreOrg }))}
    </p>
  </div>`
}
