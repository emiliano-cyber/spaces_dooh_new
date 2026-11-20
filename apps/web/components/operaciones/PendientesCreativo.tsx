'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo } from '@/components/demo/ui/Campo'
import { EntradaCifra } from '@/components/demo/ui/EntradaCifra'
import { StatusBadge } from '@/components/demo/StatusBadge'
import { useIdioma } from '@/lib/i18n/contexto'
import { cifraIlegible } from '@/lib/captura-cifra'
import { medidaEnIdioma } from '@/components/operaciones/ArteEnSitio'
import { crearOrdenImpresionApi, type ImprentaApi } from '@/lib/data/estado-api'
import type { Pendiente } from '@/lib/pendientes-creativo'
import { subidoPor, type OrigenCreativo } from '@/lib/origen-creativo'

// ============================================================================
//  La «tarea 1» del flujo del creativo, en pantalla (FLUJO-CREA, 20/11).
//  Lo comparten Imprenta («Por mandar a impresión») y Creativos (los
//  pendientes con su origen). La regla está en `lib/pendientes-creativo.ts`;
//  esto solo lo pinta y confirma.
// ============================================================================

const API = '/spaces-dooh/api'

/** Lee los pendientes de una de las dos rutas. `null` mientras carga. */
export function usePendientes(ruta: 'impresion' | 'creativos', activo = true) {
  const [lista, setLista] = useState<Pendiente[] | null>(null)
  const recargar = useCallback(async () => {
    try {
      const r = await fetch(`${API}/${ruta}/pendientes/`)
      setLista(r.ok ? ((await r.json()) as Pendiente[]) : [])
    } catch {
      setLista([])
    }
  }, [ruta])
  useEffect(() => {
    if (activo) void recargar()
  }, [activo, recargar])
  return { pendientes: lista, recargar }
}

/**
 * «Subido por: el cliente (Nombre)» / «Subido por: Ana López» / «Origen
 * desconocido» (CREA-ORIGEN, 20/11). El origen es un DATO del creativo; el
 * texto lo decide `subidoPor` (`lib/origen-creativo.ts`, con pruebas). Lo usan
 * Creativos, Imprenta y la ficha de la campaña.
 */
export function OrigenCreativoBadge({
  origen,
  subidoPorNombre,
}: {
  origen?: OrigenCreativo | null
  subidoPorNombre?: string | null
}) {
  const { t } = useIdioma()
  const { clave, vars } = subidoPor({ origen, subidoPorNombre })
  return (
    <StatusBadge tono={origen === 'CLIENTE' ? 'azul' : 'neutro'} className="px-1.5 py-0 text-[10px]">
      {t(clave, vars)}
    </StatusBadge>
  )
}

/**
 * Confirmar «Mandar a impresión»: la orden con la campaña y el sitio del
 * pendiente (fijos), y lo que pide el alta manual —material, medida,
 * proveedor, imprenta— precargado del sitio y editable. Opcional: la fecha
 * especial. Crea con `POST /api/impresion` (imprenta.crear), el mismo camino
 * que «Nueva orden»; con la orden creada el pendiente desaparece solo.
 */
export function MandarAImpresionDialog({
  pendiente,
  imprentas,
  onClose,
  onHecho,
}: {
  pendiente: Pendiente | null
  imprentas: ImprentaApi[] | null
  onClose: () => void
  onHecho: () => void
}) {
  const { t, idioma } = useIdioma()
  const [material, setMaterial] = useState('')
  const [ancho, setAncho] = useState('')
  const [alto, setAlto] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [imprentaId, setImprentaId] = useState('')
  const [fechaEspecial, setFechaEspecial] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Precarga al abrir: la medida del sitio. Lo demás empieza vacío.
  useEffect(() => {
    if (!pendiente) return
    setMaterial('')
    setAncho(pendiente.sitioAncho ? String(pendiente.sitioAncho) : '')
    setAlto(pendiente.sitioAlto ? String(pendiente.sitioAlto) : '')
    setProveedor('')
    setImprentaId('')
    setFechaEspecial('')
  }, [pendiente])

  async function confirmar() {
    if (!pendiente) return
    if (cifraIlegible(ancho, idioma) || cifraIlegible(alto, idioma)) return
    setEnviando(true)
    try {
      await crearOrdenImpresionApi({
        campanaId: pendiente.campanaId,
        sitioId: pendiente.sitioId,
        material: material.trim(),
        ancho: ancho ? Number(ancho) : 0,
        alto: alto ? Number(alto) : 0,
        proveedor: proveedor.trim(),
        imprentaId: imprentaId || null,
        fechaEspecial: fechaEspecial || null,
      })
      toast.success(t('operaciones.imprenta.pendientes.creada'))
      onHecho()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('operaciones.imprenta.no-crear'))
    }
    setEnviando(false)
  }

  const campo = 'w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink'
  return (
    <Modal
      open={!!pendiente}
      onOpenChange={(v) => !v && onClose()}
      title={t('operaciones.imprenta.pendientes.mandar')}
      subtitle={pendiente ? `${pendiente.campanaNombre} · ${pendiente.sitioNombre ?? ''}` : undefined}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
          <Button variant="primary" size="sm" disabled={enviando} onClick={confirmar}>
            <Printer className="h-3.5 w-3.5" />
            {enviando ? t('operaciones.imprenta.creando') : t('operaciones.imprenta.pendientes.confirmar')}
          </Button>
        </div>
      }
    >
      {pendiente && (
        <div className="space-y-3">
          {pendiente.sitioAncho && pendiente.sitioAlto ? (
            <p className="text-[12px] text-muted">
              {t('operaciones.imprenta.pendientes.medida-sitio', { medida: medidaEnIdioma(pendiente.sitioAncho, pendiente.sitioAlto, idioma) })}
            </p>
          ) : null}
          <Campo label={t('operaciones.imprenta.campo.material')}>
            <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder={t('operaciones.imprenta.campo.material-ej')} className={campo} />
          </Campo>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label={t('operaciones.imprenta.campo.ancho')}>
              <EntradaCifra type="number" inputMode="decimal" valor={ancho} onCambio={setAncho} placeholder="0" decimales={2} minimo={0} className={`demo-num ${campo}`} />
            </Campo>
            <Campo label={t('operaciones.imprenta.campo.alto')}>
              <EntradaCifra type="number" inputMode="decimal" valor={alto} onCambio={setAlto} placeholder="0" decimales={2} minimo={0} className={`demo-num ${campo}`} />
            </Campo>
          </div>
          <Campo label={t('operaciones.imprenta.campo.proveedor')}>
            <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder={t('operaciones.imprenta.campo.proveedor-ej')} className={campo} />
          </Campo>
          {imprentas && imprentas.some((im) => im.activo) && (
            <Campo label={t('operaciones.imprenta.imprentas.orden.imprenta')}>
              <select value={imprentaId} onChange={(e) => setImprentaId(e.target.value)} className={campo}>
                <option value="">{t('operaciones.imprenta.imprentas.orden.sin')}</option>
                {imprentas.filter((im) => im.activo).map((im) => (
                  <option key={im.id} value={im.id}>{im.nombre}</option>
                ))}
              </select>
            </Campo>
          )}
          <Campo label={t('operaciones.imprenta.fecha-especial.campo')}>
            <input type="date" value={fechaEspecial} onChange={(e) => setFechaEspecial(e.target.value)} className={`demo-num ${campo}`} />
          </Campo>
          <p className="text-[12px] text-muted">{t('operaciones.imprenta.fecha-especial.ayuda')}</p>
        </div>
      )}
    </Modal>
  )
}
