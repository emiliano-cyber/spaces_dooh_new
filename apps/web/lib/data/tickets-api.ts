'use client'

// ============================================================================
//  lib/data/tickets-api.ts — Tickets de soporte del tenant en sesion (ADR 0038,
//  tarea 7). El tipo vive aqui, no en lib/server/tickets-repo.ts, por la misma
//  razon que actualizaciones-api.ts: ese archivo hace `import 'server-only'` y
//  arrastra `pg` al bundle del navegador si un componente de cliente lo
//  importa. Se copia la forma de `Ticket` (el lado del CLIENTE, sin
//  `tenantId`: `TicketDeInstancia` es solo del panel del PADRE y no aplica
//  aqui) y no se toca de este lado.
// ============================================================================

export type EstadoTicket = 'ABIERTO' | 'EN_PROCESO' | 'RESUELTO' | 'CERRADO'
export type PrioridadTicket = 'BAJA' | 'NORMAL' | 'ALTA' | 'URGENTE'

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

const API = '/spaces-dooh/api'

async function jsonOk(r: Response) {
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'Error')
  return d
}

// GET /api/tickets devuelve Ticket[] crudo, no envuelto en `{ tickets: [...] }`
// (route.ts:31, `NextResponse.json(await listarTicketsDelTenant())`).
export async function listarTicketsApi(): Promise<Ticket[]> {
  return jsonOk(await fetch(`${API}/tickets/`, { cache: 'no-store' }))
}

export interface AltaTicket {
  asunto: string
  cuerpo: string
  prioridad?: PrioridadTicket
}

// POST /api/tickets. El controlador valida con `.strict()`
// (tickets-controller.ts) y ya rechaza asunto/cuerpo vacios con 400 -- esta
// funcion no repite esa validacion, solo manda lo que el formulario junto.
export async function crearTicketApi(input: AltaTicket): Promise<Ticket> {
  return jsonOk(
    await fetch(`${API}/tickets/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}
