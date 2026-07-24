'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Camera,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  BatteryMedium,
  CheckCircle2,
  XCircle,
  CircleHelp,
  AlertTriangle,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { StatusBadge } from '@/components/demo/StatusBadge'
import { visionSitioApi, type VisionSitio } from '@/lib/data/space-eye-api'

// Sección "Inteligencia artificial" de la ficha de la pantalla, ahora conectada
// a Space Eye: muestra la CÁMARA REAL del espectacular (estado del dispositivo,
// última foto y dictamen de IA) en vez de una imagen de demostración. El enlace
// pantalla↔cámara es por codigo_proveedor == billboard_code.
export function SpaceEyeVision({ sitioId, sitioNombre }: { sitioId: string; sitioNombre: string }) {
  const [data, setData] = useState<VisionSitio | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verFoto, setVerFoto] = useState(false)

  const sincronizar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setData(await visionSitioApi(sitioId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar con Space Eye')
    }
    setCargando(false)
  }, [sitioId])

  // Sincroniza al abrir la ficha (y al cambiar de pantalla).
  useEffect(() => {
    void sincronizar()
  }, [sincronizar])

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-[13px] font-medium text-ink">Inteligencia artificial · Space Eye</h4>
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={cargando}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[12px] text-muted hover:text-ink disabled:opacity-50"
          title="Sincronizar con Space Eye"
        >
          {cargando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar
        </button>
      </div>

      {cargando && !data ? (
        <div className="h-24 animate-pulse rounded-md bg-surface-2" />
      ) : error ? (
        <div className="flex items-start gap-2 rounded-md border border-[#ef444440] bg-[#ef44440d] p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <div className="font-medium text-ink">No se pudo conectar con Space Eye</div>
            <div className="text-muted">{error}</div>
          </div>
        </div>
      ) : !data?.disponible ? (
        <div className="rounded-md border border-border bg-surface-2 p-3 text-[12px] text-muted">
          {data?.motivo === 'no_configurado'
            ? 'La integración con Space Eye no está configurada en este entorno.'
            : 'Esta pantalla no tiene una cámara Space Eye vinculada (sin dispositivo con ese código).'}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Estado del dispositivo (teléfono en campo) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
            <StatusBadge tono={data.dispositivo?.online ? 'verde' : 'neutro'}>
              {data.dispositivo?.online ? (
                <span className="inline-flex items-center gap-1"><Wifi className="h-3 w-3" /> En línea</span>
              ) : (
                <span className="inline-flex items-center gap-1"><WifiOff className="h-3 w-3" /> Desconectado</span>
              )}
            </StatusBadge>
            {data.dispositivo?.bateriaPct != null && (
              <span className="inline-flex items-center gap-1 text-muted">
                <BatteryMedium className={`h-3.5 w-3.5 ${bateriaColor(data.dispositivo.bateriaPct)}`} />
                {data.dispositivo.bateriaPct}%
              </span>
            )}
            {data.dispositivo?.ultimaConexion && (
              <span className="text-muted">Última señal {hace(data.dispositivo.ultimaConexion)}</span>
            )}
            {data.dispositivo?.modelo && <span className="text-muted">· {data.dispositivo.modelo}</span>}
          </div>

          {/* Foto real de la cámara + dictamen de IA */}
          {data.foto ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setVerFoto(true)}
                className="group relative block w-full overflow-hidden rounded-md border border-border"
                title="Ver foto en grande"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.foto.url}
                  alt={`Cámara Space Eye de ${sitioNombre}`}
                  className="max-h-56 w-full object-cover transition-transform group-hover:scale-[1.02]"
                />
                <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                  <Camera className="h-3 w-3" /> {data.foto.tomadaEn ? hace(data.foto.tomadaEn) : 'foto'}
                </span>
              </button>
              <Veredicto foto={data.foto} />
            </div>
          ) : (
            <div className="rounded-md border border-border bg-surface-2 p-3 text-[12px] text-muted">
              La cámara está vinculada pero aún no ha subido fotos.
            </div>
          )}
        </div>
      )}

      {/* Lightbox de la foto real */}
      {data?.foto && (
        <Modal
          open={verFoto}
          onOpenChange={setVerFoto}
          size="xl"
          title="Cámara Space Eye"
          subtitle={`${sitioNombre}${data.foto.tomadaEn ? ` · ${new Date(data.foto.tomadaEn).toLocaleString('es-MX')}` : ''}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.foto.url}
            alt={`Cámara Space Eye de ${sitioNombre}`}
            className="w-full rounded border border-border object-contain"
          />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted">
            <Veredicto foto={data.foto} />
            {data.foto.gps && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {data.foto.gps.lat.toFixed(5)}, {data.foto.gps.lng.toFixed(5)}
              </span>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// Dictamen de IA de la foto: correcto / no coincide / sin verificar.
function Veredicto({ foto }: { foto: { esCorrecta: boolean | null; score: number | null; verificacionEstatus: string | null } }) {
  const pct = foto.score != null ? `${Math.round(foto.score * 100)}%` : null
  if (foto.esCorrecta === true) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0f7a55]">
        <CheckCircle2 className="h-3.5 w-3.5" /> Anuncio correcto{pct ? ` · confianza ${pct}` : ''}
      </span>
    )
  }
  if (foto.esCorrecta === false) {
    return (
      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-error">
        <XCircle className="h-3.5 w-3.5" /> No coincide con la creatividad{pct ? ` · ${pct}` : ''}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-muted">
      <CircleHelp className="h-3.5 w-3.5" /> Sin verificación IA aún
    </span>
  )
}

function bateriaColor(pct: number): string {
  if (pct >= 50) return 'text-[#10b981]'
  if (pct >= 20) return 'text-[#f59e0b]'
  return 'text-error'
}

// "hace 2 h", "hace 5 min", "hace 3 d". Aproximado, para telemetría.
function hace(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'hace segundos'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}
