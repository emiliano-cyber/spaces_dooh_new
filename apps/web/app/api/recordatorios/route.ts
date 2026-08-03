import { NextResponse } from 'next/server'
import { pool, fijarTenantExplicito, qRaw } from '@/lib/server/db'
import { enviarEmail, emailHabilitado } from '@/lib/server/email'
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

      // Los ya creados HOY para este contrato+motivo. El motivo va dentro de
      // `tipo` para poder distinguirlos sin añadir columnas a la tabla.
      const { rows: yaHoy } = await client.query(
        `select tipo from notificaciones
          where tipo like 'contrato:%' and creado_en >= date_trunc('day', now())`,
      )
      const existentes = new Set(yaHoy.map((r: { tipo: string }) => r.tipo))

      let creados = 0
      for (const a of avisos) {
        const tipo = `contrato:${a.motivo}:${a.contratoId}`
        if (existentes.has(tipo)) continue
        await client.query(
          `insert into notificaciones (tipo, nivel, titulo, detalle, link, tenant_id)
           values ($1,$2,$3,$4,$5,$6)`,
          [tipo, a.nivel, a.titulo, a.detalle, '/arrendadores', t.id],
        )
        creados++
      }
      // Destinatarios DENTRO de la transacción: `usuarios` es fail-closed y aquí
      // el tenant ya está fijado, así que la RLS los acota sola. Leerlos fuera
      // con `qRaw` habría devuelto cero filas en silencio (sin app.tenant_id no
      // se ve nada), y el correo simplemente no se habría mandado nunca sin que
      // nada lo dijera.
      const { rows: dest } = await client.query<{ email: string }>(
        `select email from usuarios where rol = 'DUENO' and activo = true`,
      )
      await client.query('commit')

      const correo = await avisarPorCorreo(dest, avisos, creados)
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
async function avisarPorCorreo(
  dest: { email: string }[],
  avisos: Recordatorio[],
  creados: number,
): Promise<string> {
  if (creados === 0) return 'sin novedades'
  if (!emailHabilitado()) return 'correo no configurado (solo notificación en la app)'
  if (!dest.length) return 'sin destinatarios'

  const html = htmlRecordatorios(avisos)
  const asunto = `Contratos que necesitan atención: ${resumenRecordatorios(avisos)}`
  let ok = 0
  for (const d of dest) {
    try {
      await enviarEmail({ to: d.email, subject: asunto, html })
      ok++
    } catch {
      /* un correo que falla no debe tumbar el barrido de los demás tenants */
    }
  }
  return `${ok}/${dest.length} enviados`
}

function htmlRecordatorios(avisos: Recordatorio[]): string {
  const item = (a: Recordatorio) => `
    <li style="margin:0 0 10px;font-size:14px;line-height:1.45;color:#3f3f46">
      <b style="color:#18181b">${escapar(a.titulo)}</b><br/>${escapar(a.detalle)}
    </li>`
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b">
    <h2 style="font-size:18px;margin:0 0 12px">Contratos que necesitan atención</h2>
    <ul style="padding-left:18px;margin:0">${avisos.map(item).join('')}</ul>
    <p style="font-size:12px;color:#71717a;margin-top:20px">
      Space OS · este aviso se envía una vez al día y solo cuando hay algo nuevo.
    </p>
  </div>`
}

// El título lleva nombres de predio y arrendador, que los escribe una persona.
function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
