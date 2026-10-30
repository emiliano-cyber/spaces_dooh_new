'use client'

import { toast } from 'sonner'
import { useCallback, useEffect, useState } from 'react'
import { Pause, Play, RefreshCw, Loader2, AlertTriangle } from 'lucide-react'
import { StatusBadge, type Tono } from '@/components/demo/StatusBadge'
import { Button } from '@/components/demo/ui/Button'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { ETIQUETA_ESTADO_REMOTO, accionesDoohmain } from '@/lib/doohmain-estado'
import {
  estadoDoohmainApi,
  cambiarEstadoDoohmainApi,
  type CreativoEnDoohmain,
} from '@/lib/data/playlogs-api'

// ============================================================================
//  Cada creativo de la campaña tal como está AHORA en DOOHmain (29/10): en qué
//  pantallas, si está al aire o en pausa, y el botón para pausarlo o
//  reanudarlo.
//
//  Pausar es la única forma REVERSIBLE de bajar un creativo: la API de DOOHmain
//  no deja quitar un arte de la lista. Bajarlo para siempre sigue siendo la
//  papelera del panel de validación, que finaliza su campaña.
//
//  Un estado que DOOHmain no devolvió o que no reconocemos sale «Sin
//  confirmar» y se ofrecen las dos acciones: no se adivina «al aire». Qué
//  botones lleva cada estado lo decide `accionesDoohmain()`: un «Terminó» o un
//  «Eliminada» no ofrecen reanudar, porque reanudar no los vuelve al aire.
// ============================================================================

const TONO: Record<NonNullable<CreativoEnDoohmain['estado']>, Tono> = {
  active: 'verde',
  pause: 'ambar',
  finished: 'neutro',
  pending: 'azul',
  vencida: 'neutro',
  programada: 'azul',
  eliminada: 'rojo',
  no_encontrada: 'rojo',
}

export function CreativosEnDoohmain({ campanaId }: { campanaId: string }) {
  const puede = usePuede('comercial', 'crear')
  const [creativos, setCreativos] = useState<CreativoEnDoohmain[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [confirmar, setConfirmar] = useState<{ cr: CreativoEnDoohmain; accion: 'pausar' | 'reanudar' } | null>(null)
  const [busy, setBusy] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const d = await estadoDoohmainApi(campanaId)
      setCreativos(d.creativos)
      setError(d.error)
    } catch (e) {
      setCreativos([])
      setError(e instanceof Error ? e.message : 'No se pudo leer el estado en DOOHmain')
    }
    setCargando(false)
  }, [campanaId])

  useEffect(() => { void cargar() }, [cargar])

  async function aplicar() {
    if (!confirmar) return
    setBusy(true)
    try {
      await cambiarEstadoDoohmainApi(confirmar.cr.creativoId, confirmar.accion)
      toast.success(
        confirmar.accion === 'pausar'
          ? `“${confirmar.cr.nombre}” quedó en pausa en DOOHmain`
          : `“${confirmar.cr.nombre}” volvió al aire en DOOHmain`,
      )
      setConfirmar(null)
      await cargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar en DOOHmain')
    }
    setBusy(false)
  }

  if (creativos === null) return <div className="h-12 animate-pulse rounded bg-surface-2" />
  if (!creativos.length) return null

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-[12px] font-medium text-ink">En DOOHmain ahora</span>
        <Button size="sm" variant="ghost" onClick={cargar} disabled={cargando} title="Volver a preguntar a DOOHmain">
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>
      {error && (
        <p className="flex items-start gap-1.5 border-b border-border px-3 py-2 text-[12px] text-error">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
      <ul className="divide-y divide-border">
        {creativos.map((cr) => (
          <li key={cr.creativoId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] text-ink" title={cr.nombre}>{cr.nombre}</div>
              <div className="truncate text-[11px] text-muted">
                {cr.pantallas.length ? cr.pantallas.join(' · ') : 'sin pantallas registradas'}
              </div>
            </div>
            <StatusBadge tono={cr.estado ? TONO[cr.estado] : 'neutro'} className="px-1.5 py-0 text-[10px]">
              {cr.estado ? ETIQUETA_ESTADO_REMOTO[cr.estado] : 'Sin confirmar'}
            </StatusBadge>
            {puede && accionesDoohmain(cr.estado).length > 0 && (
              <div className="flex gap-1">
                {accionesDoohmain(cr.estado).includes('pausar') && (
                  <Button size="sm" variant="secondary" onClick={() => setConfirmar({ cr, accion: 'pausar' })}>
                    <Pause className="h-3.5 w-3.5" /> Pausar
                  </Button>
                )}
                {accionesDoohmain(cr.estado).includes('reanudar') && (
                  <Button size="sm" variant="secondary" onClick={() => setConfirmar({ cr, accion: 'reanudar' })}>
                    <Play className="h-3.5 w-3.5" /> Reanudar
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirmar !== null}
        onOpenChange={(v) => !v && setConfirmar(null)}
        title={confirmar?.accion === 'pausar' ? 'Pausar en DOOHmain' : 'Reanudar en DOOHmain'}
        confirmLabel={confirmar?.accion === 'pausar' ? 'Sí, pausar' : 'Sí, reanudar'}
        // Las dos tienen vuelta: no se pinta de destructivo lo que no lo es.
        variant="primary"
        busy={busy}
        onConfirm={aplicar}
      >
        {confirmar?.accion === 'pausar' ? (
          <>
            <span className="font-medium text-ink">“{confirmar?.cr.nombre}”</span> deja de reproducirse en{' '}
            {confirmar?.cr.pantallas.length ?? 0} pantalla(s) de DOOHmain. El arte se queda en su lista y se
            puede reanudar cuando quieras.
          </>
        ) : (
          <>
            <span className="font-medium text-ink">“{confirmar?.cr.nombre}”</span> vuelve a reproducirse en
            DOOHmain con la programación que ya tenía.
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}
