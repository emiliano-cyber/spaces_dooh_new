import type { Factura, EstFactura } from '@/lib/data/types'

// ============================================================================
//  components/demo/finanzas/facturas-lista.ts — el armado del apartado
//  «Facturas» de la pantalla de Finanzas.
// ----------------------------------------------------------------------------
//  Por qué existe este archivo y no está dentro de la pantalla: para poder
//  probar el armado sin DOM. La pantalla solo pinta lo que sale de aquí.
//
//  Y por qué existe el apartado: hasta el 2026-09-29 una factura emitida solo
//  se veía dentro de la tarjeta «Cobranza». La información estaba —folio, folio
//  fiscal, cliente, monto— pero bajo un rótulo que se lee como cuentas por
//  cobrar. Quien acababa de emitir una y buscaba «Facturas» concluía que no se
//  había guardado.
// ============================================================================

export interface FilaFactura {
  id: string
  folio: string
  folioFiscal: string
  fechaEmision: string
  cliente: string
  campana: string
  emisora: string
  monto: number
  moneda: string
  estatus: EstFactura
}

const GUION = '—'

/**
 * Une cada factura con el nombre de su cliente, de su campaña y de la razón
 * social que la emitió, y las ordena de la más reciente a la más vieja.
 *
 * Lo que no se encuentra se pinta con una raya, **nunca con un valor
 * inventado**: este repositorio ya pagó caro lo contrario — el `?? 0` del mapa
 * convertía «no sé dónde está» en un punto concreto del océano, y costó un
 * diagnóstico entero.
 */
export function armarListaFacturas(
  facturas: Factura[] | undefined | null,
  clientes: { id: string; nombre: string }[] | undefined | null,
  campanas: { id: string; nombre: string }[] | undefined | null,
  entidades: { id: string; nombre: string }[] | undefined | null,
): FilaFactura[] {
  if (!facturas?.length) return []
  const porCliente = new Map((clientes ?? []).map((c) => [c.id, c.nombre]))
  const porCampana = new Map((campanas ?? []).map((c) => [c.id, c.nombre]))
  const porEntidad = new Map((entidades ?? []).map((e) => [e.id, e.nombre]))

  return facturas
    .map((f) => ({
      id: f.id,
      folio: f.folio,
      folioFiscal: f.folioFiscal || GUION,
      fechaEmision: f.fechaEmision,
      cliente: porCliente.get(f.clienteId) ?? GUION,
      campana: porCampana.get(f.campanaId) ?? GUION,
      // «Sin asignar» y no una raya: aquí el hueco tiene nombre propio y ya se
      // llama así en el resto del módulo de razones sociales. Decir «—» haría
      // pensar que el dato se perdió, cuando lo que pasa es que nadie lo eligió.
      emisora: (f.entidadEmisoraId && porEntidad.get(f.entidadEmisoraId)) || 'Sin asignar',
      monto: f.monto,
      moneda: f.moneda,
      estatus: f.estatus,
    }))
    // La más reciente primero: quien entra aquí viene de emitir una.
    .sort((a, b) => b.fechaEmision.localeCompare(a.fechaEmision))
}

/**
 * Cuántas hay de cada estatus. Las tres salen siempre, aunque valgan cero: un
 * contador que desaparece se lee como «no aplica» en vez de «ninguna».
 */
export function cuentaPorEstatus(
  facturas: Factura[] | undefined | null,
): Record<EstFactura, number> {
  const c: Record<EstFactura, number> = { EMITIDA: 0, PAGADA: 0, ANULADA: 0 }
  for (const f of facturas ?? []) {
    // Una ANULADA no se cuenta como emitida: sumarlas daría una facturación
    // mayor que la real, que es la clase de cifra que nadie vuelve a comprobar.
    if (f.estatus in c) c[f.estatus] += 1
  }
  return c
}
