import 'server-only'
import { z } from 'zod'
import { AppError, validar } from './errores'
import { crearTicket, actualizarTicketDesdePanel } from './tickets-repo'
import type { Ticket, TicketDeInstancia, EstadoTicket } from './tickets-repo'

// ============================================================================
//  lib/server/tickets-controller.ts — ADR 0038.
//  Valida y sanea la entrada (zod) antes de tocar el repo. No conoce HTTP:
//  lanza AppError, la ruta lo mapea con respuestaError() (lib/server/errores.ts).
// ============================================================================

const PRIORIDADES = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'] as const
const ESTADOS = ['ABIERTO', 'EN_PROCESO', 'RESUELTO', 'CERRADO'] as const

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

// El PATCH del panel (Tarea 11, ADR 0038): responde, mueve el estado, o las
// dos cosas -- pero NUNCA una porque llego la otra. `.strict()` para que una
// clave de mas (p. ej. `tenantId`) de 400 en vez de ignorarse, mismo criterio
// que `crearSchema`. Y el `.refine` de abajo es lo que evita el PATCH vacio:
// sin el, un cuerpo `{}` pasaria la validacion de campos (ninguno es
// requerido por separado) y llegaria al repo sin nada que actualizar -- un
// `update` sin `set` es un error de sintaxis o, peor, un no-op silencioso que
// devuelve 200 (Tarea 11, revision #2).
//
// Y sigue valiendo la decision de la Tarea 3: responder NO es resolver. Que
// el `PATCH` pueda traer las dos cosas a la vez no significa que una mueva a
// la otra -- mandar solo `respuesta` deja `estado` intacto, y al reves. Si
// algun dia alguien "mejora" esto haciendolo automatico, esta linea explica
// por que no: quien contesta puede estar pidiendo mas datos, no resolviendo.
const actualizarPanelSchema = z
  .object({
    respuesta: z.string().trim().min(1, 'La respuesta es requerida').optional(),
    estado: z.enum(ESTADOS).optional(),
  })
  .strict()
  .refine((d) => d.respuesta !== undefined || d.estado !== undefined, {
    message: 'Manda al menos respuesta o estado',
  })

export async function crearTicketCtrl(body: unknown, usuarioId: string | null): Promise<Ticket> {
  const d = validar(crearSchema, body)
  return crearTicket({
    asunto: d.asunto,
    cuerpo: d.cuerpo,
    prioridad: d.prioridad,
    creadoPorUsuario: usuarioId,
  })
}

export async function actualizarTicketDesdePanelCtrl(id: string, body: unknown): Promise<TicketDeInstancia> {
  const d = validar(actualizarPanelSchema, body)
  const t = await actualizarTicketDesdePanel(id, { respuesta: d.respuesta, estado: d.estado as EstadoTicket | undefined })
  // 404 y no un 200 silencioso: el mismo criterio que borrarUsuarioCtrl / la
  // edicion de usuarios, para no confundir "no existe" con "no paso nada".
  if (!t) throw new AppError('No encontrado', 404)
  return t
}
