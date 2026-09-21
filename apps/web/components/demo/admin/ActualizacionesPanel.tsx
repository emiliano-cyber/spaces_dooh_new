'use client'

import { useEffect, useState } from 'react'
import { Download, Loader2, CheckCircle2, AlertTriangle, Info, History } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import {
  fijarModoActualizacionApi,
  aprobarActualizacionApi,
  type EstadoActualizacion,
} from '@/lib/data/actualizaciones-api'
import { textoDeEstado, textoConfirmarInstalar } from '@/components/demo/admin/actualizaciones-ui'

// ============================================================================
//  ActualizacionesPanel — ADR 0037: el dueño de la instancia ve qué versión
//  hay disponible y decide si la toma. Este componente solo PINTA: la frase,
//  el tono y el texto de confirmación salen de `actualizaciones-ui.ts`, que sí
//  tiene pruebas (`vitest.config.ts` no monta jsdom, ver CLAUDE.md).
//
//  GET/PATCH /api/actualizaciones exige `administracion:ver`/`:aprobar`
//  (route.ts). Si el servidor responde 403, el panel se oculta en vez de
//  pintar un error — el mismo criterio que `OrganizacionesPanel`.
// ============================================================================

const TONO_ICONO = { ok: CheckCircle2, alerta: AlertTriangle, info: Info } as const
const TONO_CLASE = {
  ok: 'border-success/30 bg-success/10 text-ink',
  alerta: 'border-warning/40 bg-warning/10 text-ink',
  info: 'border-border bg-surface-2 text-ink',
} as const
const TONO_ICONO_CLASE = { ok: 'text-success', alerta: 'text-warning', info: 'text-muted' } as const

function formatearFecha(iso: string | null): string {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

export function ActualizacionesPanel({ onToast }: { onToast: (m: string) => void }) {
  const [estado, setEstado] = useState<EstadoActualizacion | null>(null)
  const [status, setStatus] = useState<'cargando' | 'ok' | 'sin-permiso' | 'error'>('cargando')
  const [cambiandoModo, setCambiandoModo] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [instalando, setInstalando] = useState(false)

  async function cargar() {
    try {
      // Fetch crudo, no `getEstadoActualizacionApi()`: aquí hace falta EL
      // STATUS, no solo el cuerpo, para distinguir "sin permiso" (se oculta,
      // como `OrganizacionesPanel`) de un fallo real (se dice). El resto de
      // los usos del endpoint, más abajo, sí pueden usar la función de
      // `lib/data/`: para entonces el panel ya se sabe visible.
      const r = await fetch('/spaces-dooh/api/actualizaciones/', { cache: 'no-store' })
      if (r.status === 401 || r.status === 403) { setStatus('sin-permiso'); return }
      if (!r.ok) { setStatus('error'); return }
      setEstado(await r.json())
      setStatus('ok')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => { void cargar() }, [])

  async function cambiarModo(modo: EstadoActualizacion['modo']) {
    if (!estado || estado.modo === modo || cambiandoModo) return
    setCambiandoModo(true)
    try {
      setEstado(await fijarModoActualizacionApi(modo))
      onToast(modo === 'automatica' ? 'Modo cambiado a automatica' : 'Modo cambiado a con aprobacion')
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'No se pudo cambiar el modo')
    }
    setCambiandoModo(false)
  }

  async function instalar() {
    if (!estado?.digestDisponible) return
    setInstalando(true)
    try {
      setEstado(await aprobarActualizacionApi(estado.digestDisponible))
      onToast('Instalacion aprobada: se instalara en los proximos minutos')
      setConfirmOpen(false)
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'No se pudo aprobar la instalacion')
    }
    setInstalando(false)
  }

  if (status === 'sin-permiso') return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-4 w-4 text-muted" /> Actualizaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === 'cargando' ? (
          <div className="h-24 animate-pulse rounded bg-surface-2" />
        ) : status === 'error' || !estado ? (
          <p className="text-[13px] text-error">No se pudo cargar el estado de la actualizacion.</p>
        ) : (
          <>
            {(() => {
              const { tono, texto } = textoDeEstado(estado)
              const Icono = TONO_ICONO[tono]
              return (
                <div className={`flex items-start gap-2 rounded border px-3 py-2 text-[13px] ${TONO_CLASE[tono]}`}>
                  <Icono className={`mt-0.5 h-4 w-4 shrink-0 ${TONO_ICONO_CLASE[tono]}`} />
                  <span>{texto}</span>
                </div>
              )
            })()}

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-muted sm:grid-cols-4">
              <span>
                Instalada: <span className="demo-num text-ink">{estado.versionInstalada ?? '—'}</span>
              </span>
              <span>
                Disponible: <span className="demo-num text-ink">{estado.versionDisponible ?? '—'}</span>
              </span>
              <span>
                Migraciones: <span className="demo-num text-ink">{estado.migracionesPendientes ?? 0}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <History className="h-3 w-3" /> Comprobado: <span className="text-ink">{formatearFecha(estado.comprobadoEn)}</span>
              </span>
            </div>

            <div className="space-y-1.5 border-t border-border pt-3">
              <p className="text-[12px] font-medium text-ink">Modo</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={estado.modo === 'aprobacion' ? 'primary' : 'secondary'}
                  disabled={cambiandoModo}
                  onClick={() => void cambiarModo('aprobacion')}
                >
                  {cambiandoModo && estado.modo !== 'aprobacion' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Con aprobacion
                </Button>
                <Button
                  size="sm"
                  variant={estado.modo === 'automatica' ? 'primary' : 'secondary'}
                  disabled={cambiandoModo}
                  onClick={() => void cambiarModo('automatica')}
                >
                  {cambiandoModo && estado.modo !== 'automatica' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Automatica
                </Button>
              </div>
              <p className="text-[11px] text-muted">
                Con aprobacion, tú decides cuándo instalar. Automatica la instala sola en la ventana de
                madrugada en cuanto se publica.
              </p>
            </div>

            {estado.hayNovedad && estado.modo === 'aprobacion' && estado.aprobadoDigest !== estado.digestDisponible && (
              <Button size="sm" onClick={() => setConfirmOpen(true)}>
                <Download className="h-3.5 w-3.5" /> Instalar {estado.versionDisponible}
              </Button>
            )}
          </>
        )}
      </CardContent>

      {estado && (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Instalar ${estado.versionDisponible ?? ''}`}
          variant="primary"
          busy={instalando}
          confirmLabel="Instalar"
          onConfirm={() => void instalar()}
        >
          {textoConfirmarInstalar(estado)}
        </ConfirmDialog>
      )}
    </Card>
  )
}
