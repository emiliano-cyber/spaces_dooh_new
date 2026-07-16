'use client'

import { useCallback, useEffect, useState } from 'react'
import { Lock, Unlock, Loader2 } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import { estadoCambiosApi, desbloquearApi, bloquearApi } from '@/lib/data/cambios-api'

// ============================================================================
//  Botón de la barra superior para desbloquear los cambios sensibles.
//  Solo aparece si el Dueño activó el control y a este rol le aplica (al Dueño
//  no le sale nunca).
//
//  Es un atajo de UX, no la seguridad: quien bloquea de verdad es el servidor en
//  cada ruta. Si alguien esconde este botón con el inspector, los cambios siguen
//  rechazándose con 403.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

function minutosRestantes(hasta: string | null): number {
  if (!hasta) return 0
  return Math.max(0, Math.ceil((new Date(hasta).getTime() - Date.now()) / 60_000))
}

export function DesbloqueoCambios() {
  const [requiere, setRequiere] = useState(false)
  const [hasta, setHasta] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [pass, setPass] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [, forzarRender] = useState(0)

  const refrescar = useCallback(async () => {
    try {
      const e = await estadoCambiosApi()
      setRequiere(e.requiere)
      setHasta(e.desbloqueadoHasta)
    } catch {
      setRequiere(false)
    }
  }, [])

  useEffect(() => { void refrescar() }, [refrescar])

  // Repinta cada 30 s para que la cuenta atrás no mienta y el candado vuelva a
  // cerrarse a la vista cuando expira.
  useEffect(() => {
    if (!hasta) return
    const t = setInterval(() => forzarRender((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [hasta])

  if (!requiere) return null

  const restan = minutosRestantes(hasta)
  const abierto = restan > 0

  async function desbloquear() {
    setError(null)
    setEnviando(true)
    try {
      const r = await desbloquearApi(pass)
      setHasta(r.hasta)
      setPass('')
      setOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo desbloquear')
    }
    setEnviando(false)
  }

  async function bloquear() {
    await bloquearApi()
    setHasta(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (abierto ? void bloquear() : setOpen(true))}
        title={
          abierto
            ? `Cambios desbloqueados ${restan} min más · clic para bloquear`
            : 'Los cambios de dinero y catálogo necesitan la contraseña del Dueño'
        }
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors',
          abierto
            ? 'border-success/40 bg-success/10 text-success hover:bg-success/20'
            : 'border-border text-muted hover:bg-surface-2 hover:text-ink',
        )}
      >
        {abierto ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{abierto ? `Desbloqueado ${restan} min` : 'Cambios bloqueados'}</span>
      </button>

      <Modal
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) { setPass(''); setError(null) } }}
        title="Desbloquear cambios"
        subtitle="Contraseña del Dueño"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={enviando}>Cancelar</Button>
            <Button size="sm" onClick={desbloquear} disabled={enviando || !pass}>
              {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Desbloquear
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[13px] text-muted">
            Los cambios que mueven dinero o el catálogo —tarifas, rentas, contratos, pagos,
            facturación y borrados— necesitan la contraseña que puso el Dueño. Al teclearla quedas
            desbloqueado un rato y no te la vuelve a pedir.
          </p>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-ink">Contraseña</span>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && pass && !enviando) void desbloquear() }}
              className={inputCls}
              autoFocus
              autoComplete="off"
            />
          </label>
          {error && <p className="text-[12px] text-error">{error}</p>}
        </div>
      </Modal>
    </>
  )
}
