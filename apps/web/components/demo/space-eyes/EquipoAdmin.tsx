'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Pencil, Power, RefreshCw, RotateCw, Upload } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { ConfirmDialog } from '@/components/demo/ui/ConfirmDialog'
import { seApi, fotoSE, ErrorSE, textoDeError } from '@/lib/data/space-eyes-se'
import { fechaHora, fijo } from './piezas'
import { comoSeActualiza } from '@/lib/space-eyes-actualizacion'
import { formatNumero } from '@/lib/formato-numero'
import { useIdioma } from '@/lib/i18n/contexto'
import { traducir, type ClaveTexto } from '@/lib/i18n/diccionario'
import type { Idioma } from '@/lib/i18n/idiomas'
import { interpolarNodos } from '@/lib/i18n/nodos'

// ============================================================================
//  EquipoAdmin — la administración de un equipo: sus datos de sitio, los
//  ajustes de imagen, las órdenes (reiniciar la app, actualizarla) y sus
//  registros.
// ----------------------------------------------------------------------------
//  Props:
//    equipoId     id del equipo en Space Eye.
//    puedeOperar  false = solo mirar: no se editan datos ni se mandan ordenes
//    puedeEncuadrar  los AJUSTES DE IMAGEN (encuadre fino, color, giro de la
//                 foto) cambian lo que la camara ve y lo que el equipo aprende:
//                 solo el Dueno (`lib/roles.ts`, 19/10/2026).
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
  // APK 0.16.4+: si la próxima actualización entra sin tocar el teléfono.
  app_actualiza_sola?: number | boolean | null
  app_actualiza_motivo?: string | null
  last_seen_at: string | null
  camera_ajustes: string | Ajustes | null
  // El perfil de noche y su tramo (Space Eye, migración 030). El servidor
  // encima estos ajustes sobre los de arriba dentro del tramo.
  camera_ajustes_noche?: string | Ajustes | null
  noche_inicio?: string | null
  noche_fin?: string | null
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

const ESTADOS: { v: string; t: ClaveTexto }[] = [
  { v: 'provisioning', t: 'spaceeyes.admin.estado.provisioning' },
  { v: 'active', t: 'spaceeyes.admin.estado.active' },
  { v: 'maintenance', t: 'spaceeyes.admin.estado.maintenance' },
  { v: 'inactive', t: 'spaceeyes.admin.estado.inactive' },
]

type Control = { campo: string; nombre: ClaveTexto; min: number; max: number; paso: number; pordefecto: number }
const CONTROLES_PI: Control[] = [
  { campo: 'centro_x', nombre: 'spaceeyes.admin.control.centro-x', min: 0, max: 1, paso: 0.05, pordefecto: 0.5 },
  { campo: 'centro_y', nombre: 'spaceeyes.admin.control.centro-y', min: 0, max: 1, paso: 0.05, pordefecto: 0.5 },
  { campo: 'brillo', nombre: 'spaceeyes.comun.brillo', min: -1, max: 1, paso: 0.05, pordefecto: 0 },
  { campo: 'ev', nombre: 'spaceeyes.comun.exposicion', min: -3, max: 3, paso: 0.05, pordefecto: 0 },
  { campo: 'contraste', nombre: 'spaceeyes.admin.control.contraste', min: 0, max: 2, paso: 0.05, pordefecto: 1 },
  { campo: 'saturacion', nombre: 'spaceeyes.admin.control.saturacion', min: 0, max: 2, paso: 0.05, pordefecto: 1 },
  { campo: 'nitidez', nombre: 'spaceeyes.admin.control.nitidez', min: 0, max: 2, paso: 0.05, pordefecto: 1 },
]

// En el telefono la exposicion es un INDICE de compensacion, no pasos de
// diafragma: cada aparato tiene su propio rango y su propio tamano de paso, y
// la APK recorta lo que no alcance (`coerceIn`). Por eso va de uno en uno y sin
// decimales.
const CONTROLES_ANDROID: Control[] = [
  { campo: 'exposicion', nombre: 'spaceeyes.comun.exposicion', min: -12, max: 12, paso: 1, pordefecto: 0 },
]

const MEDICION: { v: string; t: ClaveTexto }[] = [
  { v: 'centre', t: 'spaceeyes.admin.medicion.centre' },
  { v: 'spot', t: 'spaceeyes.admin.medicion.spot' },
  { v: 'average', t: 'spaceeyes.admin.medicion.average' },
  { v: 'matrix', t: 'spaceeyes.admin.medicion.matrix' },
]
type Opcion = { v: string; t: ClaveTexto }
const BALANCE_PI: Opcion[] = [
  { v: 'auto', t: 'spaceeyes.admin.balance.auto' },
  { v: 'daylight', t: 'spaceeyes.balance.daylight' },
  { v: 'cloudy', t: 'spaceeyes.balance.cloudy' },
  { v: 'tungsten', t: 'spaceeyes.admin.balance.tungsten' },
  { v: 'fluorescent', t: 'spaceeyes.balance.fluorescent' },
  { v: 'indoor', t: 'spaceeyes.admin.balance.indoor' },
]
// Los cinco que entiende `balanceDe()` en la APK. «Interior» no esta porque el
// telefono no lo tiene, y el foco se llama `incandescent` y no `tungsten`:
// mandarle la palabra de la Raspberry equivale a no mandarle nada.
const BALANCE_ANDROID: Opcion[] = [
  { v: 'auto', t: 'spaceeyes.admin.balance.auto' },
  { v: 'daylight', t: 'spaceeyes.balance.daylight' },
  { v: 'cloudy', t: 'spaceeyes.balance.cloudy' },
  { v: 'incandescent', t: 'spaceeyes.admin.balance.tungsten' },
  { v: 'fluorescent', t: 'spaceeyes.balance.fluorescent' },
]
const GIROS = [0, 90, 180, 270] as const

const esPc = (v: string | null | undefined) => /^pc-agent/i.test(String(v || ''))
const esPi = (v: string | null | undefined) => /^pi-agent/i.test(String(v || ''))

// ─── Lo que cada tipo de equipo aplica DE VERDAD ─────────────────────────────
//
// Esto no es una preferencia de diseno: es lo que dice el codigo de cada
// agente. Hasta que estuvo aqui, el panel le ofrecia a todos los mandos de la
// Raspberry, y en un telefono —que son cinco de los once equipos de g500— casi
// ninguno hacia nada. Se guardaban en la base, se mandaban en la orden y la
// APK los tiraba sin decir palabra, asi que desde la pantalla no habia forma de
// saber que no servian.
//
//   Raspberry  `pi-agent/src/camara.js` los traduce a banderas de libcamera:
//              los aplica todos.
//   Android    `WebRTCClient.kt`, `aplicarAjustesSitio()`: lee TRES claves y no
//              mas — `enfoque_fijo`, `exposicion` y `balance`.
//   PC / IP    `pc-agent/src/camera.js` no toca la camara: la configura su
//              propio firmware, desde la web de la camara.
//
// Y cuidado con los nombres, que es donde estaba el enredo: lo mismo se llama
// distinto en cada lado. Exposicion es `ev` en la Raspberry (pasos de
// diafragma) y `exposicion` en el telefono (un indice). Balance de blancos es
// `awb` alla y `balance` aca. No son equivalentes ni en unidad ni en nombre,
// asi que no se puede guardar un solo numero y que lo entiendan los dos.
type Tipo = 'pi' | 'android' | 'pc'

/**
 * De que tipo es un equipo. Se mira `app_version` —«pi-agent 0.4.0»,
 * «pc-agent 1.4.0», o un numero suelto como «0.14.0» en el telefono—, igual
 * que hace la seccion de actualizar.
 *
 * NO sirve `android_version`, aunque se llame asi: ahi los agentes escriben la
 * version del SISTEMA («Debian GNU/Linux 13 (trixie)», «Windows_NT 10.0.19045»,
 * o «15» en un telefono), porque el backend reaprovecho el campo. Leer ese y
 * no este dejaria a toda la flota clasificada como telefono, y una Raspberry
 * perderia los mandos que si aplica.
 */
const tipoDe = (v: string | null | undefined): Tipo => (esPi(v) ? 'pi' : esPc(v) ? 'pc' : 'android')

type Capacidades = {
  sliders: Control[]
  balance: { campo: string; opciones: Opcion[] } | null
  pantallaLed: boolean
  presets: boolean
  // El tramo de noche, con el campo y la escala de ESTE tipo de equipo.
  noche: { campo: string; min: number; max: number; paso: number; pordefecto: number; ayuda: ClaveTexto } | null
}

const CAPACIDADES: Record<Tipo, Capacidades> = {
  pi: {
    sliders: CONTROLES_PI,
    balance: { campo: 'awb', opciones: BALANCE_PI },
    pantallaLed: true,
    presets: true,
    noche: {
      campo: 'ev',
      min: -3,
      max: 3,
      paso: 0.1,
      pordefecto: -0.7,
      ayuda: 'spaceeyes.admin.noche.ayuda.pi',
    },
  },
  android: {
    sliders: CONTROLES_ANDROID,
    balance: { campo: 'balance', opciones: BALANCE_ANDROID },
    pantallaLed: false,
    presets: false,
    noche: {
      campo: 'exposicion',
      min: -12,
      max: 12,
      paso: 1,
      pordefecto: -4,
      ayuda: 'spaceeyes.admin.noche.ayuda.android',
    },
  },
  pc: { sliders: [], balance: null, pantallaLed: false, presets: false, noche: null },
}

function mensaje(e: unknown, idioma: Idioma): string {
  if (e instanceof ErrorSE && e.status === 403) return traducir(idioma, 'spaceeyes.comun.sin-permiso')
  return textoDeError(e, idioma) ?? String(e)
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

type Noche = { activo: boolean; inicio: string; fin: string; valor: number }

/**
 * El tramo de noche guardado, o el de siempre si no hay nada puesto.
 *
 * Las tres piezas van juntas: un perfil sin horas —o al revés— no es un tramo
 * y el servidor lo ignoraría sin decir nada. MySQL devuelve las columnas TIME
 * como «19:00:00», de ahí el recorte.
 *
 * El valor se lee del campo que entiende ESTE equipo (ver CAPACIDADES). Si
 * quedó un `brillo` de antes —lo que guardaba el panel hasta ahora— se ignora
 * a propósito: en un teléfono nunca hizo nada, y rescatarlo sería arrastrar al
 * control nuevo el número de una escala que no es la suya.
 */
function leerNoche(equipo: Equipo): Noche {
  const cap = CAPACIDADES[tipoDe(equipo.app_version)].noche
  const vacio: Noche = { activo: false, inicio: '19:00', fin: '07:00', valor: cap?.pordefecto ?? 0 }
  const aj = leerAjustes(equipo.camera_ajustes_noche ?? null)
  const hora = (v: string | null | undefined) => (v ? String(v).slice(0, 5) : null)
  const ini = hora(equipo.noche_inicio)
  const fin = hora(equipo.noche_fin)
  if (!cap || !Object.keys(aj).length || !ini || !fin) return vacio
  const guardado = Number(aj[cap.campo])
  return { activo: true, inicio: ini, fin, valor: Number.isFinite(guardado) ? guardado : cap.pordefecto }
}

type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null

export function EquipoAdmin({
  equipoId,
  puedeOperar,
  puedeEncuadrar,
  onCambio,
}: {
  equipoId: number
  puedeOperar: boolean
  puedeEncuadrar: boolean
  onCambio?: () => void
}) {
  const { t, idioma } = useIdioma()
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
    cargar().catch((e) => vivo && setError(mensaje(e, idioma)))
    seApi<Versiones>('app/version')
      .then((v) => vivo && setVersiones(v))
      .catch(() => vivo && setVersiones(null))
    return () => {
      vivo = false
    }
  }, [cargar, idioma])

  if (error) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        {t('spaceeyes.admin.error', { error })}
      </div>
    )
  }
  if (!equipo) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('spaceeyes.admin.leyendo')}
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
      <AjustesImagen key={equipo.id} equipo={equipo} puedeEncuadrar={puedeEncuadrar} onGuardado={alGuardar} />
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
  const { t, idioma } = useIdioma()
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
      setMsg({ tipo: 'ok', texto: t('spaceeyes.admin.datos.guardados') })
    } catch (e) {
      setFallo(t('spaceeyes.comun.no-guardar', { motivo: mensaje(e, idioma) }))
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
          <h2 className="text-[14px] font-semibold text-ink">{t('spaceeyes.admin.ficha')}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{t('spaceeyes.admin.ficha.texto')}</p>
        </div>
        {puedeOperar && (
          <Button size="sm" variant="secondary" onClick={abrir}>
            <Pencil className="h-3.5 w-3.5" /> {t('spaceeyes.admin.editar')}
          </Button>
        )}
      </header>
      <div className="p-3 text-[12px]">
        {msg && <p className={cn('mb-2', msg.tipo === 'ok' ? 'text-success' : 'text-error')}>{msg.texto}</p>}
        <Grupo titulo={t('spaceeyes.admin.sitio')}>
          <Dato k={t('spaceeyes.comun.nombre')} v={equipo.name} />
          <Dato k={t('spaceeyes.admin.codigo')} v={equipo.billboard_code} mono />
          <Dato k={t('spaceeyes.admin.direccion')} v={[equipo.address, equipo.city, equipo.state].filter(Boolean).join(', ')} />
          <Dato
            k={t('spaceeyes.comun.estado')}
            v={(() => {
              const e = ESTADOS.find((s) => s.v === equipo.status)
              return e ? t(e.t) : equipo.status
            })()}
          />
        </Grupo>
        <Grupo titulo={t('spaceeyes.admin.aparato')}>
          <Dato k={t('spaceeyes.comun.modelo')} v={[equipo.manufacturer, equipo.model].filter(Boolean).join(' ')} />
          <Dato k="Android" v={equipo.android_version} mono />
          <Dato k={t('spaceeyes.admin.version-app')} v={equipo.app_version} mono />
        </Grupo>
        <Grupo titulo={t('spaceeyes.admin.salud')}>
          <Dato k={t('spaceeyes.admin.red')} v={estado?.network_type} />
          <Dato k={t('spaceeyes.admin.operador')} v={estado?.network_operator} />
          <Dato k={t('spaceeyes.admin.ip')} v={estado?.source_ip} mono />
          <Dato k={t('spaceeyes.admin.ultima-conexion')} v={fechaHora(equipo.last_seen_at, idioma)} />
          <Dato
            k={t('spaceeyes.comun.almacenamiento')}
            v={estado?.storage_free_mb ? `${formatNumero(estado.storage_free_mb, 0, idioma)} MB` : null}
            mono
          />
          <Dato k={t('spaceeyes.admin.temp-cpu')} v={estado?.cpu_temp ? `${estado.cpu_temp} °C` : null} mono />
          <Dato k={t('spaceeyes.admin.temp-bateria')} v={estado?.battery_temp != null ? `${estado.battery_temp} °C` : null} mono />
        </Grupo>
      </div>

      <Modal
        open={abierto}
        onOpenChange={(v) => !guardando && setAbierto(v)}
        title={t('spaceeyes.admin.editar.titulo')}
        footer={
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={guardando} onClick={() => setAbierto(false)}>
              {t('comun.cancelar')}
            </Button>
            <Button size="sm" disabled={guardando || lat === 'mal' || lng === 'mal'} onClick={guardar}>
              {guardando ? t('spaceeyes.comun.guardando') : t('comun.guardar')}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {fallo && <p className="text-[12px] text-error">{fallo}</p>}
          {campo('name', t('spaceeyes.comun.nombre'), { placeholder: t('spaceeyes.admin.nombre-ej') })}
          {campo('billboard_code', t('spaceeyes.admin.codigo'))}
          {campo('address', t('spaceeyes.admin.direccion'))}
          <div className="grid grid-cols-2 gap-3">
            {campo('city', t('spaceeyes.admin.ciudad'))}
            {campo('state', t('spaceeyes.admin.estado-region'))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {campo('lat', t('spaceeyes.admin.latitud'), { inputMode: 'decimal', placeholder: '19.4326' })}
            {campo('lng', t('spaceeyes.admin.longitud'), { inputMode: 'decimal', placeholder: '-99.1332' })}
          </div>
          {(lat === 'mal' || lng === 'mal') && (
            <p className="-mt-1 text-[12px] text-error">{t('spaceeyes.admin.coordenadas-mal')}</p>
          )}
          <p className="-mt-1 text-[12px] text-muted">{t('spaceeyes.admin.coordenadas')}</p>
          <label className="block">
            <span className="text-[12px] text-muted">{t('spaceeyes.admin.estado-pantalla')}</span>
            <select
              value={form.status ?? 'provisioning'}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              className={cn(CAMPO, 'mt-1')}
            >
              {ESTADOS.map((s) => (
                <option key={s.v} value={s.v}>
                  {t(s.t)}
                </option>
              ))}
            </select>
          </label>
          <p className="-mt-1 text-[12px] text-muted">{t('spaceeyes.admin.estado-ayuda')}</p>
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
  const { t, idioma } = useIdioma()
  const [pedir, setPedir] = useState<'reiniciar' | 'actualizar' | 'equipo' | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [msg, setMsg] = useState<Mensaje>(null)

  const v = equipo.app_version
  // Lo publicado PARA ESTE equipo: cada tipo baja lo suyo.
  const publicado: Publicado | undefined = esPc(v) ? versiones?.agente_pc : esPi(v) ? versiones?.agente_pi : versiones ?? undefined
  const owner = equipo.device_owner === 1 || equipo.device_owner === true
  const como = comoSeActualiza(equipo, idioma)
  const seActualizaSolo = como.sola
  const instaladaTexto = String(v || '').replace(/^(pc|pi)-agent\s*v?/i, '')
  const instalado = Number(equipo.app_version_code) || 0
  const atrasada =
    !!publicado?.disponible &&
    (publicado.version_code && instalado
      ? instalado < publicado.version_code
      : Boolean(publicado.version && instaladaTexto && instaladaTexto !== publicado.version))

  const avisoActualizar = esPc(v)
    ? t('spaceeyes.admin.actualizar.pc')
    : esPi(v)
      ? t('spaceeyes.admin.actualizar.pi')
      : owner || seActualizaSolo
        ? publicado?.version
          ? t('spaceeyes.admin.actualizar.version', { version: publicado.version })
          : t('spaceeyes.admin.actualizar.publicada')
        : t('spaceeyes.admin.actualizar.de-todos-modos', { como: como.texto })

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
            ? t('spaceeyes.admin.orden.reiniciar')
            : tipo === 'equipo'
              ? t('spaceeyes.admin.orden.equipo')
            : seActualizaSolo
              ? t('spaceeyes.admin.orden.actualizar')
              : t('spaceeyes.admin.orden.confirmar'),
      })
    } catch (e) {
      const motivos: Record<string, ClaveTexto> = {
        apk_no_publicado: 'spaceeyes.admin.motivo.apk',
        agente_no_publicado: 'spaceeyes.admin.motivo.pc',
        agente_pi_no_publicado: 'spaceeyes.admin.motivo.pi',
      }
      const clave = e instanceof ErrorSE ? (e.cuerpo as { error?: string } | null)?.error : undefined
      setMsg({
        tipo: 'error',
        texto: clave && motivos[clave] ? t(motivos[clave]) : t('spaceeyes.admin.orden.error', { motivo: mensaje(e, idioma) }),
      })
    } finally {
      setEnviando(false)
      setPedir(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="border-b border-border p-3">
        <h2 className="text-[14px] font-semibold text-ink">{t('spaceeyes.admin.programa')}</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          {esPi(v) ? t('spaceeyes.admin.programa.texto-pi') : t('spaceeyes.admin.programa.texto')}
        </p>
      </header>
      <div className="flex flex-col gap-3 p-3 text-[12px]">
        <dl className="divide-y divide-border">
          <Dato k={t('spaceeyes.admin.instalada')} v={v} mono />
          <Dato
            k={t('spaceeyes.admin.publicada')}
            v={
              versiones == null
                ? t('spaceeyes.comun.sin-dato')
                : publicado?.disponible
                  ? publicado.version ?? t('spaceeyes.admin.sin-numero')
                  : t('spaceeyes.admin.nada-publicado')
            }
            mono
          />
        </dl>
        {atrasada ? (
          <div className="flex items-start gap-2 rounded-md border border-border border-l-[3px] border-l-warning bg-warning-soft p-2.5 text-ink">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <div>
              {interpolarNodos(t('spaceeyes.admin.nueva'), {
                version: <span className="font-medium tabular-nums">{publicado?.version}</span>,
              })}{' '}
              <span className="text-muted">{seActualizaSolo ? t('spaceeyes.admin.se-instala-sola') : como.texto}</span>
            </div>
          </div>
        ) : (
          publicado?.disponible && <p className="text-success">{t('spaceeyes.admin.al-dia')}</p>
        )}
        {/* Siempre a la vista: decide si actualizar la flota necesita visitas. */}
        <p
          className={cn(
            'text-[12px]',
            como.tono === 'ok' ? 'text-success' : como.tono === 'visita' ? 'text-error' : 'text-warning',
          )}
        >
          {t('spaceeyes.admin.actualizaciones', { como: como.texto })}
        </p>
        {msg && <p className={msg.tipo === 'ok' ? 'text-success' : 'text-error'}>{msg.texto}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={atrasada ? 'primary' : 'secondary'}
            disabled={!puedeOperar || !publicado?.disponible || enviando}
            onClick={() => setPedir('actualizar')}
          >
            <Upload className="h-3.5 w-3.5" /> {t('spaceeyes.admin.boton.actualizar')}
          </Button>
          <Button size="sm" variant="danger" disabled={!puedeOperar || enviando} onClick={() => setPedir('reiniciar')}>
            <Power className="h-3.5 w-3.5" /> {t('spaceeyes.admin.boton.reiniciar')}
          </Button>
          {esPi(v) && (
            <Button size="sm" variant="danger" disabled={!puedeOperar || enviando} onClick={() => setPedir('equipo')}>
              <Power className="h-3.5 w-3.5" /> {t('spaceeyes.admin.boton.reiniciar-equipo')}
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pedir === 'reiniciar'}
        onOpenChange={(o) => !o && setPedir(null)}
        title={t('spaceeyes.admin.reiniciar.titulo')}
        confirmLabel={t('spaceeyes.admin.reiniciar.boton')}
        busy={enviando}
        onConfirm={() => void enviar()}
      >
        {t('spaceeyes.admin.reiniciar.texto')}
      </ConfirmDialog>
      <ConfirmDialog
        open={pedir === 'equipo'}
        onOpenChange={(o) => !o && setPedir(null)}
        title={t('spaceeyes.admin.reiniciar-pi.titulo')}
        confirmLabel={t('spaceeyes.admin.boton.reiniciar-equipo')}
        busy={enviando}
        onConfirm={() => void enviar()}
      >
        {t('spaceeyes.admin.reiniciar-pi.texto')}
      </ConfirmDialog>
      <ConfirmDialog
        open={pedir === 'actualizar'}
        onOpenChange={(o) => !o && setPedir(null)}
        title={t('spaceeyes.admin.actualizar.titulo')}
        confirmLabel={t('spaceeyes.admin.actualizar.boton')}
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
  puedeEncuadrar,
  onGuardado,
}: {
  equipo: Equipo
  puedeEncuadrar: boolean
  onGuardado: () => Promise<void>
}) {
  const { t, idioma } = useIdioma()
  const inicial = leerAjustes(equipo.camera_ajustes)
  // Que mandos tiene sentido ensenar para ESTE equipo. Ver CAPACIDADES.
  const tipo = tipoDe(equipo.app_version)
  const cap = CAPACIDADES[tipo]
  const [abierto, setAbierto] = useState(false)
  const [aj, setAj] = useState<Ajustes>(inicial)
  const [wbManual, setWbManual] = useState(inicial.awb_rojo != null && inicial.awb_azul != null)
  const [expManual, setExpManual] = useState(Number(inicial.obturador) > 0)
  const [noche, setNoche] = useState<Noche>(() => leerNoche(equipo))
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

  // Las tres piezas del tramo viajan juntas, y en null lo apagan. El perfil
  // declara SOLO la clave que cambia de noche: el servidor lo encima sobre el
  // de día, así que todo lo que no se nombre aquí sigue siendo el de arriba.
  function cuerpoNoche() {
    if (!cap.noche || !noche.activo || !noche.inicio || !noche.fin) {
      return { ajustes_noche: null, noche_inicio: null, noche_fin: null }
    }
    const valor = cap.noche.paso >= 1 ? Math.round(noche.valor) : Number(noche.valor)
    return {
      ajustes_noche: { [cap.noche.campo]: Number.isFinite(valor) ? valor : 0 },
      noche_inicio: noche.inicio,
      noche_fin: noche.fin,
    }
  }

  async function guardar(): Promise<boolean> {
    setGuardando(true)
    setMsg(null)
    try {
      await seApi(`devices/${equipo.id}/camera`, {
        method: 'PUT',
        body: { ajustes: cuerpo(), photo_rotation: giro, ...cuerpoNoche() },
      })
      await onGuardado()
      setMsg({ tipo: 'ok', texto: t('spaceeyes.admin.ajustes.guardados') })
      return true
    } catch (e) {
      setMsg({ tipo: 'error', texto: t('spaceeyes.admin.ajustes.no-guardar', { motivo: mensaje(e, idioma) }) })
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
          setMsg({ tipo: 'ok', texto: t('spaceeyes.admin.prueba.asi') })
        } else if (intentos >= 15) {
          if (sondeo.current) clearInterval(sondeo.current)
          setProbando(false)
          setMsg({ tipo: 'error', texto: t('spaceeyes.admin.prueba.no-llego') })
        }
      }, 2000)
    } catch (e) {
      setProbando(false)
      setMsg({ tipo: 'error', texto: t('spaceeyes.admin.prueba.error', { motivo: mensaje(e, idioma) }) })
    }
  }

  const bloqueado = !puedeEncuadrar
  // Un indice de exposicion con su sentido: «−4 · más oscuro». Con `igual`
  // el cero tambien se explica («0 · igual que de día»), que es lo que pide el
  // tramo de noche: ahi el cero significa «no cambia nada».
  const indice = (v: number, decimales = 0, igual = false) => {
    const cifra = decimales ? formatNumero(v, decimales, idioma) : String(Math.round(v))
    if (v < 0) return t('spaceeyes.admin.indice.oscuro', { n: cifra })
    if (v > 0) return t('spaceeyes.admin.indice.claro', { n: cifra })
    return igual ? t('spaceeyes.admin.indice.igual', { n: cifra }) : cifra
  }

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
          <span className="tabular-nums text-ink">{texto ? texto(valor) : fijo(valor, 2, idioma)}</span>
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
          <h2 className="text-[14px] font-semibold text-ink">{t('spaceeyes.admin.ajustes')}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{t('spaceeyes.admin.ajustes.texto')}</p>
        </div>
        <Button size="sm" variant="tertiary" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto}>
          {abierto ? t('spaceeyes.admin.ocultar') : t('spaceeyes.admin.mostrar')}
        </Button>
      </header>

      {abierto && (
        <div className="grid gap-6 p-3 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            {/* Giro de la foto: se aplica al recibirla. No es el giro de la vista en vivo. */}
            <div>
              <p className="mb-1 text-[12px] font-medium text-ink">{t('spaceeyes.admin.giro')}</p>
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
                    {g === 0 ? t('spaceeyes.admin.sin-giro') : <><RotateCw className="h-3 w-3" />{g}°</>}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">
                {t('spaceeyes.admin.giro.texto')}
              </p>
            </div>

            {cap.sliders.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Un paso entero se escribe entero: la exposicion del telefono
                    es un indice y «0.00» le pone decimales a algo que no los
                    tiene. */}
                {cap.sliders.map((c) =>
                  deslizador(
                    c.campo,
                    t(c.nombre),
                    c.min,
                    c.max,
                    c.paso,
                    c.pordefecto,
                    c.paso >= 1 ? (v) => indice(v) : undefined,
                  ),
                )}
              </div>
            ) : null}
            {tipo !== 'pi' && (
              <p className="text-[11px] text-muted">
                {tipo === 'pc' ? t('spaceeyes.admin.tipo.pc') : t('spaceeyes.admin.tipo.android')}
              </p>
            )}

            {/* La luz por horario. El mismo ajuste no sirve a las 3 de la
                tarde y a las 9 de la noche, cuando el LED es lo único que
                alumbra la escena: de día la foto sale bien y de noche quemada.
                Antes había que entrar dos veces al día a mover el control a
                mano, y no lo hacía nadie.

                Lo que baja de noche es la EXPOSICIÓN y no el brillo, aunque el
                control dijera «brillo» hasta ahora. Sobre una pantalla de LED
                el brillo suma luz a la imagen ya revelada y no devuelve un
                canal quemado —medido en la foto del 27-ago: el 21.4% de los
                píxeles de la pantalla tenía al menos un canal pegado en 250—.
                Lo único que lo evita es exponer menos. Y en un teléfono el
                brillo ni siquiera llegaba: la APK no lee esa clave. */}
            {cap.noche && (
            <div className="border-t border-border pt-4">
              <label className="flex items-center gap-2 text-[12px] text-ink">
                <input
                  type="checkbox"
                  checked={noche.activo}
                  disabled={!puedeEncuadrar}
                  onChange={(e) => setNoche((v) => ({ ...v, activo: e.target.checked }))}
                />
                {t('spaceeyes.admin.noche.activar')}
              </label>
              {noche.activo && (
                <div className="mt-3">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-muted">{t('spaceeyes.comun.desde')}</span>
                      <input
                        type="time"
                        className={CAMPO}
                        value={noche.inicio}
                        disabled={!puedeEncuadrar}
                        onChange={(e) => setNoche((v) => ({ ...v, inicio: e.target.value }))}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12px] text-muted">{t('spaceeyes.comun.hasta')}</span>
                      <input
                        type="time"
                        className={CAMPO}
                        value={noche.fin}
                        disabled={!puedeEncuadrar}
                        onChange={(e) => setNoche((v) => ({ ...v, fin: e.target.value }))}
                      />
                    </label>
                  </div>
                  <label className="mt-3 block">
                    <span className="mb-1 flex justify-between text-[12px] text-muted">
                      <span>{t('spaceeyes.admin.noche.exposicion')}</span>
                      <span className="tabular-nums text-ink">
                        {indice(noche.valor, cap.noche.paso >= 1 ? 0 : 2, true)}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={cap.noche.min}
                      max={cap.noche.max}
                      step={cap.noche.paso}
                      className="w-full"
                      value={noche.valor}
                      disabled={!puedeEncuadrar}
                      onChange={(e) => setNoche((v) => ({ ...v, valor: Number(e.target.value) }))}
                    />
                  </label>
                  <p className="mt-1 text-[11px] text-muted">
                    {t(cap.noche.ayuda)} {t('spaceeyes.admin.noche.texto')}
                  </p>
                </div>
              )}
            </div>
            )}

            {cap.pantallaLed && (
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-[12px] font-medium text-ink">{t('spaceeyes.admin.led')}</p>
              {deslizador('cuadros', t('spaceeyes.admin.cuadros'), 1, 32, 1, 1, (v) =>
                v > 1 ? t('spaceeyes.admin.cuadros.n', { n: v }) : t('spaceeyes.admin.cuadros.un-disparo'),
              )}
              <p className="mb-3 mt-1 text-[11px] text-muted">{t('spaceeyes.admin.cuadros.texto')}</p>

              <label className="mb-3 block">
                <span className="mb-1 block text-[12px] text-muted">{t('spaceeyes.admin.medicion')}</span>
                <select
                  value={String(aj.medicion ?? 'centre')}
                  disabled={bloqueado}
                  onChange={(e) => poner('medicion', e.target.value)}
                  className={SELECT}
                >
                  {MEDICION.map((o) => (
                    <option key={o.v} value={o.v}>
                      {t(o.t)}
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
                {t('spaceeyes.admin.exposicion-mano')}
              </label>
              {expManual && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    {deslizador('obturador', t('spaceeyes.admin.obturador'), 200, 40000, 100, 8000, (v) => `${formatNumero(v, 0, idioma)} µs`)}
                    {deslizador('ganancia', t('spaceeyes.admin.ganancia'), 1, 16, 0.25, 1)}
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{t('spaceeyes.admin.exposicion-mano.texto')}</p>
                </>
              )}
            </div>
            )}

            {cap.balance && (
            <div className="border-t border-border pt-4">
              <label className="mb-2 block">
                <span className="mb-1 block text-[12px] text-muted">{t('spaceeyes.comun.balance')}</span>
                <select
                  value={String(aj[cap.balance.campo] ?? 'auto')}
                  disabled={bloqueado}
                  onChange={(e) => poner(cap.balance!.campo, e.target.value)}
                  className={SELECT}
                >
                  {cap.balance.opciones.map((o) => (
                    <option key={o.v} value={o.v}>
                      {t(o.t)}
                    </option>
                  ))}
                </select>
              </label>
              {/* Las ganancias a mano son de rpicam: el telefono solo entiende
                  el modo, no los numeros. */}
              {tipo === 'pi' && (
                <>
                <label className="mb-2 flex items-center gap-2 text-[12px] text-ink">
                  <input
                    type="checkbox"
                    checked={wbManual}
                    disabled={bloqueado}
                    onChange={(e) => alternarWb(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  {t('spaceeyes.admin.color-mano')}
                </label>
                {wbManual && (
                  <div className="grid grid-cols-2 gap-3">
                    {deslizador('awb_rojo', t('spaceeyes.admin.rojo'), 0.5, 4, 0.05, 1.5)}
                    {deslizador('awb_azul', t('spaceeyes.admin.azul'), 0.5, 4, 0.05, 1.5)}
                  </div>
                )}
                </>
              )}
            </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {cap.presets && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={bloqueado}
                    title={t('spaceeyes.admin.receta.led.ayuda')}
                    onClick={() => {
                      setAj((a) => ({ ...a, cuadros: 16, ev: -0.7, medicion: 'spot' }))
                      setMsg({ tipo: 'ok', texto: t('spaceeyes.admin.receta.led.aplicada') })
                    }}
                  >
                    {t('spaceeyes.admin.receta.led')}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={bloqueado}
                    title={t('spaceeyes.admin.receta.hojas.ayuda')}
                    onClick={() => {
                      setWbManual(true)
                      setAj((a) => ({ ...a, awb_rojo: 1.05, awb_azul: 1.9, saturacion: 0.75, contraste: 1.1 }))
                      setMsg({ tipo: 'ok', texto: t('spaceeyes.admin.receta.hojas.aplicada') })
                    }}
                  >
                    {t('spaceeyes.admin.receta.hojas')}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                disabled={bloqueado}
                onClick={() => {
                  setAj({})
                  setWbManual(false)
                  setExpManual(false)
                  setMsg({ tipo: 'ok', texto: t('spaceeyes.admin.restablecidos') })
                }}
              >
                {t('spaceeyes.admin.restablecer')}
              </Button>
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] text-muted">{t('spaceeyes.admin.prueba')}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" disabled={bloqueado || probando || guardando} onClick={probar}>
                  {probando ? t('spaceeyes.admin.tomando') : t('spaceeyes.admin.probar')}
                </Button>
                <Button size="sm" disabled={bloqueado || guardando || probando} onClick={guardar}>
                  {guardando ? t('spaceeyes.comun.guardando') : t('comun.guardar')}
                </Button>
              </div>
            </div>
            {bloqueado && (
              <p className="mb-2 text-[12px] text-muted">
                {t('spaceeyes.admin.solo-dueno')}
              </p>
            )}
            {msg && <p className={cn('mb-2 text-[12px]', msg.tipo === 'ok' ? 'text-success' : 'text-error')}>{msg.texto}</p>}
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2">
              {fotoPrueba ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoPrueba} alt={t('spaceeyes.admin.prueba')} className="h-full w-full object-contain" />
              ) : probando ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              ) : (
                <p className="px-4 text-center text-[12px] text-muted">{t('spaceeyes.admin.probar.texto')}</p>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted">{t('spaceeyes.admin.prueba.datos')}</p>
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
  const { t, idioma } = useIdioma()
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
      setFallo(mensaje(e, idioma))
    } finally {
      setCargando(false)
    }
  }, [equipoId, idioma])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-ink">{t('spaceeyes.admin.registros')}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{t('spaceeyes.admin.registros.texto')}</p>
        </div>
        <Button size="sm" variant="tertiary" disabled={cargando} onClick={cargar}>
          <RefreshCw className={cn('h-3.5 w-3.5', cargando && 'animate-spin')} /> {t('spaceeyes.comun.actualizar')}
        </Button>
      </header>
      {fallo && <p className="p-3 text-[12px] text-error">{t('spaceeyes.admin.registros.error', { error: fallo })}</p>}
      <div className="max-h-72 divide-y divide-border overflow-y-auto">
        {logs === null && !fallo ? (
          <div className="flex items-center gap-2 p-3 text-[12px] text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('spaceeyes.admin.registros.leyendo')}
          </div>
        ) : logs && logs.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-muted">{t('spaceeyes.admin.registros.vacio')}</p>
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
              <span className="shrink-0 tabular-nums text-muted">{fechaHora(l.logged_at, idioma)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
