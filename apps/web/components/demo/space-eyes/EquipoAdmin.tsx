'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Pencil, Power, RefreshCw, RotateCw, Upload } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { seApi, fotoSE, ErrorSE } from '@/lib/data/space-eyes-se'
import { fechaHora } from './piezas'

// ============================================================================
//  EquipoAdmin — la administración de un equipo: sus datos de sitio, los
//  ajustes de imagen, las órdenes (reiniciar la app, actualizarla) y sus
//  registros.
// ----------------------------------------------------------------------------
//  Props:
//    equipoId     id del equipo en Space Eye.
//    puedeOperar  false = solo mirar: no se editan datos, no se guardan ajustes
//                 ni se mandan órdenes. Los registros se leen igual.
//    onCambio?    opcional; se llama después de guardar los datos del sitio o
//                 los ajustes, para que la ficha que lo integra se refresque
//                 (el nombre del encabezado, por ejemplo).
//
//  Habla con Space Eye por su puerta: GET/PUT devices/:id, PUT
//  devices/:id/camera (ajustes y giro de la foto), POST devices/:id/command
//  (REBOOT_APP, UPDATE_APP, TAKE_PHOTO de prueba), GET devices/:id/logs, GET
//  app/version y GET photos (la foto de prueba).
// ============================================================================

type Equipo = {
  id: number
  name: string | null
  billboard_code: string | null
  address: string | null
  city: string | null
  state: string | null
  status: string | null
  lat: string | number | null
  lng: string | number | null
  manufacturer: string | null
  model: string | null
  android_version: string | null
  app_version: string | null
  app_version_code: number | null
  device_owner: number | boolean | null
  last_seen_at: string | null
  camera_ajustes: string | Ajustes | null
  photo_rotation: number | null
}
type Estado = {
  network_type?: string | null
  network_operator?: string | null
  source_ip?: string | null
  storage_free_mb?: number | null
  cpu_temp?: number | null
  battery_temp?: number | null
} | null
type Publicado = { disponible: boolean; version?: string; version_code?: number }
type Versiones = Publicado & { agente_pc?: Publicado; agente_pi?: Publicado }
type Registro = { id: number; level: string; category: string | null; message: string; logged_at: string }
type Ajustes = Record<string, number | string | boolean | null | undefined>

const CAMPO =
  'h-9 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent disabled:bg-surface-2 disabled:text-muted'

const ESTADOS = [
  { v: 'provisioning', t: 'En operación' },
  { v: 'active', t: 'Activa' },
  { v: 'maintenance', t: 'En mantenimiento' },
  { v: 'inactive', t: 'Dada de baja' },
]

const CONTROLES = [
  { campo: 'centro_x', nombre: 'Centro horizontal', min: 0, max: 1, pordefecto: 0.5 },
  { campo: 'centro_y', nombre: 'Centro vertical', min: 0, max: 1, pordefecto: 0.5 },
  { campo: 'brillo', nombre: 'Brillo', min: -1, max: 1, pordefecto: 0 },
  { campo: 'ev', nombre: 'Exposición', min: -3, max: 3, pordefecto: 0 },
  { campo: 'contraste', nombre: 'Contraste', min: 0, max: 2, pordefecto: 1 },
  { campo: 'saturacion', nombre: 'Saturación', min: 0, max: 2, pordefecto: 1 },
  { campo: 'nitidez', nombre: 'Nitidez', min: 0, max: 2, pordefecto: 1 },
]

const MEDICION = [
  { v: 'centre', t: 'Centro del cuadro (normal)' },
  { v: 'spot', t: 'Solo el centro — para exponer la pantalla' },
  { v: 'average', t: 'Todo el cuadro por igual' },
  { v: 'matrix', t: 'Por zonas' },
]
const BALANCE = [
  { v: 'auto', t: 'Automático' },
  { v: 'daylight', t: 'Luz de día' },
  { v: 'cloudy', t: 'Nublado' },
  { v: 'tungsten', t: 'Foco incandescente' },
  { v: 'fluorescent', t: 'Fluorescente' },
  { v: 'indoor', t: 'Interior' },
]
const GIROS = [0, 90, 180, 270] as const

const esPc = (v: string | null | undefined) => /^pc-agent/i.test(String(v || ''))
const esPi = (v: string | null | undefined) => /^pi-agent/i.test(String(v || ''))

function mensaje(e: unknown): string {
  if (e instanceof ErrorSE && e.status === 403) return 'No tienes permiso para esto.'
  return e instanceof Error ? e.message : String(e)
}

function leerAjustes(v: Equipo['camera_ajustes']): Ajustes {
  if (!v) return {}
  if (typeof v !== 'string') return { ...v }
  try {
    return JSON.parse(v) || {}
  } catch {
    return {}
  }
}

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

export function EquipoAdmin({
  equipoId,
  puedeOperar,
  onCambio,
}: {
  equipoId: number
  puedeOperar: boolean
  onCambio?: () => void
}) {
  const [equipo, setEquipo] = useState<Equipo | null>(null)
  const [estado, setEstado] = useState<Estado>(null)
  const [versiones, setVersiones] = useState<Versiones | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const d = await seApi<{ device: Equipo; latest_status: Estado }>(`devices/${equipoId}`)
    setEquipo(d.device)
    setEstado(d.latest_status)
    return d.device
  }, [equipoId])

  useEffect(() => {
    let vivo = true
    setError(null)
    cargar().catch((e) => vivo && setError(mensaje(e)))
    seApi<Versiones>('app/version')
      .then((v) => vivo && setVersiones(v))
      .catch(() => vivo && setVersiones(null))
    return () => {
      vivo = false
    }
  }, [cargar])

  if (error) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        No se pudo leer el equipo: {error}
      </div>
    )
  }
  if (!equipo) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo el equipo…
      </div>
    )
  }

  const alGuardar = async () => {
    await cargar()
    onCambio?.()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <FichaYDatos equipo={equipo} estado={estado} puedeOperar={puedeOperar} onGuardado={alGuardar} />
        <Ordenes equipo={equipo} versiones={versiones} puedeOperar={puedeOperar} />
      </div>
      <AjustesImagen key={equipo.id} equipo={equipo} puedeOperar={puedeOperar} onGuardado={alGuardar} />
      <Registros equipoId={equipoId} />
    </div>
  )
}

// ─── Ficha y datos del sitio ────────────────────────────────────────────────
function FichaYDatos({
  equipo,
  estado,
  puedeOperar,
  onGuardado,
}: {
  equipo: Equipo
  estado: Estado
  puedeOperar: boolean
  onGuardado: () => Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [msg, setMsg] = useState<Mensaje>(null)

  function abrir() {
    setForm({
      name: equipo.name ?? '',
      billboard_code: equipo.billboard_code ?? '',
      address: equipo.address ?? '',
      city: equipo.city ?? '',
      state: equipo.state ?? '',
      status: equipo.status ?? 'provisioning',
      // MySQL devuelve DECIMAL como texto, no como número.
      lat: equipo.lat == null ? '' : String(equipo.lat),
      lng: equipo.lng == null ? '' : String(equipo.lng),
    })
    setFallo(null)
    setAbierto(true)
  }

  // Coordenadas: vacío = «no se sabe» (null), NO cero; y el servidor espera número.
  const coord = (t: string, max: number): number | null | 'mal' => {
    const s = t.trim()
    if (s === '') return null
    const n = Number(s)
    return Number.isFinite(n) && Math.abs(n) <= max ? n : 'mal'
  }
  const lat = coord(form.lat ?? '', 90)
  const lng = coord(form.lng ?? '', 180)

  async function guardar() {
    if (lat === 'mal' || lng === 'mal') return
    setGuardando(true)
    setFallo(null)
    try {
      await seApi(`devices/${equipo.id}`, {
        method: 'PUT',
        body: {
          name: form.name.trim(),
          billboard_code: form.billboard_code.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          status: form.status,
          lat,
          lng,
        },
      })
      await onGuardado()
      setAbierto(false)
      setMsg({ tipo: 'ok', texto: 'Datos del sitio guardados.' })
    } catch (e) {
      setFallo(`No se pudo guardar: ${mensaje(e)}`)
    } finally {
      setGuardando(false)
    }
  }

  const campo = (k: string, etiqueta: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block">
      <span className="text-[12px] text-muted">{etiqueta}</span>
      <input
        {...extra}
        value={form[k] ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
        className={cn(CAMPO, 'mt-1')}
      />
    </label>
  )

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-ink">Ficha del equipo</h2>
          <p className="mt-0.5 text-[12px] text-muted">Dónde está y qué aparato es.</p>
        </div>
        {puedeOperar && (
          <Button size="sm" variant="secondary" onClick={abrir}>
            <Pencil className="h-3.5 w-3.5" /> Editar datos
          </Button>
        )}
      </header>
      <div className="p-3 text-[12px]">
        {msg && <p className={cn('mb-2', msg.tipo === 'ok' ? 'text-success' : 'text-error')}>{msg.texto}</p>}
        <Grupo titulo="Sitio">
          <Dato k="Nombre" v={equipo.name} />
          <Dato k="Código del espectacular" v={equipo.billboard_code} mono />
          <Dato k="Dirección" v={[equipo.address, equipo.city, equipo.state].filter(Boolean).join(', ')} />
          <Dato k="Estado" v={ESTADOS.find((s) => s.v === equipo.status)?.t ?? equipo.status} />
        </Grupo>
        <Grupo titulo="Aparato">
          <Dato k="Modelo" v={[equipo.manufacturer, equipo.model].filter(Boolean).join(' ')} />
          <Dato k="Android" v={equipo.android_version} mono />
          <Dato k="Versión de la app" v={equipo.app_version} mono />
        </Grupo>
        <Grupo titulo="Conexión y salud">
          <Dato k="Red" v={estado?.network_type} />
          <Dato k="Operador" v={estado?.network_operator} />
          <Dato k="IP pública" v={estado?.source_ip} mono />
          <Dato k="Última conexión" v={fechaHora(equipo.last_seen_at)} />
          <Dato k="Almacenamiento libre" v={estado?.storage_free_mb ? `${estado.storage_free_mb} MB` : null} mono />
          <Dato k="Temperatura CPU" v={estado?.cpu_temp ? `${estado.cpu_temp} °C` : null} mono />
          <Dato k="Temperatura batería" v={estado?.battery_temp != null ? `${estado.battery_temp} °C` : null} mono />
        </Grupo>
      </div>

      <Modal
        open={abierto}
        onOpenChange={(v) => !guardando && setAbierto(v)}
        title="Editar datos del sitio"
        footer={
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={guardando} onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={guardando || lat === 'mal' || lng === 'mal'} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {fallo && <p className="text-[12px] text-error">{fallo}</p>}
          {campo('name', 'Nombre', { placeholder: 'Ej. Espectacular Reforma 222' })}
          {campo('billboard_code', 'Código del espectacular')}
          {campo('address', 'Dirección')}
          <div className="grid grid-cols-2 gap-3">
            {campo('city', 'Ciudad')}
            {campo('state', 'Estado')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo('lat', 'Latitud', { inputMode: 'decimal', placeholder: '19.4326' })}
            {campo('lng', 'Longitud', { inputMode: 'decimal', placeholder: '-99.1332' })}
          </div>
          {(lat === 'mal' || lng === 'mal') && (
            <p className="-mt-1 text-[12px] text-error">La latitud va de −90 a 90 y la longitud de −180 a 180.</p>
          )}
          <p className="-mt-1 text-[12px] text-muted">
            Déjalas vacías si no las sabes. Sirven para ubicar la pantalla y para calcular la luz de su sitio, que es lo
            que decide a qué horas la foto sale limpia y a qué horas sale con líneas.
          </p>
          <label className="block">
            <span className="text-[12px] text-muted">Estado de la pantalla</span>
            <select
              value={form.status ?? 'provisioning'}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className={cn(CAMPO, 'mt-1')}
            >
              {ESTADOS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.t}
                </option>
              ))}
            </select>
          </label>
          <p className="-mt-1 text-[12px] text-muted">
            Mantenimiento y dada de baja dejan a la pantalla fuera de las programaciones: no le llegan fotos y deja de
            gastar datos, sin borrar nada. En operación y activa hoy se comportan igual.
          </p>
        </div>
      </Modal>
    </section>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1 text-[11px] uppercase tracking-wide text-muted">{titulo}</p>
      <dl className="divide-y divide-border">{children}</dl>
    </div>
  )
}

function Dato({ k, v, mono }: { k: string; v: string | number | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className={cn('min-w-0 break-words text-right text-ink', mono && 'tabular-nums')}>
        {v === null || v === undefined || v === '' ? '—' : v}
      </dd>
    </div>
  )
}

// ─── Órdenes: reiniciar y actualizar ─────────────────────────────────────────
function Ordenes({ equipo, versiones, puedeOperar }: { equipo: Equipo; versiones: Versiones | null; puedeOperar: boolean }) {
  const [pedir, setPedir] = useState<'reiniciar' | 'actualizar' | 'equipo' | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<Mensaje>(null)

  const v = equipo.app_version
  // Lo publicado PARA ESTE equipo: cada tipo baja lo suyo.
  const publicado: Publicado | undefined = esPc(v) ? versiones?.agente_pc : esPi(v) ? versiones?.agente_pi : versiones ?? undefined
  const owner = equipo.device_owner === 1 || equipo.device_owner === true
  const seActualizaSolo = esPc(v) || esPi(v) || owner
  const instaladaTexto = String(v || '').replace(/^(pc|pi)-agent\s*v?/i, '')
  const instalado = Number(equipo.app_version_code) || 0
  const atrasada =
    !!publicado?.disponible &&
    (publicado.version_code && instalado
      ? instalado < publicado.version_code
      : Boolean(publicado.version && instaladaTexto && instaladaTexto !== publicado.version))

  const avisoActualizar = esPc(v)
    ? 'Se instalará el agente publicado en esta PC. Verifica la huella del archivo antes de sustituirlo y, si el programa nuevo no arranca, vuelve solo al anterior.'
    : esPi(v)
      ? 'Se instalará el agente publicado en esta Raspberry. Verifica la huella y lo prueba antes de reemplazar nada; si la versión nueva no arranca, vuelve sola a la anterior. La identidad del equipo y sus fotos pendientes se conservan.'
      : owner
        ? `Se instalará la versión ${publicado?.version || 'publicada'} en este equipo. Tardará un par de minutos y la app se reiniciará sola.`
        : 'Este equipo no puede instalar solo: alguien tendrá que confirmar la instalación en la pantalla del teléfono. ¿Enviar de todos modos?'

  async function enviar() {
    const tipo = pedir
    if (!tipo) return
    setEnviando(true)
    setMsg(null)
    try {
      await seApi(`devices/${equipo.id}/command`, {
        method: 'POST',
        body: { command_type: tipo === 'reiniciar' ? 'REBOOT_APP' : tipo === 'equipo' ? 'REBOOT_DEVICE' : 'UPDATE_APP' },
      })
      setMsg({
        tipo: 'ok',
        texto:
          tipo === 'reiniciar'
            ? 'Orden enviada: la app se reinicia en el equipo.'
            : tipo === 'equipo'
              ? 'Orden enviada: la Raspberry se reinicia; vuelve a reportar en uno o dos minutos.'
            : seActualizaSolo
              ? 'Actualización enviada; el equipo se reiniciará al terminar.'
              : 'Orden enviada: falta confirmar la instalación en el equipo.',
      })
    } catch (e) {
      const motivos: Record<string, string> = {
        apk_no_publicado: 'No hay APK publicada en el servidor.',
        agente_no_publicado: 'No hay agente de PC publicado en el servidor.',
        agente_pi_no_publicado: 'No hay agente de Raspberry publicado en el servidor.',
      }
      const clave = e instanceof ErrorSE ? (e.cuerpo as { error?: string } | null)?.error : undefined
      setMsg({ tipo: 'error', texto: (clave && motivos[clave]) || `No se pudo enviar la orden: ${mensaje(e)}` })
    } finally {
      setEnviando(false)
      setPedir(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="border-b border-border p-3">
        <h2 className="text-[14px] font-semibold text-ink">Programa del equipo</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Reiniciar la app{esPi(v) ? ' o el equipo' : ''}, o instalarle la versión publicada, sin ir al sitio.
        </p>
      </header>
      <div className="flex flex-col gap-3 p-3 text-[12px]">
        <dl className="divide-y divide-border">
          <Dato k="Instalada" v={v} mono />
          <Dato
            k="Publicada"
            v={versiones == null ? 'sin dato' : publicado?.disponible ? publicado.version ?? 'sin número' : 'nada publicado'}
            mono
          />
        </dl>
        {atrasada ? (
          <div className="flex items-start gap-2 rounded-md border border-border border-l-[3px] border-l-warning bg-warning-soft p-2.5 text-ink">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <div>
              Hay una versión nueva: <span className="font-medium tabular-nums">{publicado?.version}</span>.{' '}
              <span className="text-muted">
                {seActualizaSolo
                  ? 'Se instala sola, sin tocar el equipo.'
                  : 'Este equipo pedirá confirmación en su pantalla (no es dueño del dispositivo).'}
              </span>
            </div>
          </div>
        ) : (
          publicado?.disponible && <p className="text-success">Tiene la versión publicada.</p>
        )}
        {msg && <p className={msg.tipo === 'ok' ? 'text-success' : 'text-error'}>{msg.texto}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={atrasada ? 'primary' : 'secondary'}
            disabled={!puedeOperar || !publicado?.disponible || enviando}
            onClick={() => setPedir('actualizar')}
          >
            <Upload className="h-3.5 w-3.5" /> Actualizar app
          </Button>
          <Button size="sm" variant="danger" disabled={!puedeOperar || enviando} onClick={() => setPedir('reiniciar')}>
            <Power className="h-3.5 w-3.5" /> Reiniciar app
          </Button>
          {esPi(v) && (
            <Button size="sm" variant="danger" disabled={!puedeOperar || enviando} onClick={() => setPedir('equipo')}>
              <Power className="h-3.5 w-3.5" /> Reiniciar equipo
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pedir === 'reiniciar'}
        onOpenChange={(o) => !o && setPedir(null)}
        title="Reiniciar la aplicación"
        confirmLabel="Reiniciar"
        busy={enviando}
        onConfirm={() => void enviar()}
      >
        Se reinicia la aplicación en el equipo. Deja de reportar unos segundos y vuelve sola.
      </ConfirmDialog>
      <ConfirmDialog
        open={pedir === 'equipo'}
        onOpenChange={(o) => !o && setPedir(null)}
        title="Reiniciar la Raspberry"
        confirmLabel="Reiniciar equipo"
        busy={enviando}
        onConfirm={() => void enviar()}
      >
        Se reinicia la Raspberry entera, no solo la app: es lo que destraba una cámara o una red que se quedaron colgadas.
        Deja de reportar uno o dos minutos y vuelve sola.
      </ConfirmDialog>
      <ConfirmDialog
        open={pedir === 'actualizar'}
        onOpenChange={(o) => !o && setPedir(null)}
        title="Actualizar el programa del equipo"
        confirmLabel="Actualizar"
        variant="primary"
        busy={enviando}
        onConfirm={() => void enviar()}
      >
        {avisoActualizar}
      </ConfirmDialog>
    </section>
  )
}

// ─── Ajustes de imagen ───────────────────────────────────────────────────────
function AjustesImagen({
  equipo,
  puedeOperar,
  onGuardado,
}: {
  equipo: Equipo
  puedeOperar: boolean
  onGuardado: () => Promise<void>
}) {
  const inicial = leerAjustes(equipo.camera_ajustes)
  const [abierto, setAbierto] = useState(false)
  const [aj, setAj] = useState<Ajustes>(inicial)
  const [wbManual, setWbManual] = useState(inicial.awb_rojo != null && inicial.awb_azul != null)
  const [expManual, setExpManual] = useState(Number(inicial.obturador) > 0)
  const [giro, setGiro] = useState<number>(((Number(equipo.photo_rotation) % 360) + 360) % 360 || 0)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [fotoPrueba, setFotoPrueba] = useState<string | null>(null)
  const [msg, setMsg] = useState<Mensaje>(null)
  const sondeo = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (sondeo.current) clearInterval(sondeo.current)
  }, [])

  const n = (campo: string, pordefecto: number) => {
    const x = Number(aj[campo])
    return aj[campo] == null || !Number.isFinite(x) ? pordefecto : x
  }
  const poner = (campo: string, valor: number | string | null) => setAj((a) => ({ ...a, [campo]: valor }))

  function alternarWb(activo: boolean) {
    setWbManual(activo)
    setAj((a) =>
      activo
        ? { ...a, awb_rojo: a.awb_rojo ?? 1.5, awb_azul: a.awb_azul ?? 1.5 }
        : { ...a, awb_rojo: null, awb_azul: null },
    )
  }
  // Exposición a mano: todo o nada. Obturador fijo sin ganancia fija deja la
  // foto a merced de la hora del día.
  function alternarExp(activo: boolean) {
    setExpManual(activo)
    setAj((a) =>
      activo
        ? { ...a, obturador: Number(a.obturador) || 8000, ganancia: Number(a.ganancia) || 1 }
        : { ...a, obturador: 0, ganancia: 0 },
    )
  }

  function cuerpo(): Ajustes | null {
    const a: Ajustes = { ...aj }
    // Sin las dos ganancias no se manda ninguna: el agente las ignora sueltas.
    if (!wbManual || a.awb_rojo == null || a.awb_azul == null) {
      delete a.awb_rojo
      delete a.awb_azul
    }
    // 0 significa «automático» para el agente; mandarlo suelto solo ensucia.
    if (!expManual) {
      delete a.obturador
      delete a.ganancia
    }
    Object.keys(a).forEach((k) => {
      if (a[k] === null || a[k] === undefined) delete a[k]
    })
    return Object.keys(a).length ? a : null
  }

  async function guardar(): Promise<boolean> {
    setGuardando(true)
    setMsg(null)
    try {
      await seApi(`devices/${equipo.id}/camera`, { method: 'PUT', body: { ajustes: cuerpo(), photo_rotation: giro } })
      await onGuardado()
      setMsg({ tipo: 'ok', texto: 'Ajustes guardados: se aplican a todas las fotos del equipo.' })
      return true
    } catch (e) {
      setMsg({ tipo: 'error', texto: `No se pudieron guardar: ${mensaje(e)}` })
      return false
    } finally {
      setGuardando(false)
    }
  }

  // Guarda y pide una foto: los ajustes viajan dentro de la orden, así que hay
  // que guardarlos antes o la prueba saldría con los anteriores.
  async function probar() {
    if (probando) return
    if (!(await guardar())) return
    setProbando(true)
    try {
      const ultima = async () =>
        (await seApi<{ photos: { id: number; storage_path?: string; thumbnail_path?: string }[] }>(
          `photos?device_id=${equipo.id}&limit=1`,
        )).photos?.[0]
      const antes = (await ultima().catch(() => undefined))?.id
      await seApi(`devices/${equipo.id}/command`, { method: 'POST', body: { command_type: 'TAKE_PHOTO', priority: 1 } })
      let intentos = 0
      sondeo.current = setInterval(async () => {
        intentos++
        const nueva = await ultima().catch(() => undefined)
        if (nueva && nueva.id !== antes) {
          if (sondeo.current) clearInterval(sondeo.current)
          setProbando(false)
          setFotoPrueba(fotoSE(nueva.storage_path || nueva.thumbnail_path))
          setMsg({ tipo: 'ok', texto: 'Así se ve con estos ajustes.' })
        } else if (intentos >= 15) {
          if (sondeo.current) clearInterval(sondeo.current)
          setProbando(false)
          setMsg({ tipo: 'error', texto: 'No llegó la foto: el equipo puede estar apagado o transmitiendo.' })
        }
      }, 2000)
    } catch (e) {
      setProbando(false)
      setMsg({ tipo: 'error', texto: `No se pudo pedir la foto de prueba: ${mensaje(e)}` })
    }
  }

  const bloqueado = !puedeOperar
  const deslizador = (
    campo: string,
    nombre: string,
    min: number,
    max: number,
    paso: number,
    pordefecto: number,
    texto?: (v: number) => string,
  ) => {
    const valor = n(campo, pordefecto)
    return (
      <label key={campo} className="block">
        <span className="mb-1 flex justify-between text-[12px] text-muted">
          <span>{nombre}</span>
          <span className="tabular-nums text-ink">{texto ? texto(valor) : valor.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={paso}
          value={valor}
          disabled={bloqueado}
          onChange={(e) => poner(campo, Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
      </label>
    )
  }
  const SELECT = cn(CAMPO, 'h-8 text-[12px]')

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-ink">Ajustes de imagen</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Se guardan en el equipo y se aplican a todas sus fotos, incluidas las programadas.
          </p>
        </div>
        <Button size="sm" variant="tertiary" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
          {abierto ? 'Ocultar' : 'Mostrar'}
        </Button>
      </header>

      {abierto && (
        <div className="grid gap-6 p-3 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            {/* Giro de la foto: se aplica al recibirla. No es el giro de la vista en vivo. */}
            <div>
              <p className="mb-1 text-[12px] font-medium text-ink">Giro de la foto</p>
              <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-[12px]">
                {GIROS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    disabled={bloqueado}
                    onClick={() => setGiro(g)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-2.5 py-1 tabular-nums transition-colors duration-150 disabled:pointer-events-none',
                      giro === g ? 'bg-surface-2 font-medium text-ink' : 'text-muted hover:text-ink',
                    )}
                  >
                    {g === 0 ? 'Sin giro' : <><RotateCw className="h-3 w-3" />{g}°</>}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Endereza la foto al recibirla. Es distinto de la orientación de la vista en vivo.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CONTROLES.map((c) => deslizador(c.campo, c.nombre, c.min, c.max, 0.05, c.pordefecto))}
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-2 text-[12px] font-medium text-ink">Pantalla de LED</p>
              {deslizador('cuadros', 'Cuadros a promediar', 1, 32, 1, 1, (v) => (v > 1 ? `${v} cuadros` : 'un disparo'))}
              <p className="mb-3 mt-1 text-[11px] text-muted">
                Contra las líneas de la pantalla: cada cuadro las agarra en otra posición y al promediarlos se cancelan
                (con 16 la marca baja de 40% a 10%). Tarda ~1 s más y, si el creativo cambia a media captura, sale
                mezclado.
              </p>

              <label className="mb-3 block">
                <span className="mb-1 block text-[12px] text-muted">Dónde mide la luz</span>
                <select
                  value={String(aj.medicion ?? 'centre')}
                  disabled={bloqueado}
                  onChange={(e) => poner('medicion', e.target.value)}
                  className={SELECT}
                >
                  {MEDICION.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mb-2 flex items-center gap-2 text-[12px] text-ink">
                <input
                  type="checkbox"
                  checked={expManual}
                  disabled={bloqueado}
                  onChange={(e) => alternarExp(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Fijar la exposición a mano
              </label>
              {expManual && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {deslizador('obturador', 'Obturador', 200, 40000, 100, 8000, (v) => `${Math.round(v)} µs`)}
                    {deslizador('ganancia', 'Ganancia', 1, 16, 0.25, 1)}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    Al fijarlo se pierde el automático: hay que mover los dos juntos o la foto sale quemada o a oscuras
                    según la hora.
                  </p>
                </>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <label className="mb-2 block">
                <span className="mb-1 block text-[12px] text-muted">Balance de blancos</span>
                <select
                  value={String(aj.awb ?? 'auto')}
                  disabled={bloqueado}
                  onChange={(e) => poner('awb', e.target.value)}
                  className={SELECT}
                >
                  {BALANCE.map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mb-2 flex items-center gap-2 text-[12px] text-ink">
                <input
                  type="checkbox"
                  checked={wbManual}
                  disabled={bloqueado}
                  onChange={(e) => alternarWb(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                Ajustar el color a mano (necesario si las hojas salen moradas)
              </label>
              {wbManual && (
                <div className="grid grid-cols-2 gap-3">
                  {deslizador('awb_rojo', 'Rojo', 0.5, 4, 0.05, 1.5)}
                  {deslizador('awb_azul', 'Azul', 0.5, 4, 0.05, 1.5)}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                size="sm"
                variant="secondary"
                disabled={bloqueado}
                title="Promedia 16 cuadros, baja la exposición y mide la luz en la pantalla"
                onClick={() => {
                  setAj((a) => ({ ...a, cuadros: 16, ev: -0.7, medicion: 'spot' }))
                  setMsg({ tipo: 'ok', texto: 'Punto de partida para pantalla aplicado. Prueba y sube o baja la exposición.' })
                }}
              >
                Pantalla de LED: punto de partida
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={bloqueado}
                title="Para cámaras sin filtro infrarrojo, donde la vegetación sale morada"
                onClick={() => {
                  setWbManual(true)
                  setAj((a) => ({ ...a, awb_rojo: 1.05, awb_azul: 1.9, saturacion: 0.75, contraste: 1.1 }))
                  setMsg({ tipo: 'ok', texto: 'Punto de partida aplicado. Prueba y afina con los deslizadores.' })
                }}
              >
                Hojas moradas: punto de partida
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={bloqueado}
                onClick={() => {
                  setAj({})
                  setWbManual(false)
                  setExpManual(false)
                  setMsg({ tipo: 'ok', texto: 'Ajustes en blanco. Guarda para que el equipo los tome.' })
                }}
              >
                Restablecer
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-muted">Foto de prueba</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={bloqueado || probando || guardando} onClick={probar}>
                  {probando ? 'Tomando…' : 'Probar'}
                </Button>
                <Button size="sm" disabled={bloqueado || guardando || probando} onClick={guardar}>
                  {guardando ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
            {msg && <p className={cn('mb-2 text-[12px]', msg.tipo === 'ok' ? 'text-success' : 'text-error')}>{msg.texto}</p>}
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2">
              {fotoPrueba ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoPrueba} alt="Foto de prueba" className="h-full w-full object-contain" />
              ) : probando ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              ) : (
                <p className="px-4 text-center text-[12px] text-muted">«Probar» guarda los ajustes y pide una foto para ver cómo quedan.</p>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted">Cada prueba consume una foto de datos. En equipos con SIM, úsala con medida.</p>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Registros del equipo ────────────────────────────────────────────────────
const TINTA_NIVEL: Record<string, string> = {
  error: 'text-error',
  critical: 'text-error',
  warning: 'text-warning',
}

function Registros({ equipoId }: { equipoId: number }) {
  const [logs, setLogs] = useState<Registro[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setFallo(null)
    try {
      const r = await seApi<{ logs: Registro[] }>(`devices/${equipoId}/logs?limit=50`)
      setLogs(r.logs ?? [])
    } catch (e) {
      setFallo(mensaje(e))
    } finally {
      setCargando(false)
    }
  }, [equipoId])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-ink">Registros del equipo</h2>
          <p className="mt-0.5 text-[12px] text-muted">Lo que el equipo reporta de sí mismo, para diagnosticarlo en campo.</p>
        </div>
        <Button size="sm" variant="tertiary" disabled={cargando} onClick={cargar}>
          <RefreshCw className={cn('h-3.5 w-3.5', cargando && 'animate-spin')} /> Actualizar
        </Button>
      </header>
      {fallo && <p className="p-3 text-[12px] text-error">No se pudieron leer los registros: {fallo}</p>}
      <div className="max-h-72 divide-y divide-border overflow-y-auto">
        {logs === null && !fallo ? (
          <div className="flex items-center gap-2 p-3 text-[12px] text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo registros…
          </div>
        ) : logs && logs.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-muted">Sin registros todavía.</p>
        ) : (
          (logs ?? []).map((l) => (
            <div key={l.id} className="flex flex-wrap items-start gap-x-3 gap-y-0.5 px-3 py-2 text-[12px] sm:flex-nowrap">
              <span
                className={cn(
                  'w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide',
                  TINTA_NIVEL[l.level] ?? 'text-muted',
                )}
              >
                {l.level}
              </span>
              <span className="w-14 shrink-0 truncate text-muted">{l.category || '—'}</span>
              <span className="min-w-0 flex-1 basis-full break-words text-ink sm:basis-auto">{l.message}</span>
              <span className="shrink-0 tabular-nums text-muted">{fechaHora(l.logged_at)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
