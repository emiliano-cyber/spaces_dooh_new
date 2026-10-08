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
//  respuesta sale con `estado: SIN_RESPUESTA` y `pendientes`/`total` en `null` --
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
 * `pendientes` cuenta `ABIERTO` **y** `EN_PROCESO`, y se llama asi justamente
 * por eso: un ticket empezado y no cerrado sigue siendo trabajo. Contar solo
 * `ABIERTO` haria que mover un ticket a «en proceso» lo BORRARA de la cuenta y
 * la pantalla dijera que no queda nada -- el mismo error de leer un silencio
 * como buena noticia que esta pantalla viene a evitar, aplicado al numero que
 * mas se mira. Y llamarlo `abiertos` contando dos estados seria un nombre que
 * miente.
 *
 * `total` es el tamano del arreglo, para que la pantalla pueda mostrar "2 de 4"
 * en vez de solo el numero que mas urge.
 */
export function filasDeTickets(respuestas) {
  return respuestas.map((r) => {
    if (!Array.isArray(r.tickets)) {
      return {
        nombre: r.nombre,
        dominio: r.dominio,
        estado: SIN_RESPUESTA,
        pendientes: null,
        total: null,
        motivo: r.motivo ?? null,
      }
    }
    return {
      nombre: r.nombre,
      dominio: r.dominio,
      estado: OK,
      pendientes: r.tickets.filter((t) => t.estado === 'ABIERTO' || t.estado === 'EN_PROCESO').length,
      total: r.tickets.length,
      motivo: null,
    }
  })
}

// ─── Las solicitudes de activación de Space Eyes ────────────────────────────
//  Una empresa sin Space Eyes ve la demostración del módulo, y su botón
//  «Solicitar activación» abre un ticket con este asunto EXACTO
//  (`components/demo/space-eyes/DemoSpaceEyes.tsx`; una prueba los amarra).
//  Revuelto con los demás tickets nadie lo veía: el padre no se enteraba de
//  que alguien pedía el módulo. Aquí se separan para pintarlos arriba de la
//  lista de empresas, con la orden exacta para activarlo.
export const ASUNTO_ACTIVACION_EYES = 'Solicitud de activación de Space Eyes'

/** ¿Este ticket es una solicitud de activación de Space Eyes aún sin atender? */
export function esSolicitudDeActivacion(t) {
  return !!t && t.asunto === ASUNTO_ACTIVACION_EYES && (t.estado === 'ABIERTO' || t.estado === 'EN_PROCESO')
}

/**
 * De lo que contestó cada instancia en `GET /api/tickets`, las solicitudes de
 * activación pendientes: una por instancia (la más reciente), de la más nueva
 * a la más vieja. Una instancia que no contestó no aporta ninguna: no se
 * inventa ni se oculta nada, su fila ya sale como sin-respuesta en la tabla.
 */
export function solicitudesDeActivacion(respuestas) {
  const salida = []
  for (const r of respuestas ?? []) {
    if (!Array.isArray(r.tickets)) continue
    const suyas = r.tickets.filter(esSolicitudDeActivacion)
    if (!suyas.length) continue
    const ultima = [...suyas].sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))[0]
    salida.push({
      nombre: r.nombre,
      dominio: r.dominio,
      folio: ultima.folio ?? null,
      creado_en: ultima.creado_en ?? null,
      total: suyas.length,
    })
  }
  return salida.sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))
}
