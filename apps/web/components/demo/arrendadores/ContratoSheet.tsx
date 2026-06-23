'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw, Building2 } from 'lucide-react'
import { Sheet } from '@/components/demo/ui/Sheet'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import {
  StatusBadge,
  CONTRATO_TONO,
  CONTRATO_LABEL,
  PAGO_TONO,
  PAGO_LABEL,
  SITIO_TONO,
  SITIO_LABEL,
} from '@/components/demo/StatusBadge'
import {
  useArrendadores,
  useSitios,
  usePagosRenta,
  formatMonto,
  formatFecha,
  diasHasta,
  type ContratoArrendamiento,
  type TipoIncidencia,
} from '@/lib/data/client'
import {
  registrarPagoRentaApi,
  iniciarRenovacionApi,
  reportarIncidenciaApi,
} from '@/lib/data/estado-api'

const TIPO_INC: { value: TipoIncidencia; label: string }[] = [
  { value: 'LEGAL', label: 'Legal / permiso' },
  { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
  { value: 'VANDALISMO', label: 'Vandalismo' },
  { value: 'CLIMA', label: 'Clima' },
  { value: 'SUSPENSION_OPERATIVA', label: 'Suspensión operativa' },
  { value: 'ACCIDENTE', label: 'Accidente' },
  { value: 'OTRO', label: 'Otro' },
]

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function ContratoSheet({
  contrato,
  open,
  onOpenChange,
  onToast,
}: {
  contrato: ContratoArrendamiento | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onToast: (msg: string) => void
}) {
  const arrendadores = useArrendadores()
  const sitios = useSitios()
  const pagos = usePagosRenta()
  const [incOpen, setIncOpen] = useState(false)

  if (!contrato) return null
  const arrendador = arrendadores?.find((a) => a.id === contrato.arrendadorId)
  const sitio = sitios?.find((s) => s.id === contrato.sitioId)
  const misPagos = (pagos ?? []).filter((p) => p.contratoId === contrato.id)
  const dias = diasHasta(contrato.fechaFin)

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={arrendador?.nombre ?? 'Contrato'}
        subtitle={sitio ? `${sitio.nombre} · ${sitio.alcaldia}` : undefined}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setIncOpen(true)}>
              <AlertTriangle className="h-4 w-4" /> Reportar incidencia
            </Button>
            {(contrato.estatus === 'POR_VENCER' || dias <= 60) && contrato.estatus !== 'RENOVADO' && (
              <Button
                className="flex-1"
                onClick={async () => {
                  await iniciarRenovacionApi(contrato.id)
                  onToast('Renovación iniciada')
                }}
              >
                <RefreshCw className="h-4 w-4" /> Renovar
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tono={CONTRATO_TONO[contrato.estatus]}>
              {CONTRATO_LABEL[contrato.estatus]}
            </StatusBadge>
            {sitio && (
              <StatusBadge tono={SITIO_TONO[sitio.estatusComercial]}>
                {SITIO_LABEL[sitio.estatusComercial]}
              </StatusBadge>
            )}
          </div>

          {/* Contrato */}
          <div>
            <h4 className="mb-2 text-[13px] font-medium text-ink">Contrato de arrendamiento</h4>
            <dl className="space-y-2 text-[13px]">
              <Fila label="Renta mensual" valor={formatMonto(contrato.montoRenta)} mono />
              <Fila label="Periodicidad" valor={contrato.periodicidad.toLowerCase()} />
              <Fila label="Vigencia" valor={`${formatFecha(contrato.fechaInicio)} – ${formatFecha(contrato.fechaFin)}`} mono />
              <Fila
                label="Tiempo restante"
                valor={dias < 0 ? 'Vencido' : `${dias} días`}
              />
              <Fila label="Renovación automática" valor={contrato.autoRenovable ? 'Sí' : 'No'} />
            </dl>
          </div>

          {/* Pagos de renta */}
          <div>
            <h4 className="mb-2 text-[13px] font-medium text-ink">Pagos de renta</h4>
            {misPagos.length === 0 ? (
              <p className="text-[12px] text-muted">Sin pagos registrados.</p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {misPagos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <div className="text-[13px] capitalize text-ink">{p.periodo}</div>
                      <div className="demo-num text-[11px] text-muted">{formatMonto(p.monto)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge tono={PAGO_TONO[p.estatus]}>{PAGO_LABEL[p.estatus]}</StatusBadge>
                      {p.estatus !== 'PAGADO' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            await registrarPagoRentaApi(p.id)
                            onToast('Pago registrado')
                          }}
                        >
                          Registrar
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Arrendador */}
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <Building2 className="h-3.5 w-3.5 text-muted" /> Arrendador
            </h4>
            <dl className="space-y-2 text-[13px]">
              <Fila label="RUC" valor={arrendador?.rfc ?? '—'} mono />
              <Fila label="Correo" valor={arrendador?.email ?? '—'} />
              <Fila label="Teléfono" valor={arrendador?.telefono ?? '—'} />
            </dl>
          </div>
        </div>
      </Sheet>

      {/* Reportar incidencia → sitio ROJO en Comercial (Acto 2) */}
      {sitio && (
        <ReportarIncidenciaModal
          open={incOpen}
          onOpenChange={setIncOpen}
          sitioNombre={sitio.nombre}
          onSubmit={async (tipo, descripcion) => {
            await reportarIncidenciaApi({ sitioId: sitio.id, tipo, descripcion })
            onToast(`Incidencia reportada · ${sitio.nombre} bloqueado en Comercial`)
            setIncOpen(false)
          }}
        />
      )}
    </>
  )
}

function ReportarIncidenciaModal({
  open,
  onOpenChange,
  sitioNombre,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sitioNombre: string
  onSubmit: (tipo: TipoIncidencia, descripcion: string) => void
}) {
  const [tipo, setTipo] = useState<TipoIncidencia>('LEGAL')
  const [desc, setDesc] = useState('')
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Reportar incidencia"
      subtitle={sitioNombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onSubmit(tipo, desc.trim() || 'Incidencia reportada desde Arrendadores.')}
          >
            Reportar y bloquear sitio
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Tipo</span>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value as TipoIncidencia)}>
            {TIPO_INC.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-ink">Descripción</span>
          <textarea
            className="min-h-[80px] w-full rounded border border-border-strong bg-surface px-3 py-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Describe la incidencia…"
          />
        </label>
        <p className="text-[12px] text-muted">
          Al reportar, el sitio pasa a <span className="font-medium text-error">bloqueado</span> y
          aparece en rojo en el mapa de Comercial al instante.
        </p>
      </div>
    </Modal>
  )
}

function Fila({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={mono ? 'demo-num text-ink' : 'text-ink'}>{valor}</dd>
    </div>
  )
}
