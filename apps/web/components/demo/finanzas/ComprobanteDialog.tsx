'use client'

import { Printer } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { armarComprobante } from './comprobante'
import type { Factura } from '@/lib/data/types'

// ============================================================================
//  El comprobante de una factura, en pantalla y listo para imprimir.
// ----------------------------------------------------------------------------
//  Usa las clases de documento que este repositorio ya tiene (`doc-wrap`,
//  `doc-hoja`, `doc-no-print`, y el `@page { size: letter }` de `demo.css:332`),
//  las mismas del contrato y de la firma pública. Así imprimir ya funciona sin
//  escribir una sola regla de impresión nueva — y si alguien mejora esas reglas,
//  este documento mejora con ellas.
// ============================================================================

function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 py-1">
      <span className="text-muted">{etiqueta}</span>
      <span className="demo-num text-right font-medium text-ink">{valor}</span>
    </div>
  )
}

export function ComprobanteDialog({
  factura,
  campanas,
  entidades,
  onOpenChange,
  formatMonto,
}: {
  factura: Factura | null
  campanas: { id: string; nombre: string }[]
  entidades: { id: string; razonSocial: string; rfc: string | null }[]
  onOpenChange: (v: boolean) => void
  formatMonto: (n: number) => string
}) {
  if (!factura) return null
  const c = armarComprobante(factura, campanas, entidades)

  return (
    <Modal
      open={!!factura}
      onOpenChange={onOpenChange}
      title={`Comprobante ${c.folio}`}
      subtitle={c.campana}
      size="lg"
      footer={
        <div className="doc-no-print flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </div>
      }
    >
      <div className="doc-wrap">
        <article className="doc-hoja space-y-4 text-[13px]">
          {/* Quién emite y quién recibe, separados. Son dos razones sociales
              distintas y confundirlas es el error que invita este documento. */}
          <div className="doc-bloque grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                La emite
              </div>
              <div className="font-medium text-ink">{c.emisor.razonSocial}</div>
              <div className="demo-num text-muted">RFC {c.emisor.rfc}</div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                La recibe
              </div>
              <div className="font-medium text-ink">{c.receptor.razonSocial}</div>
              <div className="demo-num text-muted">RFC {c.receptor.rfc}</div>
              <div className="text-muted">Uso: {c.receptor.usoCfdi}</div>
            </div>
          </div>

          <div className="doc-bloque border-t border-border pt-3">
            <Linea etiqueta="Folio" valor={c.folio} />
            <Linea etiqueta="Serie" valor={c.serie} />
            <Linea etiqueta="Folio fiscal" valor={c.folioFiscal} />
            <Linea etiqueta="Fecha de emisión" valor={c.fechaEmision} />
            <Linea etiqueta="Campaña" valor={c.campana} />
          </div>

          <div className="doc-bloque border-t border-border pt-3">
            <Linea etiqueta="Subtotal" valor={formatMonto(c.importes.subtotal)} />
            <Linea etiqueta="IVA" valor={formatMonto(c.importes.iva)} />
            <div className="flex justify-between gap-4 border-t border-border pt-2 text-[15px]">
              <span className="font-semibold text-ink">Total</span>
              <span className="demo-num font-semibold text-ink">
                {formatMonto(c.importes.total)} {c.importes.moneda}
              </span>
            </div>
          </div>

          {/* Si los tres números no suman, se DICE. Un comprobante cuyos importes
              no cuadran y se calla es peor que no tenerlo: el que lo descubre es
              el cliente, sumando la columna. */}
          {!c.importes.cuadra && (
            <p className="doc-bloque rounded-md border border-[#f59e0b] bg-[#f59e0b1a] px-3 py-2 text-[12px] text-ink">
              Los importes de este comprobante no cuadran: el subtotal más el IVA no da el total.
              Revísalo antes de entregarlo.
            </p>
          )}

          {/* El aviso NO es opcional y no se puede cerrar: un papel que parece un
              CFDI y no lo es hace que alguien lo archive como si sirviera para
              deducir, y se entere en la declaración. */}
          <p className="doc-bloque border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
            {c.aviso}
          </p>
        </article>
      </div>
    </Modal>
  )
}
