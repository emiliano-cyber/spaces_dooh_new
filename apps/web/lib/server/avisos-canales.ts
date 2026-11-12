import 'server-only'
import { emailHabilitado, enviarEmail, remitenteDeOrganizacion } from './email'
import { asuntoCorreoAviso, enlaceDelAviso, htmlCorreoAviso } from './correo-aviso'
import { idiomaDeLaInstancia } from './idioma-instancia'
import {
  destinatariosDeAviso,
  destinatariosDeAvisoSinSesion,
  identidadDeOrg,
  identidadDeOrgSinSesion,
  type DestinatarioAviso,
  type IdentidadOrgFila,
} from './avisos-repo'
import { urlLogo } from '@/lib/medios-url'
import { TIPOS_AVISO, type CanalAviso, type TipoAviso } from '@/lib/avisos'

// ============================================================================
//  lib/server/avisos-canales.ts — los avisos de la campana, también por correo
//  (AVISOS-CANAL, 12/11). WhatsApp, sembrado.
// ----------------------------------------------------------------------------
//  Pedido del dueño: «hacer los avisos por correo y dejar sembrada la opción de
//  envío por WhatsApp; lo de olvidé contraseña, solo correo».
//
//  · CORREO: cuando `notificar()` crea un aviso NUEVO (no un eco del mismo día),
//    se manda a quien lo encendió en Configuración → Avisos. Por Resend o por
//    Brevo, según `EMAIL_PROVEEDOR` (`lib/correo-proveedor.ts`).
//  · WHATSAPP: sembrado. La pantalla enseña la columna apagada y la cuenta
//    guarda el teléfono, pero no se envía nada ni se acepta una preferencia por
//    ese canal (`CANALES_QUE_SE_GUARDAN`). Cuando haya cuenta de WhatsApp
//    Business, el envío entra en `enviarWhatsapp()` y el canal se añade a esa
//    lista: la tabla, el teléfono y la pantalla ya están.
//  · RECUPERAR CONTRASEÑA e INVITACIONES no pasan por aquí: llevan un enlace
//    para entrar a la cuenta y van siempre por correo a la dirección de la
//    cuenta (`app/api/auth/forgot/route.ts`, `usuarios-controller.ts`). Lo vigila
//    `avisos-solo-correo.test.ts`.
// ============================================================================

/** Los canales en los que hoy se puede ENCENDER un aviso. */
export const CANALES_QUE_SE_GUARDAN: readonly CanalAviso[] = ['correo']

export function estadoCanales() {
  return {
    // Se puede encender aunque no haya clave todavía: el día que la pongan,
    // empieza a salir sin que nadie vuelva a entrar a marcarlo. La pantalla
    // avisa de que hoy no sale.
    correo: { configurado: emailHabilitado() },
    whatsapp: { configurado: false, sembrado: true },
  }
}

/**
 * SEMBRADO. Aquí entrará el envío por la API de WhatsApp Business de Meta
 * (`WHATSAPP_TOKEN`, `WHATSAPP_NUMERO_ID`), con una plantilla aprobada por Meta
 * por cada tipo de aviso — WhatsApp no deja mandar texto libre a quien no
 * escribió primero. Hoy no la llama nadie y no envía nada.
 */
export async function enviarWhatsapp(_telefono: string, _aviso: AvisoNuevo): Promise<'sembrado'> {
  return 'sembrado'
}

export interface AvisoNuevo {
  tipo: string
  titulo: string
  detalle: string | null
  link: string | null
}

export interface DependenciasAviso {
  destinatarios: (tenantId: string, tipo: TipoAviso, canal: CanalAviso) => Promise<DestinatarioAviso[]>
  identidad: (tenantId: string) => Promise<IdentidadOrgFila | null>
  /** La raíz pública para el botón y el logo. Vacía = sin botón. */
  base: string
}

const DEPENDENCIAS: DependenciasAviso = {
  destinatarios: destinatariosDeAviso,
  identidad: identidadDeOrg,
  base: process.env.APP_URL ?? '',
}

/**
 * Para los avisos que nacen SIN sesión (la aceptación por liga pública): el
 * tenant sale del registro y se fija explícito. Se llama después del `commit`.
 */
export const DEPENDENCIAS_SIN_SESION: DependenciasAviso = {
  destinatarios: destinatariosDeAvisoSinSesion,
  identidad: identidadDeOrgSinSesion,
  base: process.env.APP_URL ?? '',
}

const esTipoAviso = (t: string): t is TipoAviso => (TIPOS_AVISO as readonly string[]).includes(t)

/**
 * Busca a quién mandar y deja los correos SALIENDO, sin esperarlos.
 *
 * Lo que se espera es solo lo de la base (dos consultas, con el tenant de la
 * petición todavía vivo). El envío va suelto (`enviando`) porque `notificar()`
 * se llama en medio de guardar una factura o un pago, y esa operación no puede
 * tardar lo que tarde el proveedor de correo, ni fallar si el proveedor falla.
 * Las pruebas esperan `enviando`; `notificar()` no.
 */
export async function avisarPorCanales(
  tenantId: string,
  aviso: AvisoNuevo,
  deps: DependenciasAviso = DEPENDENCIAS,
): Promise<{ correo: number; enviando: Promise<void> }> {
  const nada = { correo: 0, enviando: Promise.resolve() }
  if (!esTipoAviso(aviso.tipo)) return nada
  if (!emailHabilitado()) return nada

  const dest = await deps.destinatarios(tenantId, aviso.tipo, 'correo')
  if (!dest.length) return nada
  const org = await deps.identidad(tenantId)
  const nombreOrg = org?.nombre ?? 'Space OS'
  // ADR 0049 · en el idioma de los DOCUMENTOS de la instancia, como los demás correos.
  const idioma = await idiomaDeLaInstancia()
  const identidad = { nombreOrg, replyTo: org?.email_remitente ?? null, logoUrl: urlLogo(deps.base, org?.logo_token ?? null) }
  const subject = asuntoCorreoAviso(aviso, identidad, idioma)
  const html = htmlCorreoAviso(aviso, identidad, enlaceDelAviso(deps.base, aviso.link), idioma)
  // Canal de OPERACIÓN: el buzón de la plataforma a nombre de la organización,
  // y quien responda le contesta a ELLA (`config_negocio.email_remitente`).
  const from = remitenteDeOrganizacion(nombreOrg)

  const enviando = (async () => {
    for (const d of dest) {
      try {
        await enviarEmail({ to: d.email, subject, html, from, replyTo: identidad.replyTo })
      } catch (e) {
        // Uno que falla no tumba a los demás. Al registro, sin la dirección
        // completa de nadie: basta con saber que falló y por qué.
        console.error('[avisos] no salió un correo de aviso:', e instanceof Error ? e.message : e)
      }
    }
  })()
  return { correo: dest.length, enviando }
}
