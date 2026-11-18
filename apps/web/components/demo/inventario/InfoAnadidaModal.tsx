'use client'

import { MapPin, Layers } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { formatMonto, type Sitio } from '@/lib/data/client'
import { useIdioma } from '@/lib/i18n/contexto'
import { textoTipoMedio } from './etiquetas'

// Mini-modal que muestra la información de las pantallas añadidas/actualizadas
// tras importar un archivo. Lista compacta con lo esencial de cada sitio.

export function InfoAnadidaModal({
  open,
  onOpenChange,
  sitios,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sitios: Sitio[]
}) {
  const { idioma, t } = useIdioma()
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('inventario.info.titulo')}
      subtitle={t(sitios.length === 1 ? 'inventario.info.sub.uno' : 'inventario.info.sub.otros', { n: sitios.length })}
    >
      <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
        {sitios.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">{t('inventario.info.vacio')}</p>
        ) : (
          sitios.map((s) => (
            <div key={s.id} className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-ink">{s.nombre}</div>
                  <div className="demo-num text-[11px] text-muted">{s.codigoProveedor}</div>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  {textoTipoMedio(s.tipoMedio, t)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {s.plazaCiudad}
                  {s.pendienteVerificacion ? t('inventario.info.coords') : ''}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />{' '}
                  {t(s.modalidades.length === 1 ? 'inventario.info.modalidades.uno' : 'inventario.info.modalidades.otros', {
                    n: s.modalidades.length,
                  })}
                </span>
                <span className="demo-num text-ink">{formatMonto(s.tarifaPublicada, idioma)}</span>
              </div>

              {s.modalidadesDetalle && s.modalidadesDetalle.length > 0 && (
                <ul className="mt-2 divide-y divide-border rounded border border-border">
                  {s.modalidadesDetalle.map((m, i) => (
                    <li key={i} className="flex items-center justify-between px-2.5 py-1 text-[12px]">
                      <span className="capitalize text-ink">{m.unidad}</span>
                      <span className="demo-num text-muted">{formatMonto(m.tarifaPublicada, idioma)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
