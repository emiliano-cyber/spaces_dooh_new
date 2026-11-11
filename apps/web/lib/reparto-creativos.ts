// ============================================================================
//  lib/reparto-creativos.ts — Repartir los spots de UNA pantalla entre los
//  creativos elegidos.
//
//  Existe porque asignar creativos era pantalla por pantalla: una campaña de
//  doce pantallas con dos creativos son veinticuatro campos que llenar a mano,
//  y de ahí salían las campañas Publicadas con todos los slots «Sin asignar»
//  que reportó la auditoría (M14). El guard de `enviarADominio` ya impide
//  publicar así; esto es la otra mitad — hacer que asignarlo bien no cueste
//  media tarde.
//
//  EL REPARTO ES POR PANTALLA Y NO GLOBAL, y esa decisión no es un detalle:
//  las pantallas NO tienen todas los mismos slots. La propia auditoría lo
//  encontró (M12: configuración global de 6 slots junto a pantallas de 10 y
//  12), y se resolvió dejando que cada pantalla mande sobre los suyos. Un
//  reparto que calculara «veces» una sola vez y lo copiara a todas dejaría a
//  las de 12 slots cortas y a las de 10 pasadas — que es justo el error que el
//  contador «usados/reservados» pinta en rojo.
// ============================================================================

// Reparte `spots` entre `n` creativos lo más parejo posible.
//
// El resto va a los PRIMEROS, no repartido al azar ni descartado: con 10 spots
// y 3 creativos son [4,3,3] y no [3,3,3] —que dejaría un slot muerto pagado por
// el cliente— ni [4,4,2], que no es lo más parejo posible. El orden lo decide
// quien llama, así que «los primeros» es una regla que el usuario puede
// gobernar poniendo delante el creativo que quiere que salga más.
//
// Devuelve un arreglo de longitud `n`. Puede contener CEROS cuando hay más
// creativos que spots (3 creativos en una pantalla de 2 → [1,1,0]); quien
// escribe en la base descarta los ceros, porque un creativo con cero
// repeticiones no está asignado, y dejarlo escrito fingiría que sí.
export function repartirSpots(spots: number, n: number): number[] {
  const total = Math.floor(Number(spots))
  const cuantos = Math.floor(Number(n))
  if (!(cuantos > 0)) return []
  if (!(total > 0)) return new Array(cuantos).fill(0)

  const base = Math.floor(total / cuantos)
  const resto = total - base * cuantos
  return Array.from({ length: cuantos }, (_, i) => base + (i < resto ? 1 : 0))
}

export interface AsignacionSpot {
  creatividadId: string
  veces: number
}

// ─── v0.12.3 · varios creativos en un spot ROTAN (pedido del dueño, 22/10) ──
//
// «Como eran 2 creativos para un spot debí seleccionar 2 de 1, pero debe de ser
// autoseleccionable ya que pueden ser varios creativos.» Eligió que todos roten
// en partes iguales.

/**
 * Cada creativo elegido ENTRA en el spot. Con spots de sobra se reparten como
 * `repartirSpots`; con MENOS spots que creativos —el «2 de 1»— todos van con 1 y
 * rotan, en vez de quedarse fuera los últimos (que es lo que hacía
 * `asignacionDePantalla`, que sigue igual para el reparto masivo). Sin pauta
 * (`spots` null o 0) va una marca de 1 por creativo: el CMS pone los que quepan.
 */
export function rotacionEnSpot(creatividadIds: string[], spots: number | null): AsignacionSpot[] {
  const ids = (creatividadIds ?? []).filter(Boolean)
  if (ids.length === 0) return []
  const total = Math.floor(Number(spots))
  if (!(total > 0) || total < ids.length) return ids.map((creatividadId) => ({ creatividadId, veces: 1 }))
  const veces = repartirSpots(total, ids.length)
  return ids.map((creatividadId, i) => ({ creatividadId, veces: veces[i] }))
}

const clave = (a: AsignacionSpot[]) =>
  [...a].sort((x, y) => x.creatividadId.localeCompare(y.creatividadId)).map((x) => `${x.creatividadId}:${x.veces}`).join('|')

/**
 * ¿Este spot tiene EXACTAMENTE la rotación automática de esos creativos? Así se
 * distingue lo que llenó el sistema de lo que ajustó una persona: si alguien
 * cambió las veces a mano, ya no coincide y no se toca.
 */
export function esRotacionAutomatica(actual: AsignacionSpot[], ids: string[], spots: number | null): boolean {
  return ids.length > 0 && clave(actual) === clave(rotacionEnSpot(ids, spots))
}

/**
 * Qué recibe un spot DIGITAL al aprobar un creativo, o `null` si no se toca:
 *  · vacío → todos los aprobados, rotando;
 *  · con la rotación automática de los aprobados de ANTES → se suma el nuevo;
 *  · ajustado a mano (otros creativos u otras veces) → null, no se pisa.
 */
export function autollenadoDeSpot(e: {
  actual: AsignacionSpot[]
  aprobadosAntes: string[]
  aprobadosAhora: string[]
  spots: number | null
}): AsignacionSpot[] | null {
  const nuevo = rotacionEnSpot(e.aprobadosAhora, e.spots)
  if (nuevo.length === 0) return null
  if (e.actual.length === 0) return nuevo
  if (!esRotacionAutomatica(e.actual, e.aprobadosAntes, e.spots)) return null
  return clave(e.actual) === clave(nuevo) ? null : nuevo
}

// La asignación completa de una pantalla.
//
// `spotsReservados` en null significa pantalla FIJA (una lona, no un loop): no
// se reparte nada, va UN creativo y punto. El repo distingue las dos por el
// mismo criterio con el que lo hace la UI de Creativos hoy (`spotsReservados
// != null` = digital), así que aquí se respeta esa misma señal en vez de
// inventar una tercera.
export function asignacionDePantalla(
  creatividadIds: string[],
  spotsReservados: number | null,
): AsignacionSpot[] {
  const ids = (creatividadIds ?? []).filter(Boolean)
  if (ids.length === 0) return []

  if (spotsReservados == null) {
    // Fija: el primero. No se reparte una lona.
    return [{ creatividadId: ids[0], veces: 1 }]
  }

  const veces = repartirSpots(spotsReservados, ids.length)
  return ids
    .map((creatividadId, i) => ({ creatividadId, veces: veces[i] ?? 0 }))
    .filter((a) => a.veces > 0)
}
