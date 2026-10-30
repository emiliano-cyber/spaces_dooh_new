import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { q1 } from './db'
import { tenantActual } from './tenant'
import { emailHabilitado, enviarEmail, remitenteDeOrganizacion } from './email'
import { cambiarEstatusPropuesta, PropuestaError } from './propuestas-repo'
import { vigenciaPropuestaDelTenant } from './config-repo'
import { asuntoCorreoPropuesta, htmlCorreoPropuesta } from './propuesta-correo'
import { urlLogo } from '@/lib/medios-url'
import { esEmailValido, EMAIL_INVALIDO } from '@/lib/validacion'
import { fechaLocalISO } from '@/lib/fecha-local'
import { formatFecha } from '@/lib/data/derive'
import { vigenciaDesde } from '@/lib/propuesta-vigencia'

// ============================================================================
//  lib/server/propuestas-envio.ts — «Enviar» manda la propuesta por CORREO
//  (PROP-COMPLETA, decisión del dueño del 29/10).
//
//  Hasta hoy «Enviar» solo cambiaba el estatus y la liga se copiaba a mano. Ahora:
//
//    1. Se manda la liga al cliente por el canal de OPERACIÓN (a nombre de la
//       organización, con su correo en Reply-To) y con COPIA a quien la envía.
//    2. Solo si el correo salió, la propuesta pasa a ENVIADA (y con eso toma
//       su vigencia). Si Resend falla se contesta 502 y NO cambia nada: el
//       vendedor reintenta o copia la liga, y la propuesta no dice «enviada»
//       de algo que no llegó.
//    3. Sin correo configurado en la instancia, solo cambia el estatus y la
//       respuesta lo dice (`correo: 'no_configurado'`) para que la pantalla
//       avise de que la liga hay que mandarla a mano.
//
//  Se puede REENVIAR una ENVIADA (decisión del dueño): tras renegociar, o si
//  venció — volver a enviarla la renueva (`cambiarEstatusPropuesta`).
// ============================================================================

const envioSchema = z.object({
  para: z
    .string()
    .trim()
    .max(254, 'El correo no puede pasar de 254 caracteres')
    .refine((v) => esEmailValido(v), { message: EMAIL_INVALIDO }),
  mensaje: z.string().max(2000, 'El mensaje no puede pasar de 2000 caracteres').nullish(),
})

export type ResultadoEnvio = {
  propuesta: NonNullable<Awaited<ReturnType<typeof cambiarEstatusPropuesta>>>
  correo: 'enviado' | 'no_configurado'
  para: string
}

export async function enviarPropuestaCtrl(
  id: string,
  body: unknown,
  ctx: { baseUrl: string; remitente: { nombre: string; email: string } },
): Promise<ResultadoEnvio> {
  const d = validar(envioSchema, body)
  const tenant = await tenantActual()
  // Con `tenant_id` además de la RLS: el id llega por la URL.
  const p = await q1<any>(
    `select estatus, nombre, folio, token_publico,
            to_char(vigente_hasta, 'YYYY-MM-DD') as vigente_hasta,
            (vigente_hasta < current_date) as vencida
       from propuestas where id = $1 and tenant_id = $2`,
    [id, tenant],
  )
  if (!p) throw new AppError('Propuesta no encontrada', 404)
  if (p.estatus !== 'BORRADOR' && p.estatus !== 'ENVIADA') {
    throw new AppError('Solo se envía una propuesta en borrador o ya enviada', 409)
  }
  if (!p.token_publico) throw new AppError('Esta propuesta no tiene liga; vuelve a guardarla', 409)

  let correo: ResultadoEnvio['correo'] = 'no_configurado'
  if (emailHabilitado()) {
    const org = await q1<any>(
      `select t.nombre, c.email_remitente, c.logo_token
         from tenants t left join config_negocio c on c.tenant_id = t.id
        where t.id = $1`,
      [tenant],
    )
    const orgNombre = org?.nombre ?? 'Spaces'
    // La fecha que la propuesta TENDRÁ tras este envío: la suya si sigue
    // vigente, o hoy + los días de la organización (lo mismo que escribe
    // `cambiarEstatusPropuesta` un instante después).
    const vigente = p.vigente_hasta && p.vencida !== true
      ? p.vigente_hasta
      : vigenciaDesde(fechaLocalISO(), await vigenciaPropuestaDelTenant())
    const datos = {
      orgNombre,
      logoUrl: urlLogo(ctx.baseUrl, org?.logo_token ?? null),
      propuestaNombre: p.nombre,
      folio: p.folio,
      // Con barra final: la app corre con `trailingSlash` (ver `lib/medios-url.ts`).
      liga: `${ctx.baseUrl.replace(/\/+$/, '')}/spaces-dooh/p/${p.token_publico}/`,
      vigenteHasta: formatFecha(vigente),
      mensaje: d.mensaje ?? null,
      remitenteNombre: ctx.remitente.nombre,
    }
    try {
      await enviarEmail({
        to: d.para,
        cc: ctx.remitente.email !== d.para ? ctx.remitente.email : null,
        from: remitenteDeOrganizacion(orgNombre),
        replyTo: org?.email_remitente ?? null,
        subject: asuntoCorreoPropuesta(datos),
        html: htmlCorreoPropuesta(datos),
      })
    } catch (e) {
      console.error('[propuestas] no salió el correo de envío:', e)
      throw new AppError(
        'No se pudo enviar el correo. La propuesta no cambió: inténtalo de nuevo o copia la liga y mándala tú.',
        502,
      )
    }
    correo = 'enviado'
  }

  try {
    const prop = await cambiarEstatusPropuesta(id, 'ENVIADA')
    if (!prop) throw new AppError('Propuesta no encontrada', 404)
    return { propuesta: prop, correo, para: d.para }
  } catch (e) {
    if (e instanceof PropuestaError) throw new AppError(e.message, 409)
    throw e
  }
}
