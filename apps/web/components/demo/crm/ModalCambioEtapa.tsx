'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { useIdioma } from '@/lib/i18n/contexto'
import { ETAPAS_OPORTUNIDAD, type EtapaOportunidad } from '@/lib/crm'
import { cambiarEtapaApi, type FichaOportunidad } from '@/lib/data/oportunidades-api'
import {
  aceptaColumna,
  camposDeEtapa,
  faltaParaGuardar,
  guardarCambioEtapa,
  type CuerpoEtapa,
  type ValoresCambio,
} from '@/lib/seguimiento-arrastre'
import { claveEtapa } from './etiquetas'

// ============================================================================
//  ModalCambioEtapa — los campos del cambio de etapa, al SOLTAR una tarjeta.
// ----------------------------------------------------------------------------
//  18/11, pedido del dueño: «solo al terminar de moverlo abrir un modal con los
//  campos para llenar el cambio». Pide lo que acepta `POST …/etapa` y nada
//  más (su esquema es `.strict()`): la nota siempre; el motivo si se pierde
//  (obligatorio: el servidor da 400 sin él); y si se gana, una confirmación,
//  porque después ya no se mueve. Ganar estampa la fecha en el servidor.
//
//  `destino` null = se abrió con el botón «Mover» de la tarjeta (teclado o
//  quien no quiere arrastrar): entonces la etapa se elige en un selector.
//
//  Guardar: si el servidor dice que no (409 porque otra persona la cerró, 400…)
//  el mensaje llega por `onError` tal cual —el servidor ya lo traduce— y la
//  pantalla devuelve la tarjeta a su columna. Cancelar no manda nada.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export interface OportunidadAMover {
  id: string
  nombre: string
  cliente: string
  etapa: EtapaOportunidad
}

const VACIO: ValoresCambio = { nota: '', motivo: '', confirmado: false }

export function ModalCambioEtapa({
  oportunidad,
  destino,
  onCancelar,
  onGuardada,
  onError,
  api = cambiarEtapaApi,
}: {
  /** null = cerrado. */
  oportunidad: OportunidadAMover | null
  /** La columna donde se soltó; null = se elige aquí. */
  destino: EtapaOportunidad | null
  onCancelar: () => void
  onGuardada: (f: FichaOportunidad, etapa: EtapaOportunidad) => void
  onError: (mensaje: string) => void
  /** Solo para pruebas. */
  api?: (id: string, cuerpo: CuerpoEtapa) => Promise<FichaOportunidad>
}) {
  const { t } = useIdioma()
  const [elegida, setElegida] = useState<EtapaOportunidad | ''>(destino ?? '')
  const [v, setV] = useState<ValoresCambio>(VACIO)
  const [guardando, setGuardando] = useState(false)

  // Cada apertura empieza limpia (el mismo modal sirve a todas las tarjetas).
  const clave = oportunidad ? `${oportunidad.id}:${destino ?? ''}` : ''
  useEffect(() => {
    setElegida(destino ?? '')
    setV(VACIO)
    setGuardando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  if (!oportunidad) return null
  const etapa = (destino ?? elegida) || null
  const campos = etapa ? camposDeEtapa(etapa) : null
  const falta = etapa ? faltaParaGuardar(etapa, v) : 'etapa'
  const opciones = ETAPAS_OPORTUNIDAD.filter((e) => aceptaColumna({ tipo: 'oportunidad', id: oportunidad.id, etapa: oportunidad.etapa }, e))

  async function guardar() {
    if (!oportunidad || !etapa) return
    setGuardando(true)
    const r = await guardarCambioEtapa(oportunidad.id, etapa, v, api)
    setGuardando(false)
    if (r.ok) onGuardada(r.ficha, etapa)
    else if ('error' in r) onError(r.error)
  }

  return (
    <Modal
      open
      onOpenChange={(x) => !x && !guardando && onCancelar()}
      title={destino ? t('crm.arrastre.titulo', { etapa: t(claveEtapa(destino)) }) : t('crm.arrastre.mover')}
      subtitle={t('crm.arrastre.subtitulo', { oportunidad: oportunidad.nombre, cliente: oportunidad.cliente, etapa: t(claveEtapa(oportunidad.etapa)) })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={guardando} onClick={onCancelar}>{t('crm.form.cancelar')}</Button>
          <Button variant="primary" disabled={guardando || falta != null} onClick={guardar}>{t('crm.arrastre.guardar')}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        {!destino && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">{t('crm.ficha.etapa')}</span>
            <select aria-label={t('crm.ficha.etapa')} className={inputCls} value={elegida}
              onChange={(e) => setElegida(e.target.value as EtapaOportunidad | '')}>
              <option value="">{t('crm.form.elige')}</option>
              {opciones.map((e) => <option key={e} value={e}>{t(claveEtapa(e))}</option>)}
            </select>
          </label>
        )}
        {campos?.motivo && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              {t('crm.ficha.motivo')} <span className="text-error" aria-hidden>*</span>
            </span>
            <input className={inputCls} required aria-required="true" value={v.motivo} maxLength={2000} autoFocus
              onChange={(e) => setV((x) => ({ ...x, motivo: e.target.value }))} />
          </label>
        )}
        {campos?.confirmar && (
          <label className="flex items-start gap-2 text-[13px] text-ink">
            <input type="checkbox" className="mt-0.5" checked={v.confirmado}
              onChange={(e) => setV((x) => ({ ...x, confirmado: e.target.checked }))} />
            <span>{t('crm.arrastre.confirmar-ganada')}</span>
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">{t('crm.arrastre.nota')}</span>
          <textarea className={`${inputCls} h-20 py-2`} value={v.nota} maxLength={2000}
            onChange={(e) => setV((x) => ({ ...x, nota: e.target.value }))} />
        </label>
        {campos?.cierra && <p className="text-[12px] text-muted">{t('crm.arrastre.aviso-cierre')}</p>}
      </div>
    </Modal>
  )
}
