import 'server-only'
import type { PoolClient } from 'pg'
import { q, qRaw, withTenantTx } from './db'
import { tenantActual } from './tenant'
import { folioDocumento } from './folios'

// ============================================================================
//  lib/server/tickets-repo.ts — ADR 0038.
// ----------------------------------------------------------------------------
//  ESTE ARCHIVO USA LOS DOS ESTILOS A PROPOSITO, Y ESO NO ES UN DESCUIDO:
//
//   · Lo que pide el CLIENTE va por `q`/`q1` (fija `app.tenant_id`) y ademas
//     lleva `and tenant_id = $n`. Doble capa, como todo el resto del producto.
//
//   · Lo que pide el PANEL va por `qRaw` y NO filtra por tenant: el panel es
//     AS OOH preguntando por la instancia entera. Es la zona roja R2, cuyo modo
//     de fallo es SILENCIOSO, asi que va probado EN PAREJA — que el lado del
//     cliente aisla y que el del panel atraviesa. Una sola de las dos pruebas
//     no demuestra nada: un guard roto pasaria la primera.
//
//  Y el lado del panel NO selecciona `tenants.nombre` (ADR 0038 §4): viaja el
//  uuid opaco para poder agrupar sin aprender de quien es.
//
//  (Esta cabecera reproduce el texto del brief. Los imports reales de abajo son
//  `q`, `qRaw` y `withTenantTx` — `q1` no aparece porque ninguna de las cuatro
//  funciones de este archivo hace una lectura de una sola fila por su cuenta:
//  `crearTicket` inserta con `returning *` dentro de la misma transaccion que
//  reserva el folio, y `listarTicketsDelTenant` siempre devuelve una lista.)
// ============================================================================

export type EstadoTicket = 'ABIERTO' | 'EN_PROCESO' | 'RESUELTO' | 'CERRADO'
export type PrioridadTicket = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE'

const iso = (v: unknown): string | null => (v instanceof Date ? v.toISOString() : (v as string | null))

// Fila tal como la ve el CLIENTE: nunca lleva `tenant_id` (ya sabe de quien es).
export interface Ticket {
  id: string
  folio: string
  asunto: string
  cuerpo: string
  estado: EstadoTicket
  prioridad: PrioridadTicket
  creadoPorUsuario: string | null
  creadoEn: string | null
  actualizadoEn: string | null
  respuesta: string | null
  respondidoEn: string | null
}

// Fila tal como la ve el PANEL: agrega `tenantId`, el uuid opaco, para poder
// agrupar y filtrar por organizacion SIN aprender su nombre (ADR 0038 §4).
export interface TicketDeInstancia extends Ticket {
  tenantId: string
}

function filaATicket(r: any): Ticket {
  return {
    id: r.id,
    folio: r.folio,
    asunto: r.asunto,
    cuerpo: r.cuerpo,
    estado: r.estado,
    prioridad: r.prioridad,
    creadoPorUsuario: r.creado_por_usuario ?? null,
    creadoEn: iso(r.creado_en),
    actualizadoEn: iso(r.actualizado_en),
    respuesta: r.respuesta ?? null,
    respondidoEn: r.respondido_en ? iso(r.respondido_en) : null,
  }
}

function filaATicketDeInstancia(r: any): TicketDeInstancia {
  return { ...filaATicket(r), tenantId: r.tenant_id }
}

// ─── Lado del CLIENTE — q, con tenant, doble capa ───────────────────────────

// Los tickets del tenant en sesion. La RLS ya aisla por si sola; el
// `and tenant_id = $n` explicito es la segunda capa que exige la convencion
// del repo (`vault/06-Operacion/convenciones.md`) y la que de verdad protege
// si algun dia una tabla nace sin politica o alguien reusa esta consulta desde
// un contexto sin GUC.
export async function listarTicketsDelTenant(): Promise<Ticket[]> {
  const tenantId = await tenantActual()
  const filas = await q<any>(
    'select * from tickets where tenant_id = $1 order by creado_en desc',
    [tenantId],
  )
  return filas.map(filaATicket)
}

export interface AltaTicket {
  asunto: string
  cuerpo: string
  prioridad?: PrioridadTicket
  creadoPorUsuario?: string | null
}

// Abre un ticket para el tenant en sesion. El folio sale de `folioDocumento`
// (T2) DENTRO de la misma transaccion que el insert: si el insert fallara
// despues, el folio reservado se pierde con el rollback en vez de quedar
// consumido sin ticket que lo use (folios.ts ya documenta que los huecos son
// aceptables).
export async function crearTicket(input: AltaTicket): Promise<Ticket> {
  const tenantId = await tenantActual()
  return withTenantTx(async (client: PoolClient) => {
    const folio = await folioDocumento('ticket', client)
    const { rows } = await client.query(
      `insert into tickets (tenant_id, folio, asunto, cuerpo, prioridad, creado_por_usuario)
       values ($1,$2,$3,$4,$5,$6)
       returning *`,
      [tenantId, folio, input.asunto, input.cuerpo, input.prioridad ?? 'NORMAL', input.creadoPorUsuario ?? null],
    )
    return filaATicket(rows[0])
  })
}

// ─── Lado del PANEL — qRaw, sin tenant, a proposito ─────────────────────────

// Todos los tickets de la instancia, de cualquier organizacion: AS OOH
// preguntando por su bandeja de soporte completa. `qRaw` es correcto aqui, no
// un descuido — el panel no tiene (ni debe tener) un tenant activo. NO hace
// join contra `tenants`: agrupa por `tenantId` (uuid opaco), nunca por nombre.
export async function listarTicketsDeLaInstancia(): Promise<TicketDeInstancia[]> {
  const filas = await qRaw<any>('select * from tickets order by creado_en desc')
  return filas.map(filaATicketDeInstancia)
}

// Lo que el panel puede tocar en un PATCH. Los dos campos son opcionales
// porque el panel puede mandar uno solo -- responder sin mover el estado es
// el caso normal (T11, ADR 0038 y el ruling de T3: responder no es resolver).
export interface CambiosDePanel {
  respuesta?: string
  estado?: EstadoTicket
}

// Actualiza un ticket POR SU ID, sin filtrar por tenant: es el panel
// atravesando fronteras de organizacion a proposito (ADR 0038). La RLS de
// `tickets` no corta aqui porque `qRaw` no fija `app.tenant_id` — esa
// ausencia de filtro es la caracteristica, no el bug R2 (que es la MISMA
// ausencia pero del lado del cliente, donde `q` SI fija el tenant).
//
// ESCRIBE SOLO LO QUE LLEGA. El `set` se arma campo a campo con lo que trae
// `cambios`, nunca con una plantilla fija de las dos columnas: si se fijara
// siempre `respondido_en = now()`, un PATCH que solo mueve el estado
// mentiria en la pantalla que AS OOH ya contesto sin haber escrito una
// palabra (Tarea 11, revision #1). Y `estado` NUNCA se mueve por escribir
// `respuesta`: son dos `set` independientes, cada uno atado a su propio
// campo de entrada -- la decision de la Tarea 3 (responder no es resolver)
// sigue valiendo aqui exactamente igual que en el POST original.
export async function actualizarTicketDesdePanel(
  id: string,
  cambios: CambiosDePanel,
): Promise<TicketDeInstancia | null> {
  const sets: string[] = []
  const params: unknown[] = [id]

  if (cambios.respuesta !== undefined) {
    params.push(cambios.respuesta)
    sets.push(`respuesta = $${params.length}`)
    sets.push('respondido_en = now()')
  }
  if (cambios.estado !== undefined) {
    params.push(cambios.estado)
    sets.push(`estado = $${params.length}`)
  }

  // Un `update` sin `set` es un error de sintaxis o, peor, un no-op
  // silencioso -- el controller ya lo rechaza con 400 antes de llegar aqui
  // (`.strict().refine(...)` en tickets-controller.ts), pero esta funcion no
  // depende de que su unico llamador lo haga bien: si algun dia otro camino
  // la invoca sin validar, revienta aqui y no con un UPDATE vacio contra la
  // base.
  if (sets.length === 0) {
    throw new Error('actualizarTicketDesdePanel: sin campos que actualizar')
  }
  sets.push('actualizado_en = now()')

  const filas = await qRaw<any>(
    `update tickets set ${sets.join(', ')} where id = $1 returning *`,
    params,
  )
  return filas[0] ? filaATicketDeInstancia(filas[0]) : null
}
