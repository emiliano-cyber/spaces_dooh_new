'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, X, Inbox } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import { puedeAprobarEnCampana } from '@/lib/roles'
import { refrescarEstado } from '@/lib/data/estado-api'
import { formatFecha } from '@/lib/data/client'
import { formatNumero } from '@/lib/formato-numero'
import { resumirPublicacion, type ResumenPublicacion } from '@/lib/doohmain-resultado'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { ResultadoDoohmain } from './ValidacionPanel'

// ============================================================================
//  Los creativos que mandó el CLIENTE desde su liga (ENVIO-CLIENTE, 18/11).
// ----------------------------------------------------------------------------
//  Pedido del dueño: «solo mandar el archivo para que lo vean los usuarios
//  permitidos, y ellos al aprobarlo se apruebe automáticamente y ahora sí se
//  guarde y se suba el creativo a DOOHmain».
//
//  Lo ven SOLO Dueño y Administrador (`puedeAprobarEnCampana`, la regla de
//  ACT-CAMP sin cambiarla); para los demás no se pinta nada. El servidor exige
//  lo mismo en cada ruta, así que esconderlo aquí es comodidad, no la puerta.
//  Aprobar es un paso: el servidor crea el creativo YA aprobado, lo reparte en
//  las pantallas y lo publica por el camino de «Volver a publicar».
// ============================================================================

const API = '/spaces-dooh/api'

interface Envio {
  id: string
  nombreArchivo: string
  tamanoBytes: number
  anchoPx: number | null
  altoPx: number | null
  sitioNombre: string | null
  creadoEn: string | null
}

type Publicacion =
  | { tipo: 'imprenta' }
  | { tipo: 'sin-publicacion' }
  | { tipo: 'apagada' }
  | { tipo: 'publicada'; doohmain: unknown }
  | { tipo: 'fallo'; error: string }

const MENSAJE_PUBLICACION: Record<Publicacion['tipo'], ClaveTexto> = {
  imprenta: 'campanas.envios.aprobado.imprenta',
  'sin-publicacion': 'campanas.envios.aprobado.sin-publicacion',
  apagada: 'campanas.envios.aprobado.apagada',
  publicada: 'campanas.envios.aprobado.publicada',
  fallo: 'campanas.envios.aprobado.fallo',
}

export function EnviosClienteCampana({ campanaId }: { campanaId: string }) {
  const { sesion } = useSesionCtx()
  const puede = puedeAprobarEnCampana(sesion?.usuario?.rol)
  const { t, idioma } = useIdioma()
  const [envios, setEnvios] = useState<Envio[]>([])
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [rechazando, setRechazando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [resultado, setResultado] = useState<ResumenPublicacion | null>(null)

  const cargar = useCallback(async () => {
    if (!puede) return
    try {
      const r = await fetch(`${API}/campanas/${campanaId}/envios-cliente/`, { cache: 'no-store' })
      if (r.ok) setEnvios(await r.json())
    } catch {
      /* sin envíos que enseñar */
    }
  }, [campanaId, puede])

  useEffect(() => {
    void cargar()
  }, [cargar])

  if (!puede || envios.length === 0) return null

  async function decidir(id: string, cuerpo: Record<string, unknown>) {
    setOcupado(id)
    setResultado(null)
    try {
      const r = await fetch(`${API}/campanas/${campanaId}/envios-cliente/${id}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        toast.error(d?.error ?? t('campanas.envios.error'))
      } else if (cuerpo.accion === 'aprobar') {
        const pub = d?.publicacion as Publicacion | undefined
        const clave = pub ? MENSAJE_PUBLICACION[pub.tipo] : 'campanas.envios.aprobado.publicada'
        if (pub?.tipo === 'fallo') toast.warning(t(clave))
        else toast.success(t(clave))
        if (pub?.tipo === 'publicada') {
          setResultado(resumirPublicacion(pub.doohmain as Parameters<typeof resumirPublicacion>[0]))
        }
        await refrescarEstado().catch(() => {})
      } else {
        toast.success(t('campanas.envios.rechazado'))
        setRechazando(null)
        setMotivo('')
      }
    } catch {
      toast.error(t('campanas.envios.error'))
    }
    setOcupado(null)
    await cargar()
  }

  return (
    <section
      aria-labelledby={`envios-cliente-${campanaId}`}
      className="rounded-md border border-warning/40 bg-warning-soft p-4"
    >
      <h2 id={`envios-cliente-${campanaId}`} className="m-0 flex items-center gap-2 text-[15px] font-semibold text-ink">
        <Inbox className="h-4 w-4" /> {t('campanas.envios.titulo')}
        <span className="demo-num rounded-full border border-border bg-surface px-2 text-[12px]">{formatNumero(envios.length, 0, idioma)}</span>
      </h2>
      <p className="mt-1 text-[12px] text-muted">{t('campanas.envios.ayuda')}</p>
      <ul className="m-0 mt-3 list-none space-y-3 p-0">
        {envios.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start gap-3 rounded border border-border bg-surface p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API}/campanas/${campanaId}/envios-cliente/${e.id}/`}
              alt={e.nombreArchivo}
              className="h-24 w-32 shrink-0 rounded bg-surface-2 object-contain"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium text-ink">{e.nombreArchivo}</div>
              <div className="demo-num text-[12px] text-muted">
                {[
                  e.sitioNombre ? t('campanas.envios.para', { sitio: e.sitioNombre }) : null,
                  e.anchoPx && e.altoPx ? `${e.anchoPx} × ${e.altoPx} px` : null,
                  `${formatNumero(e.tamanoBytes / 1024 / 1024, 1, idioma)} MB`,
                  e.creadoEn ? formatFecha(e.creadoEn, idioma) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
              {rechazando === e.id ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={motivo}
                    maxLength={300}
                    onChange={(ev) => setMotivo(ev.target.value)}
                    placeholder={t('campanas.envios.motivo')}
                    aria-label={t('campanas.envios.motivo')}
                    className="h-8 w-full rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={ocupado === e.id}
                      onClick={() => decidir(e.id, { accion: 'rechazar', motivo: motivo.trim() || null })}
                    >
                      <X className="h-3.5 w-3.5" /> {t('campanas.envios.confirmar-rechazo')}
                    </Button>
                    <Button size="sm" variant="secondary" disabled={ocupado === e.id} onClick={() => setRechazando(null)}>
                      {t('comun.cancelar')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="success" disabled={ocupado === e.id} onClick={() => decidir(e.id, { accion: 'aprobar' })}>
                    <Check className="h-3.5 w-3.5" /> {t('campanas.envios.aprobar')}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={ocupado === e.id} onClick={() => setRechazando(e.id)}>
                    <X className="h-3.5 w-3.5" /> {t('campanas.envios.rechazar')}
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {resultado && (
        <div className="mt-3">
          <ResultadoDoohmain r={resultado} />
        </div>
      )}
    </section>
  )
}
