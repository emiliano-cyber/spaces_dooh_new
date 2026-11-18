'use client'

// ============================================================================
//  SubirCreativoCliente — «Envía tu creativo» en la liga pública (`/p/[id]`).
// ----------------------------------------------------------------------------
//  ENVIO-CLIENTE (pedido del dueño, 18/11). El cliente manda su arte desde la
//  liga; NO se vuelve creativo hasta que un Dueño o Administrador lo aprueba en
//  la ficha de la campaña. Por eso aquí no hay, ni puede haber, ninguna acción
//  de aprobar: solo enviar y ver en qué quedó lo enviado.
//
//  Reglas que no son de estilo:
//  · Se ofrece solo si el servidor dice `puedeSubirCreativo` (mientras la
//    campaña no esté al aire). El servidor lo vuelve a comprobar al recibir.
//  · Con varias pantallas, el cliente elige a cuál va, y se le dice la
//    proporción y la medida de esa pantalla, y si su imagen se recortará.
//  · De lo enviado solo se enseña el nombre, el estatus y el motivo de un
//    rechazo (que el equipo escribió PARA el cliente). Nada interno.
// ============================================================================

import { useRef, useState } from 'react'
import { Upload, AlertTriangle, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { useIdioma } from '@/lib/i18n/contexto'
import { formatFecha } from '@/lib/data/client'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import type { Seguimiento } from '@/lib/seguimiento-campana'
import { ENVIO_MAX_MB, TIPOS_ENVIO, orientacionDePantalla, type EnvioParaCliente } from '@/lib/envio-creativo-cliente'
import { ajusteEnMarco, proporcion, proporcionDeResolucion } from '@/lib/proporcion-pantalla'

type Elegido = { nombre: string; dataUrl: string; ancho: number | null; alto: number | null }

// El servidor contesta en español; la liga habla el idioma del navegador del
// cliente. Se traduce por el STATUS, que es lo que no cambia.
const ERROR_POR_STATUS: Record<number, ClaveTexto> = {
  400: 'cuenta.seguimiento.subir.error.tipo',
  409: 'cuenta.seguimiento.subir.error.cerrada',
  413: 'cuenta.seguimiento.subir.supera',
  422: 'cuenta.seguimiento.subir.error.tipo',
  429: 'cuenta.seguimiento.subir.error.limite',
}

function medirImagen(dataUrl: string): Promise<{ ancho: number | null; alto: number | null }> {
  return new Promise((ok) => {
    const im = new Image()
    im.onload = () => ok({ ancho: im.naturalWidth || null, alto: im.naturalHeight || null })
    im.onerror = () => ok({ ancho: null, alto: null })
    im.src = dataUrl
  })
}

export function SubirCreativoCliente({ s, urlEnvio }: { s: Seguimiento; urlEnvio?: string }) {
  const { t, idioma } = useIdioma()
  const fileRef = useRef<HTMLInputElement>(null)
  const [sitioId, setSitioId] = useState<string>(s.pantallas.length === 1 ? s.pantallas[0].id : '')
  const [elegido, setElegido] = useState<Elegido | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null)
  // Lo enviado en ESTA visita se suma arriba sin volver a pedir el seguimiento.
  const [propios, setPropios] = useState<EnvioParaCliente[]>([])

  const envios = [...propios, ...s.envios]
  const puedeSubir = s.puedeSubirCreativo && !!urlEnvio
  if (!puedeSubir && envios.length === 0) return null

  const pantalla = s.pantallas.find((p) => p.id === sitioId) ?? null
  const orientacion = pantalla ? orientacionDePantalla(pantalla) : null
  // ¿La imagen elegida cae bien en la pantalla elegida? Mismo cálculo que la
  // vista de Imprenta (`ajusteEnMarco`), dicho en una línea.
  const marco = pantalla ? (proporcionDeResolucion(pantalla.resolucionPx) ?? proporcion(pantalla.ancho, pantalla.alto)) : null
  const arte = elegido ? proporcion(elegido.ancho, elegido.alto) : null
  const recorta = marco != null && arte != null && ajusteEnMarco(marco, arte).tipo === 'recorta'
  const usaCreativo = s.tipo === 'DOOH' || s.tipo === 'HIBRIDA'

  function onArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    setAviso(null)
    if (!f) return
    if (f.size > ENVIO_MAX_MB * 1024 * 1024) {
      setAviso({ ok: false, texto: t('cuenta.seguimiento.subir.supera', { mb: ENVIO_MAX_MB }) })
      return
    }
    if (!(TIPOS_ENVIO as readonly string[]).includes(f.type)) {
      setAviso({ ok: false, texto: t('cuenta.seguimiento.subir.error.tipo') })
      return
    }
    const lector = new FileReader()
    lector.onload = async () => {
      const dataUrl = String(lector.result ?? '')
      const m = await medirImagen(dataUrl)
      setElegido({ nombre: f.name, dataUrl, ...m })
    }
    lector.readAsDataURL(f)
  }

  async function enviar() {
    if (!elegido || !urlEnvio) return
    setEnviando(true)
    setAviso(null)
    try {
      const r = await fetch(urlEnvio, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivo: elegido.dataUrl,
          nombre: elegido.nombre,
          sitioId: sitioId || null,
          ancho: elegido.ancho,
          alto: elegido.alto,
        }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) {
        const clave = ERROR_POR_STATUS[r.status] ?? 'cuenta.seguimiento.subir.error.generico'
        setAviso({ ok: false, texto: t(clave, { mb: ENVIO_MAX_MB }) })
      } else {
        const nombre = String(d?.nombre ?? elegido.nombre)
        setPropios((xs) => [
          { nombre, estatus: 'PENDIENTE', motivo: null, creadoEn: new Date().toISOString(), sitioNombre: pantalla?.nombre ?? null },
          ...xs,
        ])
        setAviso({ ok: true, texto: t('cuenta.seguimiento.subir.enviado', { nombre }) })
        setElegido(null)
      }
    } catch {
      setAviso({ ok: false, texto: t('cuenta.seguimiento.subir.error.generico') })
    }
    setEnviando(false)
  }

  const faltaSitio = s.pantallas.length > 1 && !sitioId

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('cuenta.seguimiento.subir.titulo')}</CardTitle>
        {puedeSubir && (
          <p className="mt-0.5 text-[12px] text-muted">{t('cuenta.seguimiento.subir.ayuda', { mb: ENVIO_MAX_MB })}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {puedeSubir && (
          <div className="space-y-3">
            {s.pantallas.length > 1 && (
              <label className="block text-[13px] text-ink">
                <span className="mb-1 block font-medium">{t('cuenta.seguimiento.subir.sitio')}</span>
                <select
                  value={sitioId}
                  onChange={(e) => setSitioId(e.target.value)}
                  className="h-10 w-full rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">{t('cuenta.seguimiento.subir.elegir')}</option>
                  {s.pantallas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {orientacion && (
              <p className="demo-num text-[12px] text-muted">
                {t('cuenta.seguimiento.subir.medida', { proporcion: orientacion.proporcion, medida: orientacion.medida })}
              </p>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={TIPOS_ENVIO.join(',')}
              className="hidden"
              onChange={onArchivo}
            />
            {elegido ? (
              <div className="flex items-start gap-3 rounded border border-border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={elegido.dataUrl} alt={elegido.nombre} className="h-16 w-16 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-ink">{elegido.nombre}</div>
                  {elegido.ancho && elegido.alto ? (
                    <div className="demo-num text-[11px] text-muted">{`${elegido.ancho} × ${elegido.alto} px`}</div>
                  ) : null}
                  {recorta && (
                    <div className="mt-1 flex items-start gap-1 text-[12px] text-[#9a6700]">
                      <AlertTriangle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {t('cuenta.seguimiento.subir.recorta')}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {!elegido ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-4 text-[14px] font-medium text-accent-fg"
                >
                  <Upload aria-hidden="true" className="h-4 w-4" /> {t('cuenta.seguimiento.subir.boton')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={enviando || faltaSitio}
                    onClick={enviar}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-4 text-[14px] font-medium text-accent-fg disabled:opacity-50"
                  >
                    <Upload aria-hidden="true" className="h-4 w-4" />
                    {enviando ? t('cuenta.seguimiento.subir.enviando') : t('cuenta.seguimiento.subir.boton')}
                  </button>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => setElegido(null)}
                    className="inline-flex min-h-[44px] items-center rounded-md border border-border px-4 text-[14px] text-ink"
                  >
                    {t('comun.cancelar')}
                  </button>
                </>
              )}
            </div>
            <p className="text-[12px] text-muted">
              {t(usaCreativo ? 'cuenta.seguimiento.subir.despues.dooh' : 'cuenta.seguimiento.subir.despues.ooh')}
            </p>
          </div>
        )}

        {aviso && (
          <p role="status" className={`text-[13px] ${aviso.ok ? 'text-[#0f7a55]' : 'text-[#9a6700]'}`}>
            {aviso.ok ? <Check aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" /> : null}
            {aviso.texto}
          </p>
        )}

        {envios.length > 0 && (
          <div>
            <div className="mb-1 text-[12px] font-medium text-ink">{t('cuenta.seguimiento.subir.enviados')}</div>
            <ul className="divide-y divide-border">
              {envios.map((e, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] text-ink">{e.nombre}</div>
                    <div className="text-[11px] text-muted">
                      {[e.sitioNombre, e.creadoEn ? formatFecha(e.creadoEn, idioma) : null].filter(Boolean).join(' · ')}
                    </div>
                    {e.estatus === 'RECHAZADO' && e.motivo && (
                      <div className="mt-0.5 text-[12px] text-[#9a6700]">{t('cuenta.seguimiento.subir.motivo', { motivo: e.motivo })}</div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                      e.estatus === 'RECHAZADO'
                        ? 'border-[#f59e0b40] bg-[#f59e0b1a] text-[#9a6700]'
                        : 'border-border bg-surface-2 text-muted'
                    }`}
                  >
                    {e.estatus === 'RECHAZADO'
                      ? t('cuenta.seguimiento.subir.rechazado')
                      : t('cuenta.seguimiento.creativos.estatus.pendiente')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
