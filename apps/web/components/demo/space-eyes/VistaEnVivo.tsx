'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Camera,
  Check,
  Eye,
  Loader2,
  Lock,
  Move,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Sun,
  VideoOff,
  ZoomIn,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { seApi, ErrorSE } from '@/lib/data/space-eyes-se'
import { VisorWhep } from '@/lib/space-eyes-whep'

// ============================================================================
//  Space Eyes — vista en vivo de un equipo.
//
//  Es la pestaña «En vivo» de la ficha de Space Eye (device-detail.html/.js):
//  iniciar y detener, corte solo a los 3 minutos, disparador sobre el video y
//  la barra de controles de cámara encima de la imagen.
//
//  EL VIDEO va siempre por el servidor de medios de Space Eye (WHEP). El punto
//  a punto de los teléfonos viejos necesita el socket de Space Eye, al que este
//  navegador no llega: en ese caso se dice y no se intenta.
//
//  DOS FAMILIAS DE CONTROLES, igual que en el original:
//  · Teléfonos: zoom, exposición, balance y enfoque viajan EN VIVO al equipo
//    (camera-control). Son temporales hasta «Fijar encuadre».
//  · Raspberry y PC (relay): la cámara fija el recorte al arrancar, así que los
//    deslizadores solo mueven una vista previa en el navegador y «Fijar
//    encuadre» guarda y reabre la vista para traer la imagen nítida.
// ============================================================================

const DURACION_S = 180
// Margen para confirmar que de verdad llega imagen (el recuadro negro).
const REVISION_MS = 12_000
// Respiro para que la cámara se suelte antes de reabrir (probado en Space Eye).
const RESPIRO_REABRIR_MS = 1_200
const RETARDO_CONTROL_MS = 150

export interface VistaEnVivoProps {
  equipo: { id: number; nombre: string; appVersion?: string | null; online: boolean }
  puedeOperar: boolean
  /** Se pidió una foto con el disparador: la ficha puede ponerse a esperarla. */
  onFoto?: () => void
  /** Dentro del marco de Fotos de la ficha: sin borde propio y del mismo tamaño que la foto. */
  embebida?: boolean
}

type Ajustes = Record<string, unknown> & {
  centro_x?: number
  centro_y?: number
  brillo?: number
  enfoque_fijo?: boolean
  enfoque_x?: number
  enfoque_y?: number
}

interface DispositivoSE {
  app_version?: string | null
  camera_lens?: string | null
  camera_zoom?: number | string | null
  camera_ajustes?: string | Ajustes | null
  stream_rotation?: number | string | null
  vivo_por_servidor?: boolean
}

type Estado = 'apagado' | 'conectando' | 'vivo'
type Lente = 'main' | 'wide'
type Balance = 'auto' | 'daylight' | 'cloudy' | 'incandescent' | 'fluorescent'

const BALANCES: { valor: Balance; texto: string }[] = [
  { valor: 'auto', texto: 'Balance auto' },
  { valor: 'daylight', texto: 'Luz de día' },
  { valor: 'cloudy', texto: 'Nublado' },
  { valor: 'incandescent', texto: 'Incandescente' },
  { valor: 'fluorescent', texto: 'Fluorescente' },
]

const num = (v: unknown, def: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}
const giro = (v: unknown) => ((Math.round(num(v, 0) / 90) * 90) % 360 + 360) % 360
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

// PC con el agente 1.0.x: anterior a la vista en vivo.
function agenteSinVivo(version: string): boolean {
  const m = /^pc-agent\s*v?(\d+)\.(\d+)/i.exec(version)
  if (!m) return false
  const mayor = Number(m[1])
  return mayor < 1 || (mayor === 1 && Number(m[2]) < 1)
}

function leerAjustes(v: DispositivoSE['camera_ajustes']): Ajustes {
  try {
    const a = typeof v === 'string' ? JSON.parse(v || 'null') : v
    return a && typeof a === 'object' ? { ...a } : {}
  } catch {
    return {}
  }
}

// Lo que se manda al guardar: lo mismo que _cuerpoAjustes del original. Las
// ganancias de blanco van las dos o ninguna, y el obturador solo si es manual.
function cuerpoAjustes(a: Ajustes): Ajustes | null {
  const c: Ajustes = { ...a }
  if (c.awb_rojo == null || c.awb_azul == null) {
    delete c.awb_rojo
    delete c.awb_azul
  }
  if (!(Number(c.obturador) > 0)) {
    delete c.obturador
    delete c.ganancia
  }
  Object.keys(c).forEach((k) => {
    if (c[k] === null || c[k] === undefined) delete c[k]
  })
  return Object.keys(c).length ? c : null
}

function motivoDe(e: unknown, porDefecto: string): string {
  if (e instanceof ErrorSE) {
    if (e.status === 403) return 'No tienes permiso para cambiar este equipo'
    const cuerpo = e.cuerpo as { error?: string } | null
    if (cuerpo?.error === 'servidor_de_medios_no_configurado') {
      return 'El servidor de video no está configurado. Es cosa del servidor, no del equipo.'
    }
  }
  return e instanceof Error && e.message ? e.message : porDefecto
}

export function VistaEnVivo({ equipo, puedeOperar, onFoto, embebida = false }: VistaEnVivoProps) {
  const id = equipo.id
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const clienteRef = useRef<VisorWhep | null>(null)
  // Número del visor vigente: las devoluciones de un visor viejo (que muere al
  // reencuadrar) no deben tumbar al recién abierto.
  const turnoRef = useRef(0)
  const iniciandoRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const [dispositivo, setDispositivo] = useState<DispositivoSE | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [estado, setEstado] = useState<Estado>('apagado')
  const [error, setError] = useState('')
  const [ocupada, setOcupada] = useState<{ con: string; minutos: number } | null>(null)
  const [restante, setRestante] = useState(0)
  const [reencuadrando, setReencuadrando] = useState(false)
  const [tomandoFoto, setTomandoFoto] = useState(false)

  // Encuadre: lo que se está moviendo y lo guardado en el equipo.
  const [lente, setLente] = useState<Lente>('main')
  const [zoom, setZoom] = useState(0)
  const [ajustes, setAjustes] = useState<Ajustes>({})
  const [guardado, setGuardado] = useState({ lente: 'main' as Lente, zoom: 0, cx: 0.5, cy: 0.5, brillo: 0 })
  // Con qué encuadre salió ESTA transmisión: contra eso se calcula la vista previa.
  const [enStream, setEnStream] = useState({ zoom: 0, cx: 0.5, cy: 0.5, brillo: 0 })
  // Solo en vivo (teléfonos), como en el original: no se guardan.
  const [exposicion, setExposicion] = useState(0)
  const [balance, setBalance] = useState<Balance>('auto')
  const [enfoqueFijo, setEnfoqueFijo] = useState(false)
  const [rotacion, setRotacion] = useState(0)
  const [rotacionGuardada, setRotacionGuardada] = useState(0)

  const version = String(dispositivo?.app_version ?? equipo.appVersion ?? '')
  const esRelay = /^(pi|pc)-agent/i.test(version)
  const porServidor = dispositivo?.vivo_por_servidor === true || esRelay
  const sinVivo = agenteSinVivo(version)
  const vivo = estado === 'vivo'

  // ─── Cargar el encuadre guardado ─────────────────────────────────────────
  useEffect(() => {
    let vigente = true
    seApi<{ device: DispositivoSE }>(`devices/${id}`)
      .then((r) => {
        if (!vigente) return
        const d = r.device
        setDispositivo(d)
        const l: Lente = d.camera_lens === 'wide' ? 'wide' : 'main'
        const z = num(d.camera_zoom, 0)
        const a = leerAjustes(d.camera_ajustes)
        const rot = giro(d.stream_rotation)
        setLente(l)
        setZoom(z)
        setAjustes(a)
        setGuardado({ lente: l, zoom: z, cx: num(a.centro_x, 0.5), cy: num(a.centro_y, 0.5), brillo: num(a.brillo, 0) })
        setEnfoqueFijo(a.enfoque_fijo === true)
        setRotacion(rot)
        setRotacionGuardada(rot)
      })
      .catch((e) => vigente && setErrorCarga(motivoDe(e, 'No se pudo leer el equipo')))
    return () => {
      vigente = false
    }
  }, [id])

  // ─── Control en vivo (teléfonos) ─────────────────────────────────────────
  const control = useCallback(
    (c: { action: string; value?: number | string; x?: number; y?: number }) => {
      if (!clienteRef.current) return
      seApi(`devices/${id}/camera-control`, { method: 'POST', body: c }).catch(() => {
        /* sin control la imagen sigue; no se interrumpe a nadie con un aviso */
      })
    },
    [id],
  )
  const controlDiferido = useCallback(
    (clave: string, c: { action: string; value?: number | string }) => {
      clearTimeout(debounceRef.current[clave])
      debounceRef.current[clave] = setTimeout(() => control(c), RETARDO_CONTROL_MS)
    },
    [control],
  )

  // Lo último que se puso, para re-aplicarlo cuando la cámara ya esté lista.
  const vivoRef = useRef({ zoom, exposicion, balance, enfoqueFijo, ajustes })
  vivoRef.current = { zoom, exposicion, balance, enfoqueFijo, ajustes }
  const guardadoRef = useRef(guardado)
  guardadoRef.current = guardado

  const limpiarTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
  }

  // ─── Detener ─────────────────────────────────────────────────────────────
  const detener = useCallback(async (forzar = false) => {
    turnoRef.current++
    limpiarTimers()
    const c = clienteRef.current
    clienteRef.current = null
    setEstado('apagado')
    setRestante(0)
    await c?.detener(forzar)
  }, [])

  // ─── Iniciar ─────────────────────────────────────────────────────────────
  const iniciar = useCallback(
    async (opciones: { reabriendo?: boolean } = {}) => {
      if (iniciandoRef.current || !videoRef.current) return
      iniciandoRef.current = true
      setError('')
      setOcupada(null)
      if (!opciones.reabriendo) setEstado('conectando')
      const miTurno = ++turnoRef.current
      const esVigente = () => turnoRef.current === miTurno

      const perdida = (motivo: string) => {
        if (!esVigente()) return
        void detener().then(() => {
          setError(motivo)
          toast.error(motivo)
        })
      }
      const cliente = new VisorWhep(id, videoRef.current, perdida)
      clienteRef.current = cliente
      try {
        await cliente.iniciar()
      } catch (e) {
        if (!esVigente()) return
        clienteRef.current = null
        await cliente.detener()
        setEstado('apagado')
        const cuerpo = e instanceof ErrorSE ? (e.cuerpo as { error?: string; con?: string; minutos?: number } | null) : null
        if (e instanceof ErrorSE && e.status === 409 && cuerpo?.error === 'vista_ocupada') {
          setOcupada({ con: cuerpo.con || 'otra persona', minutos: Number(cuerpo.minutos) || 1 })
          return
        }
        const motivo = motivoDe(e, 'No se pudo iniciar la transmisión.')
        setError(motivo)
        toast.error(motivo)
        return
      } finally {
        iniciandoRef.current = false
      }
      if (!esVigente()) return

      const a = vivoRef.current.ajustes
      setEnStream({
        zoom: guardadoRef.current.zoom,
        brillo: guardadoRef.current.brillo,
        cx: num(a.centro_x, 0.5),
        cy: num(a.centro_y, 0.5),
      })
      setEstado('vivo')
      if (cliente.compartida && !opciones.reabriendo) {
        toast.info(`Viendo la transmisión que abrió ${cliente.compartidaCon ?? 'otra persona'}`)
      }

      // Corte a los 3 minutos: una vista olvidada no sigue gastando datos.
      const fin = Date.now() + DURACION_S * 1000
      setRestante(DURACION_S)
      const tic = setInterval(() => {
        if (!esVigente()) return clearInterval(tic)
        const s = Math.max(0, Math.round((fin - Date.now()) / 1000))
        setRestante(s)
        if (s <= 0) {
          clearInterval(tic)
          void detener().then(() => toast.info('Transmisión detenida automáticamente a los 3 minutos'))
        }
      }, 1000)
      timersRef.current.push(tic as unknown as ReturnType<typeof setTimeout>)

      // Conectado pero sin imagen: el caso que se veía como recuadro negro.
      timersRef.current.push(
        setTimeout(async () => {
          if (!esVigente()) return
          const bytes = await cliente.bytesRecibidos()
          if (bytes === 0) perdida('Conectado con el servidor pero no está llegando imagen del equipo.')
        }, REVISION_MS),
      )

      // Re-aplicar los ajustes en vivo cuando la cámara ya esté lista.
      if (!esRelay) {
        timersRef.current.push(
          setTimeout(() => {
            if (!esVigente()) return
            const v = vivoRef.current
            if (v.zoom > 0) control({ action: 'zoom', value: v.zoom })
            if (v.exposicion !== 0) control({ action: 'exposure', value: v.exposicion })
            if (v.balance !== 'auto') control({ action: 'wb', value: v.balance })
            if (v.enfoqueFijo) {
              control({ action: 'lock_focus', x: num(v.ajustes.enfoque_x, 0.5), y: num(v.ajustes.enfoque_y, 0.5) })
            }
          }, 1500),
        )
      }
    },
    [id, detener, control, esRelay],
  )

  // ─── Salir de la página: que el equipo no siga transmitiendo solo ────────
  useEffect(() => {
    const alSalir = () => {
      turnoRef.current++
      clienteRef.current?.detenerAlSalir()
      clienteRef.current = null
    }
    window.addEventListener('pagehide', alSalir)
    window.addEventListener('beforeunload', alSalir)
    const debounces = debounceRef.current
    return () => {
      window.removeEventListener('pagehide', alSalir)
      window.removeEventListener('beforeunload', alSalir)
      Object.values(debounces).forEach((t) => clearTimeout(t))
      timersRef.current.forEach((t) => clearTimeout(t))
      timersRef.current = []
      alSalir()
    }
  }, [])

  // ─── Encuadre ────────────────────────────────────────────────────────────
  const cambioRecorte =
    Math.abs(zoom - guardado.zoom) > 0.001 ||
    Math.abs(num(ajustes.centro_x, 0.5) - guardado.cx) > 0.001 ||
    Math.abs(num(ajustes.centro_y, 0.5) - guardado.cy) > 0.001 ||
    Math.abs(num(ajustes.brillo, 0) - guardado.brillo) > 0.001
  const cambioLente = lente !== guardado.lente
  const encuadreCambiado = cambioLente || cambioRecorte

  const moverAjuste = (campo: 'centro_x' | 'centro_y' | 'brillo', valor: number) =>
    setAjustes((a) => ({ ...a, [campo]: valor }))

  const moverZoom = (v: number) => {
    setZoom(v)
    if (!esRelay && vivo) controlDiferido('zoom', { action: 'zoom', value: v })
  }

  const descartarEncuadre = () => {
    setZoom(guardado.zoom)
    setLente(guardado.lente)
    setAjustes((a) => ({ ...a, centro_x: guardado.cx, centro_y: guardado.cy, brillo: guardado.brillo }))
    // En los teléfonos el zoom ya viajó a la cámara: hay que pedirle que vuelva.
    if (!esRelay && vivo) control({ action: 'zoom', value: guardado.zoom })
  }

  const aplicarEncuadre = async () => {
    if (reencuadrando) return
    const reabrir = vivo && (cambioLente || (esRelay && cambioRecorte))
    try {
      await seApi(`devices/${id}/camera`, { method: 'PUT', body: { lens: lente, zoom, ajustes: cuerpoAjustes(ajustes) } })
      const nuevo = { lente, zoom, cx: num(ajustes.centro_x, 0.5), cy: num(ajustes.centro_y, 0.5), brillo: num(ajustes.brillo, 0) }
      guardadoRef.current = nuevo
      setGuardado(nuevo)
    } catch (e) {
      toast.error(motivoDe(e, 'No se pudo guardar el encuadre'))
      return
    }
    toast.success('Encuadre fijado: se aplica también a las fotos programadas')
    if (!reabrir) return

    // Se reabre sin apagar el visor, con un aviso encima: que no parezca caída.
    setReencuadrando(true)
    try {
      turnoRef.current++
      limpiarTimers()
      const viejo = clienteRef.current
      clienteRef.current = null
      // Forzado: el lente nuevo es otra cámara física, se reabre para todos.
      await viejo?.detener(true)
      await new Promise((r) => setTimeout(r, RESPIRO_REABRIR_MS))
      await iniciar({ reabriendo: true })
    } finally {
      setReencuadrando(false)
    }
  }

  // ─── Enfoque (teléfonos) ─────────────────────────────────────────────────
  const guardarEnfoque = async (fijo: boolean, nuevos: Ajustes) => {
    const a = { ...nuevos, enfoque_fijo: fijo }
    setAjustes(a)
    try {
      await seApi(`devices/${id}/camera`, { method: 'PUT', body: { ajustes: cuerpoAjustes(a) } })
      toast.success(fijo ? 'Enfoque fijado: se aplica solo cada vez que se abra la vista' : 'Enfoque libre: la cámara vuelve a enfocar sola')
    } catch (e) {
      toast.error(motivoDe(e, 'No se pudo guardar el enfoque'))
    }
  }

  const alternarEnfoque = () => {
    const fijo = !enfoqueFijo
    setEnfoqueFijo(fijo)
    const x = num(ajustes.enfoque_x, 0.5)
    const y = num(ajustes.enfoque_y, 0.5)
    control(fijo ? { action: 'lock_focus', x, y } : { action: 'unlock_focus' })
    void guardarEnfoque(fijo, ajustes)
  }

  // Tocar el video enfoca ahí; con el enfoque fijo, ese punto pasa a ser el del sitio.
  const tocarVideo = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!vivo || esRelay || !puedeOperar) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    control({ action: enfoqueFijo ? 'lock_focus' : 'focus', x, y })
    if (enfoqueFijo) {
      void guardarEnfoque(true, { ...ajustes, enfoque_x: Math.round(x * 100) / 100, enfoque_y: Math.round(y * 100) / 100 })
    }
  }

  // ─── Orientación ─────────────────────────────────────────────────────────
  const girar = (sentido: 1 | -1) => setRotacion((r) => (((r + sentido * 90) % 360) + 360) % 360)
  const fijarOrientacion = async () => {
    try {
      await seApi(`devices/${id}/stream-rotation`, { method: 'PUT', body: { rotation: rotacion } })
      setRotacionGuardada(rotacion)
      toast.success('Orientación fijada para todos')
    } catch (e) {
      toast.error(motivoDe(e, 'No se pudo fijar la orientación'))
    }
  }

  // ─── Disparador ──────────────────────────────────────────────────────────
  const tomarFoto = async () => {
    if (tomandoFoto) return
    setTomandoFoto(true)
    try {
      await seApi(`devices/${id}/command`, {
        method: 'POST',
        body: { command_type: 'TAKE_PHOTO', priority: 1, payload: { rotation: rotacion, site: equipo.nombre } },
      })
      toast.success('Foto pedida: llega en unos segundos')
      onFoto?.()
    } catch (e) {
      toast.error(motivoDe(e, 'No se pudo pedir la foto'))
    } finally {
      setTimeout(() => setTomandoFoto(false), 2500)
    }
  }

  // ─── Estilo del video: giro + vista previa del recorte y del brillo ──────
  const estiloVideo = (): React.CSSProperties => {
    const escalaGiro = rotacion === 90 || rotacion === 270 ? 4 / 3 : 1
    let escala = 1
    let tx = 0
    let ty = 0
    let brillo = 1
    if (vivo && esRelay) {
      const ladoS = 1 - Math.min(0.9, Math.max(0, enStream.zoom))
      const ladoD = 1 - Math.min(0.9, Math.max(0, zoom))
      const e = ladoS / ladoD
      // Solo se puede ACERCAR sobre lo que ya llega: al alejar faltan píxeles.
      if (e > 1.001) {
        const esquina = (c: number, lado: number) => Math.min(1 - lado, Math.max(0, c - lado / 2))
        const xS = esquina(enStream.cx, ladoS)
        const yS = esquina(enStream.cy, ladoS)
        const xD = esquina(Math.min(1, Math.max(0, num(ajustes.centro_x, 0.5))), ladoD)
        const yD = esquina(Math.min(1, Math.max(0, num(ajustes.centro_y, 0.5))), ladoD)
        const cx = (xD + ladoD / 2 - xS) / ladoS
        const cy = (yD + ladoD / 2 - yS) / ladoS
        // Con object-contain la imagen no llena el elemento: se corrige el
        // desplazamiento por las barras negras.
        const v = videoRef.current
        let fx = 1
        let fy = 1
        if (v && v.videoWidth && v.videoHeight && v.clientWidth && v.clientHeight) {
          const k = Math.min(v.clientWidth / v.videoWidth, v.clientHeight / v.videoHeight)
          fx = (v.videoWidth * k) / v.clientWidth
          fy = (v.videoHeight * k) / v.clientHeight
        }
        escala = e
        tx = (0.5 - cx) * 100 * fx
        ty = (0.5 - cy) * 100 * fy
      }
      const delta = Math.min(1, Math.max(-1, num(ajustes.brillo, 0))) - Math.min(1, Math.max(-1, enStream.brillo))
      if (Math.abs(delta) >= 0.001) brillo = Math.min(1.6, Math.max(0.4, 1 + delta * 0.6))
    }
    return {
      transform: `rotate(${rotacion}deg) scale(${(escalaGiro * escala).toFixed(4)}) translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%)`,
      ...(brillo !== 1 ? { filter: `brightness(${brillo.toFixed(3)})` } : {}),
    }
  }

  const puedeIniciar = puedeOperar && porServidor && !sinVivo && estado === 'apagado' && dispositivo != null
  const ctlBoton = 'shrink-0 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white backdrop-blur-sm transition-colors'
  const ctlSuave = 'bg-white/15 hover:bg-white/25'
  const deslizador = 'h-1 w-full cursor-pointer accent-white'

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={cn('overflow-hidden bg-surface', !embebida && 'rounded-md border border-border')}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-2.5">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted" strokeWidth={1.8} />
          <h2 className="text-[14px] font-semibold text-ink">Vista en vivo</h2>
          {vivo ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-error-soft px-2 py-0.5 text-[11px] font-semibold text-[#b91c1c]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
              En vivo
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {vivo ? (
            <span className="text-[12px] tabular-nums text-muted" title="La transmisión se detiene sola para no gastar datos del equipo">
              <span className="hidden sm:inline">Corte en </span>
              {mmss(restante)}
            </span>
          ) : null}
          {puedeOperar ? (
            <Button variant="secondary" size="sm" onClick={tomarFoto} disabled={tomandoFoto}>
              <Camera className="mr-1.5 h-3.5 w-3.5" />
              {tomandoFoto ? 'Pidiendo…' : 'Foto'}
            </Button>
          ) : null}
          {estado === 'apagado' ? (
            <Button variant="primary" size="sm" onClick={() => iniciar()} disabled={!puedeIniciar}>
              <Play className="mr-1.5 h-3.5 w-3.5" />
              Iniciar
            </Button>
          ) : estado === 'conectando' ? (
            <Button variant="primary" size="sm" disabled>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Conectando…
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={() => detener()}>
              <Square className="mr-1.5 h-3.5 w-3.5" />
              Detener
            </Button>
          )}
        </div>
      </div>

      {/* Visor */}
      <div
        className={cn(
          'relative flex max-h-[70vh] w-full select-none items-center justify-center overflow-hidden bg-[#111]',
          embebida ? 'aspect-[16/10] max-h-[70vh] w-full' : 'aspect-[4/3] max-h-[70vh] w-full',
          vivo && !esRelay && puedeOperar && 'cursor-crosshair',
        )}
        onClick={tocarVideo}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          // Fuera del flujo: apagado no debe empujar el aviso (con `hidden` seguía
          // ocupando su lugar y el texto quedaba cargado a la derecha).
          className={cn('absolute inset-0 h-full w-full object-contain transition-transform', !vivo && 'invisible')}
          style={estiloVideo()}
        />

        {!vivo ? (
          <div className="relative flex flex-col items-center px-6 text-center">
            {errorCarga ? (
              <>
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-warning" strokeWidth={1.5} />
                <p className="text-[13px] text-white/80">No se pudo leer el equipo</p>
                <p className="mt-1 text-[12px] text-white/50">{errorCarga}</p>
              </>
            ) : !dispositivo ? (
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-white/40" />
            ) : sinVivo ? (
              <>
                <VideoOff className="mx-auto mb-2 h-8 w-8 text-white/40" strokeWidth={1.5} />
                <p className="text-[13px] text-white/80">Agente anterior a la vista en vivo</p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] text-white/50">
                  Esta PC corre el agente v1.0. Actualízala y la vista en vivo se enciende sola. Mientras tanto, usa «Foto» para
                  ver el sitio.
                </p>
              </>
            ) : !porServidor ? (
              <>
                <VideoOff className="mx-auto mb-2 h-8 w-8 text-white/40" strokeWidth={1.5} />
                <p className="text-[13px] text-white/80">Este equipo transmite punto a punto</p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] text-white/50">
                  Su versión no pasa el video por el servidor de medios, y desde aquí solo se puede ver por ahí. Actualiza la app del
                  equipo para verlo en vivo.
                </p>
              </>
            ) : estado === 'conectando' ? (
              <>
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-white/50" />
                <p className="mt-3 text-[13px] text-white/80">Conectando con el equipo…</p>
                <p className="mt-1 text-[12px] text-white/50">
                  Puede tardar unos segundos mientras la cámara arranca. No hace falta volver a presionar.
                </p>
              </>
            ) : error ? (
              <>
                <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-warning" strokeWidth={1.5} />
                <p className="text-[13px] text-white/80">No se pudo iniciar la transmisión</p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] text-white/50">{error}</p>
                {puedeIniciar ? (
                  <Button variant="primary" size="sm" className="mt-4" onClick={() => iniciar()}>
                    Reintentar
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-[13px] text-white/60">Vista en vivo apagada</p>
                {puedeOperar ? (
                  <Button variant="primary" size="md" className="mt-4" onClick={() => iniciar()} disabled={!puedeIniciar}>
                    <Play className="mr-2 h-4 w-4" fill="currentColor" />
                    Iniciar vista en vivo
                  </Button>
                ) : (
                  <p className="mt-2 text-[12px] text-white/50">Necesitas permiso para operar equipos para abrir la vista.</p>
                )}
                {!equipo.online ? (
                  <p className="mt-3 text-[12px] text-warning">El equipo no está reportando: puede que no conteste.</p>
                ) : null}
                <p className="mt-3 text-[12px] text-white/40">Se detiene sola a los 3 minutos para no gastar datos del equipo.</p>
              </>
            )}
          </div>
        ) : null}

        {/* Disparador sobre el video: arriba a la derecha en el teléfono, al centro del costado en pantallas grandes */}
        {vivo && puedeOperar ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              void tomarFoto()
            }}
            disabled={tomandoFoto}
            title="Tomar foto"
            aria-label="Tomar foto"
            className="absolute right-3 top-12 z-10 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white/40 bg-white/95 text-[#111] transition hover:bg-white active:scale-95 disabled:opacity-60 sm:top-1/2 sm:h-16 sm:w-16 sm:-translate-y-1/2"
          >
            {tomandoFoto ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6 sm:h-7 sm:w-7" />}
          </button>
        ) : null}

        {vivo && enfoqueFijo && !esRelay ? (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#d97706e6] px-2.5 py-1 text-[11px] font-medium text-white">
            <Lock className="h-3.5 w-3.5" />
            Enfoque fijo
          </div>
        ) : null}

        {/* Barra de controles */}
        {vivo ? (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-3 pb-3 pt-8 text-white"
          >
            {puedeOperar && !esRelay ? (
              <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <label className="flex flex-1 items-center gap-2" title="Zoom">
                  <ZoomIn className="h-4 w-4 shrink-0 text-white/80" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={zoom}
                    onChange={(e) => moverZoom(Number(e.target.value))}
                    className={deslizador}
                    aria-label="Zoom"
                  />
                </label>
                <label className="flex flex-1 items-center gap-2" title="Exposición">
                  <Sun className="h-4 w-4 shrink-0 text-white/80" />
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={exposicion}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setExposicion(v)
                      controlDiferido('exposure', { action: 'exposure', value: v })
                    }}
                    className={deslizador}
                    aria-label="Exposición"
                  />
                </label>
              </div>
            ) : null}

            {puedeOperar && esRelay ? (
              <div className="mb-2.5 space-y-2">
                <label className="flex items-center gap-3" title="Zoom">
                  <ZoomIn className="h-4 w-4 shrink-0 text-white/80" />
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => moverZoom(Number(e.target.value))}
                    className={deslizador}
                    aria-label="Zoom"
                  />
                  <span className="w-12 text-right text-[11px] tabular-nums">{Math.round(zoom * 100)}%</span>
                </label>
                <label className="flex items-center gap-3" title="Brillo">
                  <Sun className="h-4 w-4 shrink-0 text-white/80" />
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={num(ajustes.brillo, 0)}
                    onChange={(e) => moverAjuste('brillo', Number(e.target.value))}
                    className={deslizador}
                    aria-label="Brillo"
                  />
                  <span className="w-12 text-right text-[11px] tabular-nums">
                    {num(ajustes.brillo, 0) > 0 ? '+' : ''}
                    {Math.round(num(ajustes.brillo, 0) * 100)}%
                  </span>
                </label>
                <div className={cn('flex items-center gap-3', zoom < 0.05 && 'pointer-events-none opacity-40')}>
                  <Move className="h-4 w-4 shrink-0 text-white/80" />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={num(ajustes.centro_x, 0.5)}
                    onChange={(e) => moverAjuste('centro_x', Number(e.target.value))}
                    className={deslizador}
                    title="Mover a los lados"
                    aria-label="Mover a los lados"
                  />
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={num(ajustes.centro_y, 0.5)}
                    onChange={(e) => moverAjuste('centro_y', Number(e.target.value))}
                    className={deslizador}
                    title="Mover arriba y abajo"
                    aria-label="Mover arriba y abajo"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5">
              {puedeOperar && !esRelay ? (
                <>
                  <select
                    value={balance}
                    onChange={(e) => {
                      const v = e.target.value as Balance
                      setBalance(v)
                      control({ action: 'wb', value: v })
                    }}
                    className={cn(ctlBoton, ctlSuave, 'cursor-pointer border-0 outline-none')}
                    aria-label="Balance de blancos"
                  >
                    {BALANCES.map((b) => (
                      <option key={b.valor} value={b.valor} className="text-black">
                        {b.texto}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={alternarEnfoque}
                    className={cn(ctlBoton, enfoqueFijo ? 'bg-[#d97706] hover:bg-[#b45309]' : ctlSuave)}
                  >
                    <Lock className="h-3.5 w-3.5" />
                    {enfoqueFijo ? 'Enfoque fijo' : 'Fijar enfoque'}
                  </button>
                </>
              ) : null}

              <div className="flex shrink-0 items-center overflow-hidden rounded bg-white/15 backdrop-blur-sm">
                <button type="button" onClick={() => girar(-1)} title="Girar a la izquierda" aria-label="Girar a la izquierda" className="px-2 py-1 hover:bg-white/20">
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <span className="px-1 text-[11px] tabular-nums">{rotacion}°</span>
                <button type="button" onClick={() => girar(1)} title="Girar a la derecha" aria-label="Girar a la derecha" className="px-2 py-1 hover:bg-white/20">
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </div>

              {puedeOperar && !esRelay ? (
                <select
                  value={lente}
                  onChange={(e) => setLente(e.target.value as Lente)}
                  className={cn(ctlBoton, ctlSuave, 'cursor-pointer border-0 outline-none')}
                  title="Gran angular: abarca más desde la misma distancia. Solo si el equipo lo tiene."
                  aria-label="Lente"
                >
                  <option value="main" className="text-black">Lente normal</option>
                  <option value="wide" className="text-black">Gran angular 0.5x</option>
                </select>
              ) : null}

              {puedeOperar ? (
                <button
                  type="button"
                  onClick={aplicarEncuadre}
                  disabled={!encuadreCambiado || reencuadrando}
                  className={cn(ctlBoton, 'bg-[#15803d] hover:bg-[#166534] disabled:cursor-default disabled:opacity-40')}
                  title="Guarda el encuadre actual. Se aplica también a las fotos programadas."
                >
                  <Check className="h-3.5 w-3.5" />
                  {reencuadrando ? 'Aplicando…' : encuadreCambiado ? 'Fijar encuadre' : 'Encuadre guardado'}
                </button>
              ) : null}
              {puedeOperar && encuadreCambiado && !reencuadrando ? (
                <button type="button" onClick={descartarEncuadre} className={cn(ctlBoton, ctlSuave)} title="Volver al encuadre que tiene guardado el equipo">
                  Descartar
                </button>
              ) : null}
              {puedeOperar && rotacion !== rotacionGuardada ? (
                <button
                  type="button"
                  onClick={fijarOrientacion}
                  className={cn(ctlBoton, 'bg-accent hover:bg-accent-hover')}
                  title="Fijar esta orientación para todos"
                >
                  <Check className="h-3.5 w-3.5" />
                  Fijar orientación
                </button>
              ) : null}
              {rotacion !== rotacionGuardada ? (
                <button type="button" onClick={() => setRotacion(rotacionGuardada)} className={cn(ctlBoton, ctlSuave)} title="Volver a la orientación guardada del equipo">
                  Volver
                </button>
              ) : null}
            </div>

            <p className="mt-2 text-[10.5px] leading-snug text-white/60">
              {esRelay ? (
                <>
                  Lo que ves al mover los deslizadores es una vista previa: el equipo no cambia hasta que pulses{' '}
                  <strong>Fijar encuadre</strong> (ahí la vista se reabre un segundo para traer la imagen nítida).
                </>
              ) : (
                <>
                  Toca el video para enfocar. El zoom, la exposición y el balance cambian la cámara al momento, pero son
                  temporales: solo el zoom y el lente se guardan, al pulsar <strong>Fijar encuadre</strong>.
                </>
              )}{' '}
              La orientación fija es la que todos ven al abrir la vista.
            </p>
          </div>
        ) : null}

        {/* Otra persona tiene la vista (teléfonos punto a punto) */}
        {ocupada ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-6 text-white">
            <div className="max-w-sm text-center">
              <Eye className="mx-auto mb-3 h-9 w-9 text-warning" strokeWidth={1.5} />
              <p className="font-medium">Vista en uso</p>
              <p className="mt-1 text-[13px] text-white/70">
                <span className="font-medium text-white">{ocupada.con}</span> está viendo este equipo desde hace {ocupada.minutos} min.
              </p>
              <p className="mt-3 text-[12px] text-white/50">
                Este equipo solo admite un espectador a la vez: cada conexión de video gasta datos móviles del sitio. La transmisión
                se corta sola a los 3 minutos.
              </p>
              <button
                type="button"
                onClick={() => {
                  setOcupada(null)
                  void iniciar()
                }}
                className="mt-4 rounded bg-white/15 px-3 py-1.5 text-[12px] hover:bg-white/25"
              >
                Reintentar
              </button>
            </div>
          </div>
        ) : null}

        {reencuadrando ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 text-white">
            <div className="flex items-center gap-3 text-[13px]">
              <Loader2 className="h-5 w-5 animate-spin" />
              Aplicando el encuadre nuevo…
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
