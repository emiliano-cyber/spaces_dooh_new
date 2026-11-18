'use client'

import { toast } from 'sonner'
import { useRef, useState } from 'react'
import { Check, X, FileText, Upload, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useClientes } from '@/lib/data/client'
import { subirContratoCampanaApi } from '@/lib/data/estado-api'
import type { Campana } from '@/lib/data/types'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { useTexto } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'

// ============================================================================
//  Datos de facturación de la campaña. El cliente se eligió al crear la
//  propuesta, así que aquí se AUTO-LLENAN sus datos fiscales (razón social, RFC,
//  régimen, CP fiscal, uso CFDI, IVA) desde el cliente ligado a la campaña —los
//  mismos que generarFactura exige y copia a la factura. Además deja adjuntar el
//  contrato firmado del cliente, si se sube.
// ============================================================================

const USO_CFDI: Record<string, ClaveTexto> = {
  G01: 'campanas.facturacion.uso.g01',
  G03: 'campanas.facturacion.uso.g03',
  P01: 'campanas.facturacion.uso.p01',
}

// `sinCard`: cuando esta tarjeta va dentro de una sección colapsable de la ficha
// (que ya pone su propio Card y título), se renderiza solo el contenido.
export function DatosFacturacion({ campana, sinCard }: { campana: Campana; sinCard?: boolean }) {
  const clientes = useClientes()
  const puede = usePuede('comercial', 'crear')
  const t = useTexto()
  const fileRef = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)

  const cli = (clientes ?? []).find((c) => c.id === campana.clienteId)
  // Para timbrar hacen falta al menos RFC + razón social (lo que valida el server).
  const fiscalCompleto = !!cli?.rfc && !!cli?.razonSocial

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      toast.error(t('campanas.comun.contrato-supera', { mb: 10 }))
      return
    }
    setSubiendo(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        await subirContratoCampanaApi(campana.id, reader.result as string)
        toast.success(t('campanas.facturacion.adjuntado'))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('campanas.facturacion.no-adjuntar'))
      }
      setSubiendo(false)
    }
    reader.readAsDataURL(f)
  }

  const cuerpo = (
      <>
        {!cli ? (
          <p className="text-[13px] text-muted">{t('campanas.facturacion.sin-cliente')}</p>
        ) : (
          <dl className="space-y-2 text-[13px]">
            <Fila label={t('campanas.facturacion.cliente')} valor={cli.nombre} />
            <Fila label={t('campanas.facturacion.razon-social')} valor={cli.razonSocial} destacaFalta />
            <Fila label={t('campanas.facturacion.rfc')} valor={cli.rfc} mono destacaFalta />
            <Fila label={t('campanas.facturacion.regimen')} valor={cli.regimenFiscal} />
            <Fila label={t('campanas.facturacion.cp')} valor={cli.cpFiscal} mono />
            <Fila
              label={t('campanas.facturacion.uso')}
              valor={cli.usoCfdi ? (USO_CFDI[cli.usoCfdi] ? t(USO_CFDI[cli.usoCfdi]) : cli.usoCfdi) : null}
            />
            <Fila label={t('campanas.facturacion.iva')} valor={`${cli.ivaPct}%`} />
          </dl>
        )}

        {!fiscalCompleto && cli && (
          <p className="mt-3 rounded border border-[#f59e0b40] bg-[#f59e0b0d] px-2.5 py-2 text-[12px] text-[#9a6700]">
            {interpolarNodos(t('campanas.facturacion.completa'), { clientes: <b>{t('campanas.facturacion.clientes')}</b> })}
          </p>
        )}

        {/* Contrato firmado del cliente (opcional) */}
        <div className="mt-4 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
              <FileText className="h-3.5 w-3.5 text-muted" /> {t('campanas.facturacion.contrato')}
            </span>
            {campana.contratoUrl ? (
              <a
                href={campana.contratoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-info hover:underline"
              >
                {t('campanas.comun.ver-contrato')} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-[12px] text-muted">{t('campanas.facturacion.sin-contrato')}</span>
            )}
          </div>
          {puede && (
            <div className="mt-2">
              <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onFile} />
              <Button size="sm" variant="secondary" disabled={subiendo} onClick={() => fileRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" />
                {subiendo
                  ? t('campanas.comun.subiendo')
                  : campana.contratoUrl
                    ? t('campanas.facturacion.reemplazar')
                    : t('campanas.facturacion.subir')}
              </Button>
            </div>
          )}
        </div>
      </>
  )

  // Dentro de una sección colapsable (la ficha ya pone Card + título + chip).
  if (sinCard) return cuerpo

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('campanas.ficha.facturacion')}</CardTitle>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            fiscalCompleto
              ? 'border-[#10b98140] text-[#0f7a55]'
              : 'border-[#f59e0b40] text-[#9a6700]'
          }`}
        >
          {fiscalCompleto ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {fiscalCompleto ? t('campanas.facturacion.listo') : t('campanas.facturacion.faltan')}
        </span>
      </CardHeader>
      <CardContent>{cuerpo}</CardContent>
    </Card>
  )
}

function Fila({
  label,
  valor,
  mono,
  destacaFalta,
}: {
  label: string
  valor: string | null | undefined
  mono?: boolean
  destacaFalta?: boolean
}) {
  const t = useTexto()
  const falta = !valor
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd
        className={`${mono ? 'demo-num' : ''} ${
          falta && destacaFalta ? 'text-[#9a6700]' : falta ? 'text-muted' : 'text-ink'
        }`}
      >
        {valor || t('campanas.facturacion.falta')}
      </dd>
    </div>
  )
}
