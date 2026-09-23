import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { esElPanel } from '@/lib/server/flota'
import { listarTicketsDelTenant, listarTicketsDeLaInstancia } from '@/lib/server/tickets-repo'
import type { TicketDeInstancia } from '@/lib/server/tickets-repo'
import { crearTicketCtrl, actualizarTicketDesdePanelCtrl } from '@/lib/server/tickets-controller'
import { AppError, respuestaError } from '@/lib/server/errores'
import { registrarAccion } from '@/lib/server/acciones-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  /api/tickets — ADR 0038.
// ----------------------------------------------------------------------------
//  Esta es la puerta del CLIENTE: sesión, `administracion.ver`/`administracion
//  .crear`, y `listarTicketsDelTenant()`/`crearTicketCtrl()` que ya llevan la
//  segunda capa (`and tenant_id = $n`) sobre la RLS.
//
//  Y desde la Tarea 6 es TAMBIÉN la puerta del PANEL: el mismo `GET` mira
//  primero `x-flota-token` y, si es el panel, responde con los tickets de TODOS
//  los tenants de la instancia (`listarTicketsDeLaInstancia()`, `qRaw`, a
//  propósito). Si la cabecera no viene, o no vale, cae al camino de sesión de
//  abajo, que no cambió ni una línea: las pruebas de la Tarea 5 —«sin sesión
//  401», «sin permiso 403»— siguen pasando tal cual.
//
//  ─── Por qué el orden es ese y no el contrario ────────────────────────────
//  El panel NO tiene sesión: su credencial es la cabecera. Pedirle `exigir()`
//  antes lo dejaría fuera siempre. Y al revés no hay riesgo, porque `esElPanel`
//  es fail-closed: sin `FLOTA_TOKEN` configurado en la instancia devuelve false
//  SIEMPRE, así que la cabecera no puede saltarse el guard de sesión — solo
//  puede identificar a quien ya conocía el secreto.
// ============================================================================

// El recorte del contrato, por LISTA BLANCA: el objeto se construye clave a
// clave. NO se copia lo que da el repo para borrarle lo que sobra, y la
// diferencia importa: el día que `tickets` gane una columna, la forma «copiar y
// borrar» la manda al PADRE sola y en silencio, y ésta no. Es el mismo criterio
// que `resumen()` en `apps/flota/servidor.mjs`, y lo que sostiene la promesa del
// ADR 0038 §4 — viaja el `tenant_id` opaco, nunca `tenants.nombre`.
//
// Se quedan fuera a propósito `creado_por_usuario` (quién de la organización
// escribió es asunto del owner, no de AS OOH) y `actualizado_en` (ruido).
//
// Las claves van en snake_case, y no es un descuido: es el contrato de la
// flota, el que `apps/flota/tickets.mjs` consume. El repo habla camelCase
// hacia dentro de la aplicación; la traducción ocurre aquí, en el borde.
function paraElPanel(t: TicketDeInstancia) {
  return {
    id: t.id,
    folio: t.folio,
    tenant_id: t.tenantId,
    asunto: t.asunto,
    cuerpo: t.cuerpo,
    estado: t.estado,
    prioridad: t.prioridad,
    creado_en: t.creadoEn,
    respuesta: t.respuesta,
    respondido_en: t.respondidoEn,
  }
}

// GET /api/tickets → el panel (con `x-flota-token`) ve la instancia entera;
// cualquier otro ve los tickets de su tenant en sesión (administracion.ver)
export async function GET(req: Request) {
  if (esElPanel(req)) {
    try {
      const tickets = await listarTicketsDeLaInstancia()
      return NextResponse.json(
        { tickets: tickets.map(paraElPanel) },
        // Como `/api/version`: lo que el panel jala es un estado vivo, y una
        // bandeja de soporte cacheada por un intermediario miente.
        { headers: { 'cache-control': 'no-store' } },
      )
    } catch (e) {
      return respuestaError(e)
    }
  }

  const g = await exigir('administracion', 'ver')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    return NextResponse.json(await listarTicketsDelTenant())
  } catch (e) {
    return respuestaError(e)
  }
}

// POST /api/tickets → abre un ticket para el tenant en sesión (requiere administracion.crear)
export async function POST(req: Request) {
  const g = await exigir('administracion', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const ticket = await crearTicketCtrl(await req.json().catch(() => ({})), g.usuario.id)
    await registrarAccion(g.usuario, 'Abrió ticket de soporte', ticket.folio)
    return NextResponse.json(ticket, { status: 201 })
  } catch (e) {
    return respuestaError(e)
  }
}

// PATCH /api/tickets → el panel (con `x-flota-token`, ADR 0038, Tarea 11)
// responde un ticket, mueve su estado, o las dos cosas — de CUALQUIER tenant
// de la instancia, a propósito, igual que el `GET` del panel de arriba.
//
// El `id` viaja en el CUERPO y no en la URL: esta ruta no tiene un segmento
// `[id]` (la Tarea 11 la puso a propósito en el mismo `route.ts` que el resto
// del panel, no en un archivo nuevo), así que el guard, la puerta y la carga
// quedan en el mismo sitio que el `GET`/`POST` de arriba en vez de repartirse
// entre dos archivos que tendrían que mantenerse sincronizados.
//
// Sin `x-flota-token` válido, 401 y NADA se toca: no hay camino de sesión de
// respaldo como en el `GET` — un cliente no tiene forma legítima de mandar
// este verbo, así que no hace falta un segundo camino al que caer.
export async function PATCH(req: Request) {
  if (!esElPanel(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { id?: unknown; [k: string]: unknown }
    const { id, ...cambios } = body
    if (typeof id !== 'string' || id.trim() === '') {
      throw new AppError('Falta el id del ticket', 400)
    }
    const ticket = await actualizarTicketDesdePanelCtrl(id, cambios)
    return NextResponse.json(paraElPanel(ticket), { headers: { 'cache-control': 'no-store' } })
  } catch (e) {
    return respuestaError(e)
  }
}
