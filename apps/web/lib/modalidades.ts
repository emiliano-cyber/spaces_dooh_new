// ============================================================================
//  lib/modalidades.ts — Las unidades de venta de una pantalla, y qué admite
//  cada tipo de pantalla. Módulo PURO: sin `fetch`, sin React, sin BD.
// ----------------------------------------------------------------------------
//  POR QUÉ EXISTE, y no es refactorización por gusto. Hasta el 2026-09-28 estas
//  dos listas vivían privadas dentro de `inventario-import.ts`, y bastaba: el
//  ÚNICO camino que escribía `sitio_modalidades` era el archivo de importación
//  (`sitios-repo.ts`, `insertarSitio` y `actualizarSitioCompleto`). Para poner
//  una tarifa de spoteo había que subir un CSV.
//
//  Al abrir la captura desde la ficha aparece un SEGUNDO camino de escritura, y
//  dos caminos con dos copias de la misma regla divergen — no es una hipótesis,
//  es el modo de fallo que este repositorio ya documentó con el orden de las
//  migraciones (`scripts/migrar.mjs:61`) y con la copia de `ordenar()` en
//  `db-e2e.ts`. La regla se declara UNA vez y los dos caminos la importan.
//
//  Si el importador lo rechaza, la ficha también. Esa es toda la promesa.
// ============================================================================

/**
 * Las siete unidades de venta, tal cual las declara el libro «Listas validadas»
 * de la plantilla de inventario. `sitio_modalidades.unidad` es `text` libre en
 * la base (`db/schema.sql:207`), así que esta lista es el único guardián.
 */
export const UNIDADES_VENTA = [
  'mensual',
  'catorcenal',
  'semanal',
  'diaria',
  'spot',
  'hora',
  'programatico',
] as const

export type UnidadVenta = (typeof UNIDADES_VENTA)[number]

/**
 * Una pantalla FIJA solo se comercializa por periodo. No es una limitación del
 * sistema: una lona no tiene loop, así que no hay spot, ni hora, ni
 * programático que vender. Ofrecerlos sería prometer algo que no se puede
 * entregar.
 */
export const UNIDADES_FIJO = ['mensual', 'catorcenal'] as const

const ETIQUETA_FIJO = UNIDADES_FIJO.map((u) => `"${u}"`).join(' o ')

/** ¿Es una unidad de las siete? Compara ya normalizada. */
export function esUnidadValida(unidad: string): unidad is UnidadVenta {
  return (UNIDADES_VENTA as readonly string[]).includes(unidad)
}

/**
 * ¿Esta pantalla es FIJA?
 *
 * `sitios.exhibicion` guarda `fijo | digital | rotativo` en minúsculas, y una
 * digital se escribe como `rotativo` (`sitios-repo.ts:144`).
 *
 * SIN DATO cuenta como FIJA, y conviene saber por qué: `rowToSitio` pinta
 * `r.exhibicion ?? 'fijo'`, o sea que la ficha ya le dice «fijo» al usuario. Si
 * aquí se tratara como digital, la pantalla diría una cosa y el servidor
 * aceptaría otra — y de los dos errores posibles, que lo que se ve y lo que se
 * guarda no coincidan es el peor. Una pantalla mal capturada se arregla
 * poniéndole su exhibición, que la ficha ya deja editar.
 */
export function esFijo(exhibicion: string | null | undefined): boolean {
  return normalizar(exhibicion ?? '') !== 'digital' && normalizar(exhibicion ?? '') !== 'rotativo'
}

/** Minúsculas y sin espacios alrededor: lo que llega de un `<select>` o de una celda. */
export function normalizar(unidad: string): string {
  return String(unidad ?? '').trim().toLowerCase()
}

/**
 * Por qué NO se puede vender esta pantalla en esta unidad, o `null` si sí se
 * puede. Devuelve la frase que va a leer una persona, no un código.
 *
 * El mensaje de la pantalla fija nombra las dos que SÍ valen: un «unidad
 * inválida» a secas deja a quien lo lee sin saber qué hacer a continuación.
 */
export function motivoModalidadInvalida(
  unidad: string,
  exhibicion: string | null | undefined,
): string | null {
  const u = normalizar(unidad)
  if (!esUnidadValida(u)) {
    return `Unidad de venta no válida: "${unidad}". Las únicas son ${UNIDADES_VENTA.join(', ')}.`
  }
  if (esFijo(exhibicion) && !(UNIDADES_FIJO as readonly string[]).includes(u)) {
    return `Pantalla fija: la unidad solo puede ser ${ETIQUETA_FIJO} (recibido "${u}").`
  }
  return null
}
