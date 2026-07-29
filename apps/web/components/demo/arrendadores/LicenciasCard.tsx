'use client'

import { useState } from 'react'
import { ShieldCheck, Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { StatusBadge, type Tono } from '@/components/demo/StatusBadge'
import { useLicencias, formatFecha, diasHasta } from '@/lib/data/client'
import { crearLicenciaApi, borrarLicenciaApi } from '@/lib/data/estado-api'
import { LICENCIA_LABEL, DIAS_AVISO_LICENCIA } from '@/lib/data/derive'

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
function vigencia(fechaVencimiento: string): { tono: Tono; texto: string } {
  const dias = diasHasta(fechaVencimiento)
  if (dias < 0) return { tono: 'rojo', texto: `Venció hace ${Math.abs(dias)} d` }
  if (dias <= 30) return { tono: 'rojo', texto: `Vence en ${dias} d` }
  if (dias <= DIAS_AVISO_LICENCIA) return { tono: 'ambar', texto: `Vence en ${dias} d` }
  return { tono: 'verde', texto: 'Vigente' }
}

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
          <ShieldCheck className="h-4 w-4 text-muted" /> Licencias y permisos
        </h4>
        <Button variant="secondary" className="h-7 px-2 text-[12px]" onClick={() => setAbrir(true)}>
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
      </div>

      {predioId && mias.length > 0 && (
        <p className="mb-2 text-[11.5px] text-muted">
          Amparan a todas las pantallas de este predio.
        </p>
      )}

      {!mias.length ? (
        <p className="rounded border border-dashed border-border-strong p-2.5 text-[12.5px] text-muted">
          Sin licencias registradas. Al capturar la vigencia, el sistema avisa con{' '}
          {DIAS_AVISO_LICENCIA} días de anticipación.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {mias.map((l) => {
            const v = vigencia(l.fechaVencimiento)
            return (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 rounded border border-border px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] text-ink">
                    {LICENCIA_LABEL[l.tipo] ?? 'Permiso'}
                    {l.folio ? ` · ${l.folio}` : ''}
                  </p>
                  <p className="truncate text-[11.5px] text-muted">
                    {l.autoridad ? `${l.autoridad} · ` : ''}
                    vence {formatFecha(l.fechaVencimiento)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StatusBadge tono={v.tono}>{v.texto}</StatusBadge>
                  <button
                    type="button"
                    aria-label="Borrar licencia"
                    className="rounded p-1 text-muted hover:text-error"
                    onClick={async () => {
                      try {
                        await borrarLicenciaApi(l.id)
                        onToast('Licencia borrada')
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

  const invertidas = !!expedicion && !!vencimiento && vencimiento < expedicion

  async function guardar() {
    if (!vencimiento || invertidas || guardando) return
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
      onToast('Licencia registrada')
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
      title="Registrar licencia o permiso"
      subtitle="La fecha de vencimiento es lo que dispara el aviso"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={!vencimiento || invertidas || guardando}
            onClick={guardar}
          >
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">Tipo</span>
          <select className={inputCls} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {LICENCIA_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">Folio (opcional)</span>
          <input className={inputCls} value={folio} onChange={(e) => setFolio(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted">
            Autoridad que la expide (opcional)
          </span>
          <input className={inputCls} value={autoridad} onChange={(e) => setAutoridad(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Expedición (opcional)</span>
            <input
              type="date"
              className={inputCls}
              value={expedicion}
              onChange={(e) => setExpedicion(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted">Vencimiento</span>
            <input
              type="date"
              className={inputCls}
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
            />
          </label>
        </div>
        {invertidas && (
          <p className="rounded border border-error/40 bg-error-soft p-2 text-[12px] text-ink">
            La licencia no puede vencer antes de expedirse.
          </p>
        )}
      </div>
    </Modal>
  )
}
