import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { crearTicket, responderTicket } from './tickets-repo'
import type { Ticket, TicketDeInstancia } from './tickets-repo'

// ============================================================================
//  lib/server/tickets-controller.ts — ADR 0038.
//  Valida y sanea la entrada (zod) antes de tocar el repo. No conoce HTTP:
//  lanza AppError, la ruta lo mapea con respuestaError() (lib/server/errores.ts).
// ============================================================================

const PRIORIDADES = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] as const

// `.strict()`: un campo de mas da 400, no se descarta en silencio -- mismo
// criterio que `usuarios-controller.ts` usa con `password` en el update.
// `estado` NO esta en este esquema a proposito: un ticket nuevo SIEMPRE nace
// ABIERTO (default de la columna, db/migrations/20260923_tickets.sql:20). Si
// un cliente manda `estado` al abrir uno -- valido en el enum o no -- la clave
// entera es desconocida para este alta y `.strict()` la rechaza con 400 en vez
// de ignorarla y dejar creer que sirvio para algo.
const crearSchema = z
  .object({
    asunto: z.string().trim().min(1, 'El asunto es requerido'),
    cuerpo: z.string().trim().min(1, 'El cuerpo es requerido').max(4000),
    prioridad: z.enum(PRIORIDADES).optional(),
  })
  .strict()

// Igual de estricta: lo unico que el panel manda al responder es el texto. El
// estado del ticket NO se mueve aqui -- responder no es resolver, quien
// contesta puede estar pidiendo mas datos (ADR 0038; ruling de T3 en
// progress.md) -- asi que ni siquiera se acepta un campo `estado` que luego
// se ignoraria: `responderTicket` (tickets-repo.ts:135-144) solo toca
// `respuesta`, `respondido_en` y `actualizado_en`, nunca `estado`. Cuando el
// producto pida mover el estado sera una funcion aparte y explicita, no un
// campo colado en este cuerpo.
const responderSchema = z
  .object({
    respuesta: z.string().trim().min(1, 'La respuesta es requerida'),
  })
  .strict()

export async function crearTicketCtrl(body: unknown, usuarioId: string | null): Promise<Ticket> {
  const d = validar(crearSchema, body)
  return crearTicket({
    asunto: d.asunto,
    cuerpo: d.cuerpo,
    prioridad: d.prioridad,
    creadoPorUsuario: usuarioId,
  })
}

export async function responderTicketCtrl(id: string, body: unknown): Promise<TicketDeInstancia> {
  const d = validar(responderSchema, body)
  const t = await responderTicket(id, d.respuesta)
  // 404 y no un 200 silencioso: el mismo criterio que borrarUsuarioCtrl / la
  // edicion de usuarios, para no confundir "no existe" con "no paso nada".
  if (!t) throw new AppError('No encontrado', 404)
  return t
}
