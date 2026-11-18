// ============================================================================
//  lib/neto-de-linea.ts — Qué neto congelado le toca a CADA línea de una
//  propuesta al generar su campaña.  B56 (2026-10-29), aprobado por el dueño (R4).
//  Módulo PURO: sin BD, sin React. Lo usa `generarCampanaDesdePropuesta`.
// ----------------------------------------------------------------------------
//  EL DEFECTO. `campanas-repo.ts` armaba `netoDeSnap` como un Map POR PANTALLA.
//  Con la misma pantalla dos veces en la propuesta —el prime y la madrugada, o
//  dos periodos— el Map se quedaba con la ÚLTIMA entrada y las DOS reservas se
//  guardaban con ese neto: prime 27 000 + madrugada 7 200 se facturaban como
//  7 200 + 7 200. Nada daba error; el importe es plausible.
//
//  QUÉ IDENTIFICA LA LÍNEA.
//   · Snapshots desde el 29/10: `porSitio[].itemId`, el id del ítem de la
//     propuesta que lo congeló (`congelarSnapshotEconomico`). Es la identidad
//     de verdad: distingue también dos periodos iguales con distinto volumen.
//   · Snapshots ANTERIORES no la traen, y no se reescriben (son inmutables).
//     Ahí solo vale lo que el snapshot ya guarda: la pantalla, y si se repite,
//     la franja congelada (`franja.id`) y la lista (= `precio` del ítem). Si lo
//     que queda señala UN SOLO neto, ése es; si no, `null`.
//
//  `null` = «no se sabe de qué línea es», y el llamador cae a su cálculo de
//  respaldo (lista × volumen × descuento × código × comisión, o la parte del
//  paquete). Es preferible a copiar el neto de OTRA línea, que es exactamente
//  el defecto: el respaldo recalcula con la misma cadena del snapshot y da el
//  neto de esta línea salvo que la propuesta haya cambiado después de aprobarse.
// ============================================================================

type EntradaSnapshot = {
  itemId?: unknown
  sitioId?: unknown
  lista?: unknown
  neto?: unknown
  franja?: { id?: unknown } | null
}

type ItemPropuesta = {
  id?: unknown
  sitio_id?: unknown
  franja_id?: unknown
  precio?: unknown
}

const centavos = (v: unknown) => Math.round(Number(v) * 100)
const netoValido = (v: unknown) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null)

/** Un neto por ítem, en el mismo orden; `null` cuando no se puede atribuir. */
export function netosDelSnapshot(items: ItemPropuesta[], porSitio: EntradaSnapshot[] | null | undefined): (number | null)[] {
  const entradas = Array.isArray(porSitio) ? porSitio : []
  const conIdentidad = entradas.some((e) => e && e.itemId != null)

  return items.map((it) => {
    if (conIdentidad) {
      const e = entradas.find((x) => x && x.itemId != null && String(x.itemId) === String(it.id))
      return e ? netoValido(e.neto) : null
    }
    let cand = entradas.filter((x) => x && String(x.sitioId) === String(it.sitio_id))
    if (cand.length === 0) return null
    if (cand.length === 1) return netoValido(cand[0].neto) // el comportamiento de siempre
    const franja = it.franja_id == null ? null : String(it.franja_id)
    cand = cand.filter((x) => (x.franja?.id == null ? null : String(x.franja.id)) === franja)
    cand = cand.filter((x) => centavos(x.lista) === centavos(it.precio))
    const netos = new Set(cand.map((x) => centavos(x.neto)))
    return cand.length > 0 && netos.size === 1 ? netoValido(cand[0].neto) : null
  })
}
