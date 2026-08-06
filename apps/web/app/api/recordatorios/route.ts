import { NextResponse } from 'next/server'
import { pool, fijarTenantExplicito, qRaw } from '@/lib/server/db'
import {
  enviarEmail,
  emailHabilitado,
  remitenteDeOrganizacion,
  htmlMembrete,
  escaparHtml,
} from '@/lib/server/email'
import { urlLogo } from '@/lib/medios-url'
import {
  recordatoriosDeContratos,
  resumenRecordatorios,
  type ContratoParaAviso,
  type Recordatorio,
} from '@/lib/recordatorios-contratos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  POST /api/recordatorios — Barrido diario de contratos.
// ----------------------------------------------------------------------------
//  Lo dispara el cron del droplet, NO un usuario. Por eso no lleva `exigir()`:
//  no hay sesión que comprobar. Se autentica con un token compartido en la
//  cabecera, y sin ese token configurado la ruta responde 503 en vez de correr
//  abierta — un endpoint que escribe notificaciones a todos los tenants no
//  puede quedar expuesto por olvidar una variable de entorno.
//
//  Recorre TODOS los tenants, porque el cron es del servidor y no de nadie en
//  particular. Cada uno se procesa con su `app.tenant_id` fijado, así la RLS
//  sigue aplicando igual que en una petición normal.
//
//  Es idempotente por día: antes de crear un aviso comprueba que no exista ya
//  uno del mismo contrato y motivo creado hoy. Si el cron se dispara dos veces
//  —o alguien lo llama a mano para probar— no se duplica nada.
// ============================================================================

const TOKEN = process.env.RECORDATORIOS_TOKEN ?? ''

interface FilaTenant {
  id: string
  nombre: string
}

export async function POST(req: Request) {
  if (!TOKEN) {
    return NextResponse.json(
      { error: 'RECORDATORIOS_TOKEN no está configurado en el servidor' },
      { status: 503 },
    )
  }
  const enviado = req.headers.get('x-recordatorios-token') ?? ''
  // Comparación de longitud constante no hace falta aquí (el token no se puede
  // sondear a ciegas sin ruido en los logs), pero sí evitar el 200 accidental.
  if (enviado !== TOKEN) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const hoy = new Date()
  // Para el logo del membrete, que viaja dentro del correo y necesita URL
  // absoluta. `APP_URL` primero: lo dispara el cron del droplet, y ahí el
  // origen de la petición es `localhost`, que no le sirve a nadie que abra el
  // correo desde fuera.
  const base = process.env.APP_URL || new URL(req.url).origin
  const tenants = await qRaw<FilaTenant>('select id, nombre from tenants order by creado_en')
  const porTenant: { tenant: string; creados: number; total: number; correo: string }[] = []

  for (const t of tenants) {
    const client = await pool.connect()
    try {
      await client.query('begin')
      await fijarTenantExplicito(client, t.id)

      const { rows } = await client.query(
        `select c.id, c.estatus, c.fecha_fin as "fechaFin",
                a.nombre as "arrendadorNombre",
                s.nombre as "sitioNombre",
                p.nombre as "predioNombre"
           from contratos_arrendamiento c
           left join arrendadores a on a.id = c.arrendador_id
           left join sitios s       on s.id = c.sitio_id
           left join predios p      on p.id = c.predio_id`,
      )
      const avisos = recordatoriosDeContratos(rows as ContratoParaAviso[], hoy)

      // El «una vez al día» lo aplica la propia sentencia, con la MISMA regla
      // que `notificar()` (notificaciones-repo.ts): insertar solo si no existe
      // ya hoy una idéntica. Antes esto llevaba su propia comprobación en dos
      // pasos —consultar y luego insertar— y tener dos reglas distintas para lo
      // mismo era pedir que divergieran. El motivo va dentro de `tipo` para
      // distinguirlos sin añadir columnas a la tabla.
      let creados = 0
      for (const a of avisos) {
        const tipo = `contrato:${a.motivo}:${a.contratoId}`
        const r = await client.query(
          `insert into notificaciones (tipo, nivel, titulo, detalle, link, tenant_id)
           select $1,$2,$3,$4,$5,$6
            where not exists (
              select 1 from notificaciones
               where tenant_id = $6 and tipo = $1
                 and creado_en >= date_trunc('day', now())
            )`,
          [tipo, a.nivel, a.titulo, a.detalle, '/arrendadores', t.id],
        )
        creados += r.rowCount ?? 0
      }
      // Destinatarios DENTRO de la transacción: `usuarios` es fail-closed y aquí
      // el tenant ya está fijado, así que la RLS los acota sola. Leerlos fuera
      // con `qRaw` habría devuelto cero filas en silencio (sin app.tenant_id no
      // se ve nada), y el correo simplemente no se habría mandado nunca sin que
      // nada lo dijera.
      const { rows: dest } = await client.query<{ email: string }>(
        `select email from usuarios where rol = 'DUENO' and activo = true`,
      )
      // La identidad de correo de ESTA organización, y por el mismo motivo que
      // los destinatarios: `config_negocio` es fail-closed + FORCE desde el ADR
      // 0011, así que leerla fuera de la transacción —sin `app.tenant_id`—
      // devolvería cero filas EN SILENCIO y todos los avisos saldrían con la
      // identidad genérica sin que nada lo dijera. Es el mismo modo de fallo
      // que dejó el desbloqueo de contraseña inservible durante un despliegue
      // entero (43f9284): la consulta no falla, contesta vacío.
      const { rows: cfg } = await client.query<{
        email_remitente: string | null
        logo_token: string | null
      }>(
        `select email_remitente, logo_token from config_negocio where tenant_id = $1`,
        [t.id],
      )
      await client.query('commit')

      const correo = await avisarPorCorreo(dest, avisos, creados, {
        nombreOrg: t.nombre,
        replyTo: cfg[0]?.email_remitente ?? null,
        logoUrl: urlLogo(base, cfg[0]?.logo_token ?? null),
      })
      porTenant.push({ tenant: t.nombre, creados, total: avisos.length, correo })
    } catch (e) {
      await client.query('rollback').catch(() => {})
      porTenant.push({
        tenant: t.nombre,
        creados: 0,
        total: 0,
        correo: `error: ${e instanceof Error ? e.message : 'desconocido'}`,
      })
    } finally {
      client.release()
    }
  }

  return NextResponse.json({ fecha: hoy.toISOString().slice(0, 10), tenants: porTenant })
}

// Un solo correo por tenant con el resumen, no uno por contrato: nueve correos
// seguidos se archivan sin leer y el décimo, el que importaba, con ellos.
// Solo se manda si hubo avisos NUEVOS hoy; si no, sería un correo diario que
// dice lo mismo y que se aprende a ignorar.
interface IdentidadOrg {
  nombreOrg: string
  replyTo: string | null
  logoUrl: string | null
}

async function avisarPorCorreo(
  dest: { email: string }[],
  avisos: Recordatorio[],
  creados: number,
  org: IdentidadOrg,
): Promise<string> {
  if (creados === 0) return 'sin novedades'
  if (!emailHabilitado()) return 'correo no configurado (solo notificación en la app)'
  if (!dest.length) return 'sin destinatarios'

  const html = htmlRecordatorios(avisos, org)
  const asunto = `Contratos que necesitan atención: ${resumenRecordatorios(avisos)}`
  // Canal de OPERACIÓN: sale del buzón verificado de la plataforma pero a
  // nombre de la organización, y quien responda le contesta a ELLA. Si el Dueño
  // todavía no configuró su correo, `replyTo` va nulo y el aviso sale igual —
  // sin dirección de respuesta, que es mejor que no mandarlo.
  const from = remitenteDeOrganizacion(org.nombreOrg)
  let ok = 0
  for (const d of dest) {
    try {
      await enviarEmail({ to: d.email, subject: asunto, html, from, replyTo: org.replyTo })
      ok++
    } catch {
      /* un correo que falla no debe tumbar el barrido de los demás tenants */
    }
  }
  return `${ok}/${dest.length} enviados`
}

function htmlRecordatorios(avisos: Recordatorio[], org: IdentidadOrg): string {
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
