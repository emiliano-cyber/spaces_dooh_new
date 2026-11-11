'use client'

import { Printer } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { armarComprobante } from './comprobante'
import type { Factura } from '@/lib/data/types'
import { useIdioma } from '@/lib/i18n/contexto'
import { formatFecha } from '@/lib/data/derive'
import type { Idioma } from '@/lib/i18n/idiomas'
import { traducir } from '@/lib/i18n/diccionario'
import { EnIdiomaDeLosDocumentos, useIdiomaDocumentos } from '@/lib/i18n/idioma-documentos-cliente'

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
  formatMonto: (n: number, idioma?: Idioma) => string
}) {
  const { t, idioma: idiomaPersona } = useIdioma()
  // ADR 0049 (03/11) · el comprobante es PAPEL: va en el idioma de los
  // documentos de la instancia. Los botones del cuadro (no se imprimen), en el
  // de la persona. Sin proveedor de la instancia (una prueba suelta), el de la
  // persona, como antes.
  const idiomaDoc = useIdiomaDocumentos() ?? idiomaPersona
  if (!factura) return null
  const c = armarComprobante(factura, campanas, entidades, idiomaDoc)

  return (
    <Modal
      open={!!factura}
      onOpenChange={onOpenChange}
      title={traducir(idiomaDoc, 'finanzas.comprobante.titulo', { folio: c.folio })}
      subtitle={c.campana}
      size="lg"
      footer={
        <div className="doc-no-print flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            {t('finanzas.comprobante.cerrar')}
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> {t('finanzas.comprobante.imprimir')}
          </Button>
        </div>
      }
    >
      <EnIdiomaDeLosDocumentos>
        <CuerpoComprobante c={c} formatMonto={formatMonto} />
      </EnIdiomaDeLosDocumentos>
    </Modal>
  )
}

// El papel. Lee `useIdioma()`, que dentro de `EnIdiomaDeLosDocumentos` es el
// de la instancia.
function CuerpoComprobante({
  c,
  formatMonto,
}: {
  c: ReturnType<typeof armarComprobante>
  formatMonto: (n: number, idioma?: Idioma) => string
}) {
  const { t, idioma } = useIdioma()
  return (
      <div className="doc-wrap">
        <article className="doc-hoja space-y-4 text-[13px]">
          {/* Quién emite y quién recibe, separados. Son dos razones sociales
              distintas y confundirlas es el error que invita este documento. */}
          <div className="doc-bloque grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {t('finanzas.comun.la-emite')}
              </div>
              <div className="font-medium text-ink">{c.emisor.razonSocial}</div>
              <div className="demo-num text-muted">RFC {c.emisor.rfc}</div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                {t('finanzas.comprobante.la-recibe')}
              </div>
              <div className="font-medium text-ink">{c.receptor.razonSocial}</div>
              <div className="demo-num text-muted">RFC {c.receptor.rfc}</div>
              <div className="text-muted">{t('finanzas.comprobante.uso', { uso: c.receptor.usoCfdi })}</div>
            </div>
          </div>

          <div className="doc-bloque border-t border-border pt-3">
            <Linea etiqueta={t('finanzas.comun.folio')} valor={c.folio} />
            <Linea etiqueta={t('finanzas.comprobante.serie')} valor={c.serie} />
            <Linea etiqueta={t('finanzas.comun.folio-fiscal')} valor={c.folioFiscal} />
            {/* La fecha, como en la lista de facturas: ver `fechaDeComprobante`. */}
            <Linea etiqueta={t('finanzas.comprobante.fecha')} valor={fechaDeComprobante(c.fechaEmision, idioma)} />
            <Linea etiqueta={t('finanzas.comun.campana')} valor={c.campana} />
          </div>

          <div className="doc-bloque border-t border-border pt-3">
            <Linea etiqueta={t('finanzas.comprobante.subtotal')} valor={formatMonto(c.importes.subtotal, idioma)} />
            <Linea etiqueta={t('finanzas.comprobante.iva')} valor={formatMonto(c.importes.iva, idioma)} />
            <div className="flex justify-between gap-4 border-t border-border pt-2 text-[15px]">
              <span className="font-semibold text-ink">{t('finanzas.comun.total')}</span>
              <span className="demo-num font-semibold text-ink">
                {formatMonto(c.importes.total, idioma)} {c.importes.moneda}
              </span>
            </div>
          </div>

          {/* Si los tres números no suman, se DICE. Un comprobante cuyos importes
              no cuadran y se calla es peor que no tenerlo: el que lo descubre es
              el cliente, sumando la columna. */}
          {!c.importes.cuadra && (
            <p className="doc-bloque rounded-md border border-[#f59e0b] bg-[#f59e0b1a] px-3 py-2 text-[12px] text-ink">
              {t('finanzas.comprobante.no-cuadra')}
            </p>
          )}

          {/* El aviso NO es opcional y no se puede cerrar: un papel que parece un
              CFDI y no lo es hace que alguien lo archive como si sirviera para
              deducir, y se entere en la declaración. */}
          <p className="doc-bloque border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
            {/* `c.aviso` es `AVISO_NO_ES_CFDI`; su clave lo reproduce letra por
                letra (lo vigila `textos/finanzas.test.ts`). */}
            {t('finanzas.comprobante.aviso')}
          </p>
        </article>
      </div>
  )
}

/**
 * La fecha de emision del comprobante, como la pinta la lista de facturas.
 * Hasta el 04/11 la rama espanola pintaba el dato tal cual, suponiendo
 * AAAA-MM-DD; la API lo manda como instante ISO y en una instancia espanola
 * salia «2026-09-01T06:00:00.000Z» (recorrido del italiano, decision del
 * orquestador). Ingles e italiano, sin cambios.
 */
export function fechaDeComprobante(fecha: string, idioma: Idioma): string {
  return formatFecha(fecha, idioma)
}
