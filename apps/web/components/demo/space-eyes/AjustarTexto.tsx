'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Camera, CameraOff, Loader2, Move, Type } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { seApi, fotoSE, ErrorSE } from '@/lib/data/space-eyes-se'
import {
  MARCA_POR_OMISION,
  RANGOS,
  cuerpoMarca,
  estiloTextoMarca,
  giroFoto,
  limitar,
  marcaDeEquipo,
  mismaMarca,
  posicionCaja,
  renglonesMarca,
  type AlineacionMarca,
  type ConfigMarca,
  type EstiloMarca,
  type PesoMarca,
} from '@/lib/space-eyes-marca-editor'

// ============================================================================
//  Space Eyes — «Ajustar texto».
//
//  Cómo se ve la marca que Space Eye graba en cada foto de un equipo: su
//  nombre, la fecha y la hora. Se toma una foto de prueba bajo demanda (la
//  cámara NO dispara sola desde aquí), se acomoda la marca encima arrastrándola
//  y se guarda; se aplica a todas las fotos de ese equipo.
//
//  La vista previa es la marca final, no una aproximación: el recuadro tiene
//  la proporción de la foto (sin recortarla), la letra se mide en `cqw` con la
//  misma cuenta que el render (ancho / 42 · tamaño, piso de 12 px) y la caja se
//  mete a 6 px de los bordes igual que `_drawOverlay`. Ver
//  `lib/space-eyes-marca-editor.ts`.
//
//  Guardar y tomar la foto son escrituras: el BFF pide `inventario.crear`. Aquí
//  solo se refleja para no ofrecer un botón que va a contestar 403.
// ============================================================================

interface EquipoSE {
  id: number
  name: string
  online?: boolean | number
}

interface FotoRef {
  id: number
  url: string | null
  tomadaEn: string | null
  giro: 0 | 90 | 180 | 270
}

type Aviso = { tono: 'ok' | 'error'; texto: string } | null

const INTENTOS_FOTO = 15 // cada 2 s → ~30 s, lo mismo que el original

export function AjustarTexto() {
  const puedeEditar = usePuede('inventario', 'crear')

  const [equipos, setEquipos] = useState<EquipoSE[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string>('')
  const [cargandoEquipo, setCargandoEquipo] = useState(false)
  const [guardada, setGuardada] = useState<ConfigMarca>(MARCA_POR_OMISION)
  const [marca, setMarca] = useState<ConfigMarca>(MARCA_POR_OMISION)
  const [foto, setFoto] = useState<FotoRef | null>(null)
  const [capturando, setCapturando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  // Cada cambio de equipo invalida lo que estuviera en vuelo (la carga y la
  // espera de la foto): sin esto, la foto de un equipo acaba de referencia de otro.
  const turno = useRef(0)
  const encuesta = useRef<ReturnType<typeof setInterval> | null>(null)
  const temporizadorAviso = useRef<ReturnType<typeof setTimeout> | null>(null)

  const avisar = useCallback((tono: 'ok' | 'error', texto: string) => {
    setAviso({ tono, texto })
    if (temporizadorAviso.current) clearTimeout(temporizadorAviso.current)
    temporizadorAviso.current = setTimeout(() => setAviso(null), 3200)
  }, [])

  const pararEncuesta = useCallback(() => {
    if (encuesta.current) clearInterval(encuesta.current)
    encuesta.current = null
  }, [])

  useEffect(
    () => () => {
      pararEncuesta()
      if (temporizadorAviso.current) clearTimeout(temporizadorAviso.current)
    },
    [pararEncuesta],
  )

  const ultimaFoto = useCallback(async (id: string): Promise<FotoRef | null> => {
    const d = await seApi<{ photos?: Record<string, any>[] }>(`photos?device_id=${id}&limit=1`)
    const p = d?.photos?.[0]
    if (!p) return null
    return {
      id: Number(p.id),
      url: fotoSE(p.storage_path),
      tomadaEn: p.taken_at ?? null,
      giro: giroFoto(p.display_rotation),
    }
  }, [])

  // Al cambiar de equipo: su configuración guardada y su última foto de referencia.
  const cargarEquipo = useCallback(
    async (id: string) => {
      const mio = ++turno.current
      pararEncuesta()
      setCapturando(false)
      if (!id) return
      setCargandoEquipo(true)
      try {
        const [d, f] = await Promise.all([
          seApi<{ device?: Record<string, unknown> }>(`devices/${id}`),
          ultimaFoto(id).catch(() => null),
        ])
        if (mio !== turno.current) return
        const c = marcaDeEquipo(d?.device)
        setGuardada(c)
        setMarca(c)
        setFoto(f)
      } catch (e) {
        if (mio !== turno.current) return
        avisar('error', e instanceof Error ? e.message : 'No se pudo leer el equipo')
      }
      if (mio === turno.current) setCargandoEquipo(false)
    },
    [avisar, pararEncuesta, ultimaFoto],
  )

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const d = await seApi<{ devices?: EquipoSE[] }>('devices')
        if (!vivo) return
        const lista = d?.devices ?? []
        setEquipos(lista)
        if (!lista.length) return
        // ?equipo=ID abre directamente ese equipo (enlace desde la ficha).
        const pedido = new URLSearchParams(window.location.search).get('equipo')
        const elegido =
          lista.find((x) => String(x.id) === pedido) ?? lista.find((x) => !!x.online) ?? lista[0]
        setDeviceId(String(elegido.id))
        void cargarEquipo(String(elegido.id))
      } catch (e) {
        if (vivo) setError(e instanceof ErrorSE || e instanceof Error ? e.message : 'No se pudo consultar Space Eyes')
      }
    })()
    return () => {
      vivo = false
    }
  }, [cargarEquipo])

  const cambiarEquipo = (id: string) => {
    if (!mismaMarca(marca, guardada) && !window.confirm('Hay cambios sin guardar en la marca de este equipo. ¿Descartarlos?')) return
    setDeviceId(id)
    void cargarEquipo(id)
  }

  // Una foto bajo demanda: se manda la orden y se espera a que aparezca una
  // foto nueva del equipo (distinta de la última que había).
  const tomarFoto = async () => {
    if (capturando || !deviceId) return
    const id = deviceId
    const mio = turno.current
    setCapturando(true)
    try {
      const antes = (await ultimaFoto(id).catch(() => null))?.id ?? null
      await seApi(`devices/${id}/command`, { method: 'POST', body: { command_type: 'TAKE_PHOTO', priority: 1 } })
      let intentos = 0
      pararEncuesta()
      encuesta.current = setInterval(async () => {
        intentos++
        const f = await ultimaFoto(id).catch(() => null)
        if (mio !== turno.current) return pararEncuesta()
        if (f && f.id !== antes) {
          pararEncuesta()
          setFoto(f)
          setCapturando(false)
          avisar('ok', 'Fotografía capturada')
        } else if (intentos >= INTENTOS_FOTO) {
          pararEncuesta()
          setCapturando(false)
          avisar('error', 'No llegó la foto. ¿El equipo está en línea?')
        }
      }, 2000)
    } catch (e) {
      if (mio !== turno.current) return
      setCapturando(false)
      avisar('error', e instanceof ErrorSE && e.status === 403 ? 'No tienes permiso para tomar fotos' : 'No se pudo enviar la orden al equipo')
    }
  }

  const guardar = async () => {
    if (!puedeEditar || !deviceId) return
    setGuardando(true)
    try {
      await seApi(`devices/${deviceId}/overlay`, { method: 'PUT', body: cuerpoMarca(marca) })
      setGuardada(marca)
      avisar('ok', 'Configuración guardada y aplicada al equipo')
    } catch (e) {
      avisar('error', e instanceof ErrorSE && e.status === 403 ? 'No tienes permiso para cambiar la marca' : 'No se pudo guardar la configuración')
    }
    setGuardando(false)
  }

  const fijarEstilo = <K extends keyof EstiloMarca>(k: K, v: EstiloMarca[K]) =>
    setMarca((m) => ({ ...m, style: { ...m.style, [k]: v } }))

  const equipo = equipos?.find((x) => String(x.id) === deviceId) ?? null
  const renglones = useMemo(() => renglonesMarca(equipo?.name, foto?.tomadaEn), [equipo?.name, foto?.tomadaEn])
  const sucio = !mismaMarca(marca, guardada)

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      <Link href="/space-eyes" className="inline-flex items-center gap-1.5 text-[12px] text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" />
        Space Eyes
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink">
          <Type className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-ink">Ajustar texto de las fotos</h1>
          <p className="text-[13px] text-muted">
            Toma una fotografía de prueba y acomoda cómo se verá <b className="font-medium text-ink">nombre · fecha · hora</b>.
            Se aplica a todas las fotos del equipo.
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-[#dc262640] bg-error-soft p-3 text-[12px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
          <div>
            <div className="font-medium text-ink">No se pudo consultar Space Eyes</div>
            <div className="text-muted">{error}</div>
          </div>
        </div>
      ) : equipos && equipos.length === 0 ? (
        <div className="rounded-md border border-border bg-surface-2 px-3 py-10 text-center text-[13px] text-muted">
          Todavía no hay equipos Space Eyes dados de alta para esta cuenta.
        </div>
      ) : (
        <>
          {/* Equipo + foto de prueba */}
          <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3">
            <label className="block w-full min-w-0 sm:w-auto">
              <span className="text-[12px] text-muted">Equipo</span>
              <select
                value={deviceId}
                onChange={(e) => cambiarEquipo(e.target.value)}
                disabled={!equipos}
                className="mt-1 h-9 w-full max-w-full rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent sm:min-w-[240px]"
              >
                {!equipos && <option>Cargando…</option>}
                {(equipos ?? []).map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name}
                    {d.online ? '' : ' (sin reportar)'}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="primary"
              size="md"
              onClick={() => void tomarFoto()}
              disabled={capturando || !deviceId || !puedeEditar || cargandoEquipo}
            >
              {capturando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {capturando ? 'Capturando…' : 'Tomar fotografía'}
            </Button>
            <div className="flex min-w-0 flex-col gap-0.5 text-[12px]">
              {!foto && <span className="text-muted">La cámara solo captura al pulsar el botón.</span>}
              {capturando && <span className="text-muted">Esperando la foto del equipo (hasta 30 s)…</span>}
              {!puedeEditar && (
                <span className="text-warning">Solo quien puede editar inventario puede tomar la foto y guardar la marca.</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <VistaPrevia
                foto={foto}
                marca={marca}
                renglones={renglones}
                cargando={cargandoEquipo}
                editable={puedeEditar}
                onMover={(x, y) => setMarca((m) => ({ ...m, x, y }))}
              />
              {foto && puedeEditar && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
                  <Move className="h-3.5 w-3.5" />
                  Arrastra sobre la foto para mover la marca (o usa las flechas del teclado). Los cambios se ven al momento.
                </p>
              )}
              {foto?.tomadaEn && (
                <p className="mt-1 text-[12px] text-muted">La fecha y la hora de la vista previa son las de esta foto.</p>
              )}
            </div>

            <Controles
              marca={marca}
              deshabilitado={!puedeEditar || !deviceId}
              onEnabled={(v) => setMarca((m) => ({ ...m, enabled: v }))}
              fijar={fijarEstilo}
              pie={
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="demo-num text-[12px] text-muted">
                    x: {Math.round(marca.x)}% · y: {Math.round(marca.y)}%
                    {sucio && <span className="ml-2 text-warning">sin guardar</span>}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setMarca(guardada)} disabled={!sucio || guardando}>
                      Descartar
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => void guardar()} disabled={!puedeEditar || !deviceId || guardando}>
                      {guardando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Guardar configuración
                    </Button>
                  </div>
                </div>
              }
            />
          </div>
        </>
      )}

      <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-50">
        {aviso && (
          <div
            role="status"
            className={cn(
              'rounded-md border px-4 py-2.5 text-[13px] text-ink shadow-sm',
              aviso.tono === 'ok' ? 'border-[#1da85040] bg-success-soft' : 'border-[#dc262640] bg-error-soft',
            )}
          >
            {aviso.texto}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── La foto con la marca encima ─────────────────────────────────────────────
function VistaPrevia({
  foto,
  marca,
  renglones,
  cargando,
  editable,
  onMover,
}: {
  foto: FotoRef | null
  marca: ConfigMarca
  renglones: string[]
  cargando: boolean
  editable: boolean
  onMover: (x: number, y: number) => void
}) {
  const recuadroRef = useRef<HTMLDivElement>(null)
  const marcaRef = useRef<HTMLDivElement>(null)
  const arrastrando = useRef(false)
  // Tamaño real de la foto YA enderezada: da la proporción del recuadro y el
  // piso de 12 px de la letra.
  const [medidaFoto, setMedidaFoto] = useState<{ url: string; w: number; h: number } | null>(null)
  const real = medidaFoto && medidaFoto.url === foto?.url ? medidaFoto : null
  const [medidas, setMedidas] = useState<{ caja: { w: number; h: number }; recuadro: { w: number; h: number } } | null>(null)

  const girada = foto?.giro === 90 || foto?.giro === 270
  const proporcion = real ? real.w / real.h : 4 / 3
  const conMarca = !!foto?.url && marca.enabled

  // Medir la caja y el recuadro para meter la marca en los bordes como el render.
  useLayoutEffect(() => {
    const r = recuadroRef.current
    const m = marcaRef.current
    if (!r || !m) return
    const medir = () =>
      setMedidas((prev) => {
        const sig = { caja: { w: m.offsetWidth, h: m.offsetHeight }, recuadro: { w: r.clientWidth, h: r.clientHeight } }
        return prev && JSON.stringify(prev) === JSON.stringify(sig) ? prev : sig
      })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(r)
    ro.observe(m)
    return () => ro.disconnect()
  }, [conMarca, real?.w, real?.h])

  const moverA = (clientX: number, clientY: number) => {
    const box = recuadroRef.current?.getBoundingClientRect()
    if (!box || !box.width || !box.height) return
    onMover(
      limitar(((clientX - box.left) / box.width) * 100, 0, 100),
      limitar(((clientY - box.top) / box.height) * 100, 0, 100),
    )
  }

  const activo = editable && !!foto?.url

  const pos =
    medidas && medidas.recuadro.w > 0
      ? posicionCaja(marca.x, marca.y, medidas.caja, medidas.recuadro, real?.w)
      : null

  return (
    <div className="flex justify-center">
      <div
        ref={recuadroRef}
        role={activo ? 'application' : undefined}
        aria-label={activo ? 'Posición de la marca: arrastra o usa las flechas' : undefined}
        tabIndex={activo ? 0 : undefined}
        className={cn(
          'relative w-full select-none overflow-hidden rounded-md border border-border bg-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-accent',
          activo && 'cursor-move touch-none',
        )}
        style={{
          aspectRatio: String(proporcion),
          maxWidth: `calc(70vh * ${proporcion})`,
          containerType: 'inline-size',
        }}
        onPointerDown={(e) => {
          if (!activo) return
          arrastrando.current = true
          e.currentTarget.setPointerCapture(e.pointerId)
          moverA(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => {
          if (arrastrando.current) moverA(e.clientX, e.clientY)
        }}
        onPointerUp={() => {
          arrastrando.current = false
        }}
        onPointerCancel={() => {
          arrastrando.current = false
        }}
        onKeyDown={(e) => {
          if (!activo) return
          const paso = e.shiftKey ? 5 : 1
          const d = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[e.key]
          if (!d) return
          e.preventDefault()
          onMover(limitar(marca.x + d[0], 0, 100), limitar(marca.y + d[1], 0, 100))
        }}
      >
        {foto?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto.url}
            alt="Foto de referencia del equipo"
            draggable={false}
            onLoad={(e) => {
              const i = e.currentTarget
              const url = foto.url as string
              setMedidaFoto(
                girada ? { url, w: i.naturalHeight, h: i.naturalWidth } : { url, w: i.naturalWidth, h: i.naturalHeight },
              )
            }}
            className="pointer-events-none absolute max-w-none"
            style={
              girada
                ? {
                    left: '50%',
                    top: '50%',
                    width: `${100 / proporcion}cqw`,
                    height: `${100}cqw`,
                    transform: `translate(-50%, -50%) rotate(${foto.giro}deg)`,
                  }
                : { inset: 0, width: '100%', height: '100%', transform: foto.giro ? `rotate(${foto.giro}deg)` : undefined }
            }
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px] text-muted">
            {cargando ? <Loader2 className="h-6 w-6 animate-spin" /> : <CameraOff className="h-8 w-8" strokeWidth={1.4} />}
            {cargando ? 'Cargando…' : 'Toma una fotografía para previsualizar'}
          </div>
        )}

        {conMarca && (
          <div
            ref={marcaRef}
            aria-hidden
            className="pointer-events-none absolute"
            style={{
              ...estiloTextoMarca(marca.style, real?.w),
              width: 'max-content',
              ...(pos
                ? { left: pos.left, top: pos.top }
                : { left: `${marca.x}%`, top: `${marca.y}%`, transform: 'translate(-50%, -50%)' }),
            }}
          >
            {renglones.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}

        {foto?.url && !marca.enabled && (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[10.5px] font-semibold text-white">
            Marca desactivada
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Los controles ───────────────────────────────────────────────────────────
function Controles({
  marca,
  deshabilitado,
  onEnabled,
  fijar,
  pie,
}: {
  marca: ConfigMarca
  deshabilitado: boolean
  onEnabled: (v: boolean) => void
  fijar: <K extends keyof EstiloMarca>(k: K, v: EstiloMarca[K]) => void
  pie: React.ReactNode
}) {
  const s = marca.style
  return (
    <div className="space-y-4 rounded-md border border-border bg-surface p-4 text-[13px]">
      <fieldset disabled={deshabilitado} className={cn('space-y-4', deshabilitado && 'opacity-60')}>
        <Interruptor etiqueta="Mostrar marca" valor={marca.enabled} onChange={onEnabled} fuerte />

        <Deslizador
          etiqueta="Tamaño"
          valor={s.size}
          decimales={1}
          rango={RANGOS.size}
          onChange={(v) => fijar('size', v)}
        />

        <Campo etiqueta="Peso de la fuente">
          <Segmentado<PesoMarca>
            valor={s.weight}
            opciones={[
              ['normal', 'Normal'],
              ['bold', 'Negrita'],
            ]}
            onChange={(v) => fijar('weight', v)}
          />
        </Campo>

        <Campo etiqueta="Color del texto">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={s.color}
              onChange={(e) => fijar('color', e.target.value)}
              aria-label="Color del texto"
              className="h-9 w-14 cursor-pointer rounded border border-border-strong bg-surface p-0.5"
            />
            <span className="demo-num text-[12px] uppercase text-muted">{s.color}</span>
          </div>
        </Campo>

        <Campo etiqueta="Alineación">
          <Segmentado<AlineacionMarca>
            valor={s.align}
            opciones={[
              ['left', 'Izquierda'],
              ['center', 'Centro'],
              ['right', 'Derecha'],
            ]}
            onChange={(v) => fijar('align', v)}
          />
        </Campo>

        <Deslizador
          etiqueta="Espaciado entre líneas"
          valor={s.lineSpacing}
          decimales={1}
          rango={RANGOS.lineSpacing}
          onChange={(v) => fijar('lineSpacing', v)}
        />
        <Deslizador
          etiqueta="Espaciado entre letras"
          valor={s.letterSpacing}
          decimales={2}
          rango={RANGOS.letterSpacing}
          onChange={(v) => fijar('letterSpacing', v)}
        />

        <Interruptor etiqueta="Sombra" valor={s.shadow} onChange={(v) => fijar('shadow', v)} />
        <Interruptor etiqueta="Fondo semitransparente" valor={s.bg} onChange={(v) => fijar('bg', v)} />
      </fieldset>
      {pie}
    </div>
  )
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[12px] text-muted">{etiqueta}</div>
      {children}
    </div>
  )
}

function Deslizador({
  etiqueta,
  valor,
  decimales,
  rango,
  onChange,
}: {
  etiqueta: string
  valor: number
  decimales: number
  rango: { min: number; max: number; step: number }
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[12px] text-muted">
        {etiqueta}
        <span className="demo-num text-ink">{Number(valor).toFixed(decimales)}</span>
      </span>
      <input
        type="range"
        min={rango.min}
        max={rango.max}
        step={rango.step}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--accent)]"
      />
    </label>
  )
}

function Interruptor({
  etiqueta,
  valor,
  onChange,
  fuerte = false,
}: {
  etiqueta: string
  valor: boolean
  onChange: (v: boolean) => void
  fuerte?: boolean
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className={cn('text-ink', fuerte && 'font-medium')}>{etiqueta}</span>
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
      />
    </label>
  )
}

function Segmentado<T extends string>({
  valor,
  opciones,
  onChange,
}: {
  valor: T
  opciones: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex w-full rounded-md border border-border bg-surface p-0.5" role="radiogroup">
      {opciones.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          onClick={() => onChange(v)}
          className={cn(
            'flex-1 rounded px-2 py-1.5 transition-colors duration-150',
            valor === v ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}
