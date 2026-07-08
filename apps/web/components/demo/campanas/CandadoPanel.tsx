'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { Lock, LockOpen, Check, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useReadiness } from '@/lib/data/client'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { crearOrdenCompraApi } from '@/lib/data/estado-api'

// Candado de facturación: OC + fotos comprobatorias + reporte. Cuando los tres
// están, el candado se abre y la campaña queda lista para facturar. Para Telco
// Andina se enciende EN VIVO al cerrar la OT móvil con foto (Acto 4).
export function CandadoPanel({ campanaId }: { campanaId: string }) {
  const r = useReadiness(campanaId)
  const puedeOC = usePuede('comercial', 'crear')
  const [enviando, setEnviando] = useState(false)
  const [numeroOc, setNumeroOc] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [documento, setDocumento] = useState('')

  const inp =
    'h-8 w-full rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

  async function registrarOC() {
    if (!numeroOc.trim()) return
    setEnviando(true)
    try {
      await crearOrdenCompraApi({
        campanaId,
        numeroOc: numeroOc.trim(),
        monto: monto ? Number(monto) : null,
        fecha: fecha || null,
        documentoUrl: documento.trim() || null,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo registrar la OC')
    }
    setEnviando(false)
  }

  if (!r) return <div className="h-28 w-full animate-pulse rounded bg-surface-2" />

  const abierto = r.candado

  return (
    <div
      className={cn(
        'rounded-md border p-4',
        abierto ? 'border-[#10b98140] bg-[#10b9810d]' : 'border-border bg-surface',
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {abierto ? (
          <LockOpen className="h-4 w-4 text-success" strokeWidth={1.75} />
        ) : (
          <Lock className="h-4 w-4 text-muted" strokeWidth={1.75} />
        )}
        <span className="text-[13px] font-medium text-ink">
          {abierto ? 'Lista para facturar' : 'Candado de facturación'}
        </span>
      </div>
      <ul className="space-y-2">
        <Condicion ok={r.ocRecibida} label="Orden de compra recibida" />
        <Condicion ok={r.fotosComprobatorias} label="Fotografías comprobatorias" />
        <Condicion ok={r.reportePublicacion} label="Reporte de publicación" />
      </ul>
      {!r.ocRecibida && puedeOC && (
        <div className="mt-3 space-y-2 rounded border border-border bg-surface p-3">
          <p className="text-[12px] font-medium text-ink">Registrar OC del cliente</p>
          <input
            className={inp}
            placeholder="Número de OC del cliente *"
            value={numeroOc}
            onChange={(e) => setNumeroOc(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className={inp}
              type="number"
              placeholder="Monto (opcional)"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            <input className={inp} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <input
            className={inp}
            placeholder="Documento (URL del PDF/imagen)"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
          <button
            type="button"
            disabled={enviando || !numeroOc.trim()}
            onClick={registrarOC}
            className="w-full rounded border border-border-strong px-3 py-2 text-[12px] font-medium text-ink transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50"
          >
            {enviando ? 'Registrando…' : 'Registrar OC'}
          </button>
          <p className="text-[10px] text-muted">
            El pipeline marca “OC recibida” solo con este registro (número, monto, fecha y documento).
          </p>
        </div>
      )}
      {!abierto && (
        <p className="mt-3 text-[12px] text-muted">
          El candado se enciende cuando se completan las tres condiciones.
        </p>
      )}
    </div>
  )
}

function Condicion({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px]">
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full',
          ok ? 'bg-success text-white' : 'bg-surface-2 text-muted',
        )}
      >
        {ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className={ok ? 'text-ink' : 'text-muted'}>{label}</span>
    </li>
  )
}
