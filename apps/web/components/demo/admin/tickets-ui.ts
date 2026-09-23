import type { Ticket } from '@/lib/data/tickets-api'
import { conteo } from '@/lib/plural'

// ============================================================================
//  tickets-ui.ts — Las frases del panel de tickets de soporte en
//  Administracion (ADR 0038, tarea 7). Logica pura: `vitest.config.ts` no
//  monta jsdom (ver CLAUDE.md), asi que nada de lo que se escriba dentro del
//  `.tsx` lo prueba nadie -- por eso vive aqui, con su test, y
//  `TicketsPanel.tsx` solo pinta lo que estas funciones deciden. Misma
//  leccion de B32/B33 que `actualizaciones-ui.ts`.
// ============================================================================

export type TonoEstado = 'ok' | 'alerta' | 'info'

// El resumen que encabeza el panel. EL ORDEN DE LAS RAMAS ES LA DECISION,
// igual que en `actualizaciones-ui.ts`:
//
//  1. Si el tenant no ha abierto ningun ticket, se dice eso y nada mas: no
//     hay nada que resumir todavia.
//  2. Si hay alguno SIN `respuesta` -- sin importar su `estado` -- se cuenta
//     cuantos estan esperando. Es la pregunta que el cliente vino a
//     responderse ("¿ya me contestaron?") y tiene que ganarle a la rama 3:
//     con un ticket contestado y otro no, la lista NO esta "toda contestada".
//  3. Solo si TODOS traen `respuesta` se dice que ya contestaron todos, en
//     tono positivo. Si esta rama se evaluara antes que la 2, un tenant con
//     nueve tickets contestados y uno pendiente veria "ya contestamos todo"
//     -- la misma mentira tranquilizadora que `actualizaciones-ui.ts` ya
//     documenta para el caso del digest sin comprobar.
export function textoDeEstado(tickets: Ticket[]): { tono: TonoEstado; texto: string } {
  if (tickets.length === 0) {
    return { tono: 'info', texto: 'Todavia no has abierto ningun ticket de soporte.' }
  }

  const sinRespuesta = tickets.filter((t) => !t.respuesta)
  if (sinRespuesta.length > 0) {
    return {
      tono: 'info',
      texto: `Tienes ${conteo(sinRespuesta.length, 'ticket esperando respuesta', 'tickets esperando respuesta')}.`,
    }
  }

  return { tono: 'ok', texto: 'Todos tus tickets estan contestados.' }
}

// El boton "Nuevo ticket" no manda un formulario vacio. La validacion fuerte
// vive en el controlador (`tickets-controller.ts`, `.strict()`) y esta
// funcion no la repite -- solo evita el viaje de red que YA SABEMOS que el
// servidor va a rechazar con 400 por `asunto`/`cuerpo` vacios.
export function formularioValido(asunto: string, cuerpo: string): boolean {
  return asunto.trim().length > 0 && cuerpo.trim().length > 0
}
