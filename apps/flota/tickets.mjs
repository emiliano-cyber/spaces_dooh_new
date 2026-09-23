// ============================================================================
//  tickets.mjs — la logica pura del panel de tickets (T8, ADR 0038).
// ----------------------------------------------------------------------------
//  `GET /api/tickets` con `x-flota-token` es el contrato que fija T6 (y que
//  `progress.md` cita textual): cada instancia contesta
//
//    { "tickets": [ { id, folio, tenant_id, asunto, cuerpo, estado,
//                     prioridad, creado_en, respuesta, respondido_en } ] }
//
//  Este archivo NO abre ningun puerto ni habla con nadie: toma lo que cada
//  instancia YA contesto -- o el motivo por el que no contesto -- y lo
//  convierte en una fila por instancia. La consulta de red (fetch, token,
//  timeout) es de T9, el mismo reparto que `estado.mjs` hace entre `consultar()`
//  (red) y `resumen()` (logica pura) para las versiones.
//
//  ─── La fila que MAS importa: la de la instancia que no contesta ─────────
//  El ADR 0038, en sus consecuencias, lo dice con estas palabras: «la pantalla
//  tiene que distinguir "no tiene tickets" de "no me contesta", o repite el
//  error de leer un silencio como una buena noticia». Por eso una instancia sin
//  respuesta sale con `estado: SIN_RESPUESTA` y `abiertos`/`total` en `null` --
//  nunca en `0`, que es el valor que tambien tendria una instancia sana sin
//  tickets. Confundir esos dos casos es exactamente el error que este proyecto
//  ya penalizo con el panel de versiones (ver el comentario de cabecera de
//  `estado.mjs`, "Sale SIEMPRE con 0").
// ============================================================================

export const OK = 'ok'
export const SIN_RESPUESTA = 'sin-respuesta'

/**
 * De lo que cada instancia contesto (o no) en `GET /api/tickets`, a las filas
 * del panel: una por instancia.
 *
 * Cada entrada de `respuestas` es lo que dejo la consulta a UNA instancia:
 *   - exito:  `{ nombre, dominio, tickets: [...] }`   (el arreglo de T6)
 *   - fallo:  `{ nombre, dominio, motivo: '...' }`     (sin `tickets`, o `null`)
 *
 * `tickets` ausente, `null` o cualquier cosa que no sea un arreglo se trata
 * igual: la instancia no contesto. No hace falta distinguir un timeout de un
 * cuerpo mal formado para pintar la pantalla -- el motivo, si lo hay, viaja
 * intacto para quien quiera leerlo.
 *
 * `abiertos` cuenta los tickets con `estado === 'ABIERTO'` exactamente: es la
 * cuenta que el brief pide ("cuenta los abiertos"), no una suma de estados
 * pendientes. `total` es el tamano del arreglo, para que la pantalla pueda
 * mostrar "2 de 4" en vez de solo el numero que mas urge.
 */
export function filasDeTickets(respuestas) {
  return respuestas.map((r) => {
    if (!Array.isArray(r.tickets)) {
      return {
        nombre: r.nombre,
        dominio: r.dominio,
        estado: SIN_RESPUESTA,
        abiertos: null,
        total: null,
        motivo: r.motivo ?? null,
      }
    }
    return {
      nombre: r.nombre,
      dominio: r.dominio,
      estado: OK,
      abiertos: r.tickets.filter((t) => t.estado === 'ABIERTO').length,
      total: r.tickets.length,
      motivo: null,
    }
  })
}
