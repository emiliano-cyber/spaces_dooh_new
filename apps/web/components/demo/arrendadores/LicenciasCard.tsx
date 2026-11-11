'use client'

import { useState } from 'react'
import { ShieldCheck, Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { StatusBadge, type Tono } from '@/components/demo/StatusBadge'
import { useLicencias, formatFecha, diasHasta } from '@/lib/data/client'
import { crearLicenciaApi, borrarLicenciaApi } from '@/lib/data/estado-api'
import { DIAS_AVISO_LICENCIA } from '@/lib/data/derive'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { CLAVE_LICENCIA } from '@/components/demo/arrendadores/etiquetas'

// ============================================================================
//  Licencias y permisos de un emplazamiento.
//
//  El anclaje es EXCLUYENTE, igual que el del contrato: si la pantalla pertenece
//  a un predio, el permiso es del PREDIO y ampara a todas sus hermanas; si es una
//  pantalla suelta, el permiso es suyo. Por eso el componente recibe los dos ids
//  y decide solo — no se le pide al usuario que elija, porque elegir mal dejaría
//  medio predio sin amparo y nadie lo notaría.
//
//  Un permiso vencido AVISA pero no bloquea la venta (decisión del dueño del
//  producto): bloquear en automático frenaría ventas cuando el permiso ya está
//  renovado pero todavía no capturado.
// ============================================================================

const TIPOS = ['MUNICIPAL', 'AMBIENTAL', 'ESTRUCTURAL', 'OTRO'] as const

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Mismo criterio que las alertas de `derive.ts`, para que la ficha y el tablero
// nunca se contradigan: vencido o a 30 días → rojo; dentro del margen de aviso →
// ámbar; más lejos → verde.
function vigencia(
  fechaVencimiento: string,
  t: (clave: ClaveTexto, v?: Record<string, string | number>) => string,
): { tono: Tono; texto: string } {
  const dias = diasHasta(fechaVencimiento)
  if (dias < 0) return { tono: 'rojo', texto: t('arrendadores.licencias.vencio', { n: Math.abs(dias) }) }
  if (dias <= 30) return { tono: 'rojo', texto: t('arrendadores.licencias.vence-en', { n: dias }) }
  if (dias <= DIAS_AVISO_LICENCIA) return { tono: 'ambar', texto: t('arrendadores.licencias.vence-en', { n: dias }) }
  return { tono: 'verde', texto: t('arrendadores.licencias.vigente') }
}

// `LICENCIA_LABEL` (derive.ts) en el idioma de quien mira; uno desconocido es «Permiso».
const claveLicencia = (tipo: string): ClaveTexto => CLAVE_LICENCIA[tipo] ?? 'arrendadores.licencia.otro'

export function LicenciasCard({
  predioId,
  sitioId,
  onToast,
}: {
  predioId: string | null
  sitioId: string | null
  onToast: (msg: string) => void
}) {
  const licencias = useLicencias()
  const [abrir, setAbrir] = useState(false)
  const { idioma, t } = useIdioma()

  // Manda el predio: si la pantalla pertenece a uno, el permiso lo ampara a él.
  const anclaje = predioId ? { predioId } : sitioId ? { sitioId } : null
  const mias = (licencias ?? []).filter((l) =>
    predioId ? l.predioId === predioId : l.sitioId === sitioId,
  )

  if (!anclaje) return null

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <ShieldCheck className="h-4 w-4 text-muted" /> {t('arrendadores.licencias.titulo')}
        </h4>
        <Button variant="success" className="h-7 px-2 text-[12px]" onClick={() => setAbrir(true)}>
          <Plus className="h-3.5 w-3.5" /> {t('arrendadores.comun.agregar')}
        </Button>
      </div>

      {predioId && mias.length > 0 && (
        <p className="mb-2 text-[11.5px] text-muted">
          {t('arrendadores.licencias.amparan')}
        </p>
      )}

      {!mias.length ? (
        <p className="rounded border border-dashed border-border-strong p-2.5 text-[12.5px] text-muted">
          {t('arrendadores.licencias.vacio', { n: DIAS_AVISO_LICENCIA })}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {mias.map((l) => {
            const v = vigencia(l.fechaVencimiento, t)
            return (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 rounded border border-border px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] text-ink">
                    {t(claveLicencia(l.tipo))}
                    {l.folio ? ` · ${l.folio}` : ''}
                  </p>
                  <p className="truncate text-[11.5px] text-muted">
                    {l.autoridad ? `${l.autoridad} · ` : ''}
                    {t('arrendadores.licencias.vence', { fecha: formatFecha(l.fechaVencimiento, idioma) })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge tono={v.tono}>{v.texto}</StatusBadge>
                  <button
                    type="button"
                    aria-label={t('arrendadores.licencias.borrar')}
                    className="rounded p-1 text-muted hover:text-error"
                    onClick={async () => {
                      try {
                        await borrarLicenciaApi(l.id)
                        onToast(t('arrendadores.licencias.borrada'))
                      } catch (e) {
                        onToast((e as Error).message)
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {abrir && <AltaLicencia anclaje={anclaje} onCerrar={() => setAbrir(false)} onToast={onToast} />}
    </section>
  )
}

function AltaLicencia({
  anclaje,
  onCerrar,
  onToast,
}: {
  anclaje: { predioId: string } | { sitioId: string }
  onCerrar: () => void
  onToast: (msg: string) => void
}) {
  const [tipo, setTipo] = useState<string>('MUNICIPAL')
  const [folio, setFolio] = useState('')
  const [autoridad, setAutoridad] = useState('')
  const [expedicion, setExpedicion] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [guardando, setGuardando] = useState(false)
  const { t } = useIdioma()

  // OBLIG-01: tipo y vencimiento son los obligatorios del servidor
  // (`licenciaSchema`, lib/server/arrendadores-controller.ts:451-461). El
  // vencimiento ya no deshabilita el botón: se pulsa y se pinta en rojo.
  const ob = useObligatorios({ tipo, vencimiento }, ['tipo', 'vencimiento'])
  const invertidas = !!expedicion && !!vencimiento && vencimiento < expedicion

  async function guardar() {
    if (invertidas || guardando) return
    if (!ob.validar()) return
    setGuardando(true)
    try {
      await crearLicenciaApi({
        ...anclaje,
        tipo,
        folio: folio.trim() || null,
        autoridad: autoridad.trim() || null,
        fechaExpedicion: expedicion || null,
        fechaVencimiento: vencimiento,
      })
      onToast(t('arrendadores.licencias.registrada'))
      onCerrar()
    } catch (e) {
      onToast((e as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={onCerrar}
      title={t('arrendadores.licencias.alta')}
      subtitle={t('arrendadores.licencias.alta-sub')}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCerrar}>
            {t('comun.cancelar')}
          </Button>
          <Button
            className="flex-1"
            disabled={invertidas || guardando}
            onClick={guardar}
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t('comun.guardar')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label={t('arrendadores.incidencia.tipo')} obligatorio falta={ob.falta('tipo')}>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((tipoLic) => (
              <option key={tipoLic} value={tipoLic}>
                {t(claveLicencia(tipoLic))}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label={t('arrendadores.licencias.folio')}>
          <input className={inputCls} value={folio} onChange={(e) => setFolio(e.target.value)} />
        </Campo>
        <Campo label={t('arrendadores.licencias.autoridad')}>
          <input className={inputCls} value={autoridad} onChange={(e) => setAutoridad(e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label={t('arrendadores.licencias.expedicion')}>
            <input
              type="date"
              className={inputCls}
              value={expedicion}
              onChange={(e) => setExpedicion(e.target.value)}
            />
          </Campo>
          <Campo
            label={t('arrendadores.licencias.vencimiento')}
            obligatorio
            falta={ob.falta('vencimiento')}
            error={invertidas ? t('arrendadores.licencias.antes-expedicion') : null}
          >
            <input
              type="date"
              className={inputCls}
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
            />
          </Campo>
        </div>
        {invertidas && (
          <p className="rounded border border-error/40 bg-error-soft p-2 text-[12px] text-ink">
            {t('arrendadores.licencias.invertidas')}
          </p>
        )}
      </div>
    </Modal>
  )
}
