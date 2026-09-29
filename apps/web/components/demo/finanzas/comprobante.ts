import type { Factura, EstFactura } from '@/lib/data/types'

// ============================================================================
//  components/demo/finanzas/comprobante.ts — el documento de una factura.
// ----------------------------------------------------------------------------
//  Los contratos sirven un PDF que alguien subió (`/api/contratos/:id/documento`).
//  Una factura NO tiene ningún documento guardado: hay que componerlo con lo que
//  se congeló al emitirla. Por eso esto es un armador y no una descarga.
//
//  Todo sale de datos que la pantalla ya tiene cargados, así que no hace falta
//  endpoint nuevo: los fiscales del receptor son un snapshot que se copió a la
//  factura AL EMITIR, y por eso un comprobante viejo sigue diciendo el RFC que
//  el cliente tenía ese día aunque hoy lo haya cambiado. Eso es lo correcto en
//  un comprobante y conviene no «arreglarlo» leyendo el cliente de hoy.
// ============================================================================

export interface Comprobante {
  folio: string
  folioFiscal: string
  serie: string
  fechaEmision: string
  estatus: EstFactura
  campana: string
  emisor: { razonSocial: string; rfc: string }
  receptor: { razonSocial: string; rfc: string; usoCfdi: string }
  importes: { subtotal: number; iva: number; total: number; moneda: string; cuadra: boolean }
  aviso: string
}

const GUION = '—'

/**
 * Lo que este documento ES, dicho dentro del propio documento.
 *
 * En este producto «factura» significa **comprobante de pago**: el timbrado real
 * ante el SAT llega después por API. Un papel que parece un CFDI y no lo es
 * hace que alguien lo archive como si sirviera para deducir, y se entere en la
 * declaración. Se dice aquí, y la pantalla lo pinta sin que se pueda ocultar.
 */
export const AVISO_NO_ES_CFDI =
  'Comprobante de pago. NO es un CFDI timbrado ante el SAT: el timbrado se emite ' +
  'por separado y este documento no sustituye al comprobante fiscal.'

export function armarComprobante(
  f: Factura,
  campanas: { id: string; nombre: string }[] | undefined | null,
  entidades: { id: string; razonSocial: string; rfc: string | null }[] | undefined | null,
): Comprobante {
  const emisora = f.entidadEmisoraId
    ? (entidades ?? []).find((e) => e.id === f.entidadEmisoraId)
    : undefined

  const subtotal = Number(f.subtotal ?? 0)
  const iva = Number(f.igv ?? 0)
  const total = Number(f.monto ?? 0)

  return {
    folio: f.folio,
    folioFiscal: f.folioFiscal || GUION,
    serie: f.serie || GUION,
    fechaEmision: f.fechaEmision,
    estatus: f.estatus,
    campana: (campanas ?? []).find((c) => c.id === f.campanaId)?.nombre ?? GUION,
    // QUIEN EMITE: una de MIS razones sociales. No confundir con la del cliente
    // —`f.razonSocial` es la del receptor—, que es el error que este par de
    // campos invita a cometer y por eso van separados y nombrados así.
    emisor: {
      razonSocial: emisora?.razonSocial ?? 'Sin asignar',
      rfc: emisora?.rfc || GUION,
    },
    receptor: {
      razonSocial: f.razonSocial || GUION,
      rfc: f.rfc || GUION,
      usoCfdi: f.usoCfdi || GUION,
    },
    importes: {
      subtotal,
      iva,
      total,
      moneda: f.moneda || 'MXN',
      // Si los tres números no suman, el documento lo DICE en vez de callarse.
      // `crearFactura` los calcula para que cuadren exactamente, así que un
      // descuadre significa que algo los tocó después — y eso hay que verlo,
      // no descubrirlo cuando un cliente sume la columna.
      cuadra: Math.abs(subtotal + iva - total) < 0.01,
    },
    aviso: AVISO_NO_ES_CFDI,
  }
}
