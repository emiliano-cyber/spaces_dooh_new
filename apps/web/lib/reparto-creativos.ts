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
