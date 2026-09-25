import { MENSAJE_DESBLOQUEO } from '@/lib/cambios-mensajes'

// ============================================================================
//  lib/cambios-lote.ts — Un cambio sensible que son N peticiones, no una.
//  Módulo PURO: no hace `fetch`, no toca React. Recibe la lista y la función
//  que la aplica, y decide qué se reintenta. Por eso se prueba sin DOM.
// ----------------------------------------------------------------------------
//  OJO, lo primero: esto NO protege nada. Quien decide si un cambio pasa es el
//  servidor (`lib/server/cambios.ts`). Aquí solo vive la UX.
//
//  ─── Por qué existe, y qué NO resuelve `cambios-candado` ──────────────────
//  `confirmarConCandado` da por hecho que una acción es UNA llamada: la intenta,
//  y si el servidor pide la contraseña, la repite entera. Dos de los doce puntos
//  de B38 no son eso: «aplicar tarifa a las seleccionadas» y «aplicar renta a
//  los contratos» mandan N `PATCH` EN PARALELO (`Promise.allSettled`). Ahí
//  «repetir la acción» tiene una trampa que no se ve:
//
//    Si de doce van tres y nueve se rechazan, repetir el lote entero vuelve a
//    escribir esas TRES. Hoy los valores que viaja son absolutos, así que el
//    resultado saldría igual — pero cada reescritura deja su fila en el registro
//    de acciones (`registrarAccion`), y el registro pasaría a decir que la
//    pantalla se editó dos veces cuando se editó una. Y el día que el ajuste
//    porcentual se calcule en el servidor en vez de aquí, repetir dejaría de ser
//    inocuo y compondría el porcentaje. La regla que aguanta las dos cosas es la
//    misma: SE REINTENTA SOLO LO QUE NO SE APLICÓ.
//
//  ─── La política, entera, en cuatro frases ────────────────────────────────
//   1 · La contraseña NO se pide de entrada. El candado está apagado por defecto
//       en los tenants: preguntar siempre sería fricción inventada, y además
//       enseña a teclearla sin que nadie la pida. Se manda el lote y que sea el
//       servidor quien diga si hace falta. Como las N salen a la vez y contra la
//       MISMA sesión, el candado las rechaza todas juntas: no se aplica ninguna.
//   2 · Lo que el servidor rechazó no se aplicó. Lo que sí pasó SE QUEDA: no hay
//       vuelta atrás del lado del cliente, y fabricarla significaría tocar el
//       servidor. Que se quede no es el problema; que no se diga, sí.
//   3 · El reintento manda SOLO las pendientes.
//   4 · Y si el lote quedó a medias, SE DICE CUÁNTAS. Un lote a medias y en
//       silencio —lo que hacía el `catch {}` hasta hoy— es peor que no haber
//       hecho nada: nadie sabe cuál mitad se movió.
// ============================================================================

/**
 * Lo que devuelve una función que aplica un lote.
 *
 * `ok` y `fallidas` son los de siempre, para no romper a quien ya los lee.
 * Lo nuevo son los otros dos, y es lo que hace posible la política:
 * `pendientes` son los elementos que NO se aplicaron —tal cual entraron— y
 * `requiereDesbloqueo` dice si al menos uno falló por el candado.
 */
export interface ResultadoLote<T> {
  ok: number
  fallidas: number
  pendientes: T[]
  requiereDesbloqueo: boolean
}

export interface Lote {
  /**
   * Un intento. Aplica SOLO lo que queda pendiente y decide:
   *  · no queda nada           → vuelve sin más
   *  · falta algo por el candado → LANZA `MENSAJE_DESBLOQUEO`, que es lo que
   *    `confirmarConCandado` reconoce para abrir el cuadro con el campo
   *  · falta algo por otra cosa  → LANZA la frase que DICE CUÁNTAS sí y cuántas no
   *
   * Se pasa tal cual como `guardar` a `useCandado().ejecutar()`: al reintentar,
   * este mismo cierre ve la lista ya recortada y manda solo lo que falta.
   */
  paso: () => Promise<void>
  /** Cuántas se aplicaron, sumando TODOS los intentos. */
  aplicadas: () => number
  /** Cuántas siguen sin aplicarse. */
  pendientes: () => number
  total: () => number
  /**
   * La frase de «quedó a medias», con los dos números. Es literalmente lo que
   * este arreglo existe para que exista, así que vive aquí y se prueba aquí en
   * vez de armarse a mano en cada pantalla.
   */
  frase: () => string
}

export function crearLote<T>(opciones: {
  items: T[]
  aplicar: (items: T[]) => Promise<ResultadoLote<T>>
  /** Singular de lo que se cuenta: «pantalla», «contrato». */
  unidad: string
  unidadPlural: string
}): Lote {
  const total = opciones.items.length
  let pendientes = opciones.items
  let aplicadas = 0

  const frase = () => {
    const nombre = total === 1 ? opciones.unidad : opciones.unidadPlural
    return `Se aplicó en ${aplicadas} de ${total} ${nombre}; ${pendientes.length} sin cambiar.`
  }

  return {
    paso: async () => {
      const r = await opciones.aplicar(pendientes)
      aplicadas += r.ok
      pendientes = r.pendientes
      if (pendientes.length === 0) return
      // El candado va PRIMERO en la decisión: es el único fallo que se arregla
      // tecleando algo, y el único que tiene que abrir el cuadro en vez de
      // pintar un error rojo. Cuántas quedaron a medias lo cuenta el subtítulo
      // del cuadro, no este mensaje.
      if (r.requiereDesbloqueo) throw new Error(MENSAJE_DESBLOQUEO)
      throw new Error(frase())
    },
    aplicadas: () => aplicadas,
    pendientes: () => pendientes.length,
    total: () => total,
    frase,
  }
}
